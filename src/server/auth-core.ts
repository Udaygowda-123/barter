import { SignJWT, jwtVerify } from 'jose';
import { COOKIE, env } from './config';
import { connectDb } from './db';
import { HttpError } from './http';
import { RateLimit, User } from './models';

export interface AuthUser { id: string; role: 'USER' | 'MODERATOR' | 'ADMIN'; status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' }

export const signAccess = (userId: string) => new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime(`${env.accessTtl}s`).sign(env.jwtSecret);

/** Verifies the bearer token, then re-reads role/status from the DB so restrictions and role changes apply immediately. */
export async function authenticate(req: Request): Promise<AuthUser | null> {
  const h = req.headers.get('authorization');
  if (!h?.startsWith('Bearer ')) return null;
  let sub: string;
  try { sub = (await jwtVerify(h.slice(7), env.jwtSecret)).payload.sub ?? ''; } catch { return null; }
  await connectDb();
  const u = await User.findById(sub).select('role status').lean().catch(() => null);
  if (!u || u.status === 'SUSPENDED') return null;
  return { id: String(u._id), role: u.role, status: u.status };
}

export const readCookie = (req: Request, name = COOKIE) => req.headers.get('cookie')?.split(/;\s*/).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
export const setRefreshCookie = (token: string) => `${COOKIE}=${token}; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=${env.refreshDays * 86400}${env.isProd ? '; Secure' : ''}`;
export const clearRefreshCookie = () => `${COOKIE}=; Path=/api/v1/auth; HttpOnly; SameSite=Lax; Max-Age=0${env.isProd ? '; Secure' : ''}`;

/** Fixed-window limiter stored in Mongo so it works across serverless instances. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  await connectDb();
  const max = limit * env.rateScale;
  const now = new Date();
  const doc = await RateLimit.findOneAndUpdate({ key, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { returnDocument: 'after' }).lean();
  if (doc) { if (doc.count > max) throw new HttpError(429, 'RATE_LIMITED', 'Too many requests — slow down and try again shortly'); return; }
  try { await RateLimit.findOneAndUpdate({ key }, { $set: { count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) } }, { upsert: true }); }
  catch { /* concurrent upsert: another request created the window */ }
}
export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
