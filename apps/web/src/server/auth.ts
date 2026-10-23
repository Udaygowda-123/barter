import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'crypto';
import type { LoginInput, RegisterInput } from '@swapd/validation';
import { signAccess } from './auth-core';
import { env } from './config';
import { HttpError, conflict, forbidden } from './http';
import { PasswordResetToken, RefreshToken, User } from './models';
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
  return { user: String(user._id), ...(await issueTokens(String(user._id))) };
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email });
  const ok = user ? await verify(user.passwordHash, input.password) : (await verify(await DUMMY, input.password), false);
  if (!user || !ok) throw unauth('INVALID_CREDENTIALS', 'Email or password is incorrect');
  if (user.status === 'SUSPENDED') throw forbidden('ACCOUNT_SUSPENDED', 'This account has been suspended');
  return { user: String(user._id), ...(await issueTokens(String(user._id))) };
}

export async function refresh(raw: string) {
  const row = await RefreshToken.findOne({ tokenHash: sha256(raw) });
  if (!row) throw unauth('INVALID_REFRESH', 'Please sign in again');
  if (row.revokedAt) { // a rotated token was replayed: assume theft, revoke the family
    await RefreshToken.updateMany({ familyId: row.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw unauth('REFRESH_REUSED', 'Please sign in again');
  }
  if (row.expiresAt < new Date()) throw unauth('REFRESH_EXPIRED', 'Please sign in again');
  const user = await User.findById(row.userId).select('status').lean();
  if (!user || user.status === 'SUSPENDED') throw unauth('ACCOUNT_UNAVAILABLE', 'Please sign in again');
  // Atomic rotate: only one concurrent request can claim this token.
  const claimed = await RefreshToken.updateOne({ _id: row._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!claimed.modifiedCount) throw unauth('REFRESH_REUSED', 'Please sign in again');
  return { user: String(row.userId), ...(await issueTokens(String(row.userId), row.familyId)) };
}

export const logout = async (raw?: string | null) => { if (raw) await RefreshToken.updateOne({ tokenHash: sha256(raw), revokedAt: null }, { $set: { revokedAt: new Date() } }); };

export async function forgotPassword(email: string): Promise<string | null> {
  const user = await User.findOne({ email }).select('_id').lean();
  if (!user) return null;
  const token = randomBytes(32).toString('base64url');
  await PasswordResetToken.create({ userId: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3_600_000) });
  // No mail provider yet: outside production the reset token is printed to the server log.
  if (!env.isProd) console.warn(`[dev email fallback] password reset token for ${email}: ${token}`);
  return token;
}

export async function resetPassword(token: string, password: string) {
  const row = await PasswordResetToken.findOne({ tokenHash: sha256(token) });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw unauth('INVALID_RESET', 'This reset link is invalid or has expired');
  const claimed = await PasswordResetToken.updateOne({ _id: row._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (!claimed.modifiedCount) throw unauth('INVALID_RESET', 'This reset link is invalid or has expired');
  await User.updateOne({ _id: row.userId }, { $set: { passwordHash: await hash(password, ARGON) } });
  await RefreshToken.updateMany({ userId: row.userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
