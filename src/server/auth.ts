import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'crypto';
import type { LoginInput, RegisterInput } from '@/shared/validation';
import { signAccess } from './auth-core';
import { env } from './config';
import { rateLimit } from './auth-core';
import { HttpError, bad, conflict, forbidden } from './http';
import { appUrl, queueMail, resetEmail, verifyEmail as verifyEmailTemplate } from './mail';
import { EmailVerifyToken, PasswordResetToken, RefreshToken, User } from './models';
import { meDto } from './users';
import { toId } from './util';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const DUMMY = hash(randomBytes(8).toString('hex'), ARGON); // equalises timing for unknown emails
const unauth = (code: string, message: string) => new HttpError(401, code, message);

async function issueTokens(userId: string, familyId = randomBytes(12).toString('hex')) {
  const accessToken = await signAccess(userId);
  const refreshToken = randomBytes(48).toString('base64url');
  await RefreshToken.create({ userId: toId(userId), tokenHash: sha256(refreshToken), familyId, expiresAt: new Date(Date.now() + env.refreshDays * 86_400_000) });
  return { accessToken, refreshToken, expiresIn: env.accessTtl };
}

export async function register(input: RegisterInput) {
  if (await User.exists({ email: input.email })) throw conflict('EMAIL_TAKEN', 'An account with this email already exists');
  let user;
  try { user = await User.create({ email: input.email, displayName: input.displayName, passwordHash: await hash(input.password, ARGON) }); }
  catch (e) { if ((e as { code?: number }).code === 11000) throw conflict('EMAIL_TAKEN', 'An account with this email already exists'); throw e; }
  await sendVerification(String(user._id), user.email);
  return { user: String(user._id), me: meDto(user.toObject()), ...(await issueTokens(String(user._id))) };
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email });
  const ok = user ? await verify(user.passwordHash, input.password) : (await verify(await DUMMY, input.password), false);
  if (!user || !ok) throw unauth('INVALID_CREDENTIALS', 'Email or password is incorrect');
  if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED', 'This account has been suspended');
  return { user: String(user._id), me: meDto(user.toObject()), ...(await issueTokens(String(user._id))) };
}

export async function refresh(raw: string) {
  const row = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!row) throw unauth('INVALID_REFRESH', 'Please sign in again');
  if (row.revokedAt) { // a rotated token was replayed: assume theft, revoke the family
    await RefreshToken.updateMany({ familyId: row.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw unauth('REFRESH_REUSED', 'Please sign in again');
  }
  if (row.expiresAt < new Date()) throw unauth('REFRESH_EXPIRED', 'Please sign in again');
  const user = await User.findById(row.userId).lean();
  if (!user || user.status === 'SUSPENDED') throw unauth('ACCOUNT_UNAVAILABLE', 'Please sign in again');
  // Atomic rotate: only one concurrent request can claim this token.
  const claimed = await RefreshToken.updateOne({ _id: row._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!claimed.modifiedCount) throw unauth('REFRESH_REUSED', 'Please sign in again');
  return { user: String(row.userId), me: meDto(user), ...(await issueTokens(String(row.userId), row.familyId)) };
}

export const logout = async (raw?: string | null) => { if (raw) await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { $set: { revokedAt: new Date() } }); };

/** Creates a fresh one-time token (older ones are invalidated) and emails the link. */
async function sendVerification(userId: string, email: string) {
  await EmailVerifyToken.deleteMany({ userId: toId(userId) });
  const token = randomBytes(32).toString('base64url');
  await EmailVerifyToken.create({ userId: toId(userId), tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3_600_000) });
  await queueMail(verifyEmailTemplate(email, `${appUrl()}/verify-email?token=${token}`));
  return token;
}

export async function resendVerification(userId: string) {
  const u = await User.findById(toId(userId)).select('email emailVerifiedAt').lean();
  if (!u) throw unauth('INVALID_CREDENTIALS', 'Please sign in again');
  if (u.emailVerifiedAt) return { alreadyVerified: true };
  await rateLimit(`verify:${userId}`, 3, 3600);
  await sendVerification(userId, u.email);
  return { sent: true };
}

export async function verifyEmail(token: string) {
  const row = await EmailVerifyToken.findOne({ tokenHash: sha256(token) });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw unauth('INVALID_VERIFICATION', 'This verification link is invalid or has expired');
  const claimed = await EmailVerifyToken.updateOne({ _id: row._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!claimed.modifiedCount) throw unauth('INVALID_VERIFICATION', 'This verification link is invalid or has expired');
  await User.updateOne({ _id: row.userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  return { verified: true };
}

/** Always behaves the same whether or not the account exists (no account enumeration). Returns the raw token only so tests can use it. */
export async function forgotPassword(email: string): Promise<string | null> {
  await rateLimit(`forgot:${email}`, 3, 3600); // stops mail-bombing one address
  const user = await User.findOne({ email }).select('_id').lean();
  if (!user) return null;
  await PasswordResetToken.deleteMany({ userId: user._id, usedAt: null }); // only the newest link works
  const token = randomBytes(32).toString('base64url');
  await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) });
  await queueMail(resetEmail(email, `${appUrl()}/reset-password?token=${token}`));
  return token;
}

export async function resetPassword(token: string, password: string) {
  const row = await PasswordResetToken.findOne({ tokenHash: sha256(token) });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw unauth('INVALID_RESET', 'This reset link is invalid or has expired');
  const claimed = await PasswordResetToken.updateOne({ _id: row._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!claimed.modifiedCount) throw unauth('INVALID_RESET', 'This reset link is invalid or has expired');
  // Receiving the reset email also proves ownership of the address.
  await User.updateOne({ _id: row.userId }, { $set: { passwordHash: await hash(password, ARGON) } });
  await User.updateOne({ _id: row.userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { $set: { revokedAt: new Date() } }); // sign out everywhere
}

export async function changePassword(userId: string, current: string, next: string) {
  const u = await User.findById(toId(userId));
  if (!u || !(await verify(u.passwordHash, current))) throw bad('WRONG_PASSWORD', 'Your current password is incorrect');
  if (current === next) throw bad('SAME_PASSWORD', 'Choose a different password');
  u.passwordHash = await hash(next, ARGON); await u.save();
  await RefreshToken.updateMany({ userId: u._id, revokedAt: null }, { $set: { revokedAt: new Date() } }); // other devices must sign in again
}
