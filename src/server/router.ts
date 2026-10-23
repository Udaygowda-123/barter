import { AuthUser, authenticate } from './auth-core';
import { connectDb } from './db';
import { HttpError, Reply } from './http';
import { IdempotencyKey } from './models';
import { toId } from './util';

export type Access = 'public' | 'user' | 'staff' | 'admin';
export interface Ctx { req: Request; params: Record<string, string>; query: Record<string, string>; user: AuthUser | null; json(): Promise<unknown>; form(): Promise<FormData> }
export interface CacheOpt { sMaxAge: number; swr: number }
export interface Route { method: string; path: string; access: Access; idempotent?: boolean; handler: (c: Ctx & { user: AuthUser }) => Promise<unknown>; handlerPublic?: never }
interface Compiled extends Omit<Route, 'handler'> {
  cache?: CacheOpt; re: RegExp; keys: string[]; handler: (c: Ctx) => Promise<unknown> }

const routes: Compiled[] = [];
export function add(method: string, path: string, access: Access, handler: (c: Ctx & { user: AuthUser }) => Promise<unknown>, opts: { idempotent?: boolean; cache?: CacheOpt } = {}) {
  const keys: string[] = [];
  const re = new RegExp(`^${path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\*$/, '(.*)')}$`);
  routes.push({ method, path, access, re, keys, idempotent: opts.idempotent, cache: opts.cache, handler: handler as Compiled['handler'] });
}
/** Public routes receive `user` when a valid token is sent, else null. */
export const addPublic = (method: string, path: string, handler: (c: Ctx) => Promise<unknown>, opts: { idempotent?: boolean; cache?: CacheOpt } = {}) => add(method, path, 'public', handler as never, opts);

const CODES: Record<number, string> = { 400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED' };

function toResponse(r: unknown): Response {
  if (r instanceof Response) return r;
  const reply = r instanceof Reply ? r : new Reply(r === undefined ? {} : r);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', ...reply.headers });
  for (const c of reply.cookies) headers.append('Set-Cookie', c);
  if (reply.status === 204 || reply.body === null) return new Response(null, { status: reply.status === 200 ? 204 : reply.status, headers });
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(reply.body), { status: reply.status, headers });
}
const errorResponse = (status: number, code: string, message: string, details?: unknown) =>
  new Response(JSON.stringify({ statusCode: status, code, message, ...(details ? { details } : {}) }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function mapError(e: unknown): Response {
  if (e instanceof HttpError) return errorResponse(e.status, e.code || CODES[e.status] || 'ERROR', e.message, e.details);
  const err = e as { code?: number; name?: string; message?: string; errorLabelSet?: Set<string> };
  if (err?.name === 'CastError') return errorResponse(404, 'NOT_FOUND', 'Not found');
  if (err?.code === 11000) return errorResponse(409, 'CONFLICT', 'That already exists or conflicts with current state');
  if (err?.errorLabelSet?.has('TransientTransactionError') || /WriteConflict|write conflict/i.test(err?.message ?? '')) return errorResponse(409, 'CONFLICT', 'Please retry — the data changed at the same moment');
  const name = err?.name ?? ''; const msg = err?.message ?? '';
  if (/ServerSelection|MongoNetwork|MongooseServerSelection/i.test(name) || /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|timed out/i.test(msg)) {
    console.error('[api] database unreachable:', name, msg.slice(0, 300));
    return errorResponse(503, 'DB_UNREACHABLE', 'Cannot reach MongoDB. In Atlas → Network Access allow 0.0.0.0/0 (Vercel IPs change), and check MONGODB_URI.');
  }
  if (/bad auth|Authentication failed|AuthenticationFailed/i.test(msg)) {
    console.error('[api] database auth failed');
    return errorResponse(503, 'DB_AUTH_FAILED', 'MongoDB rejected the username/password in MONGODB_URI.');
  }
  if (/MONGODB_URI is not set|JWT_ACCESS_SECRET must/i.test(msg)) return errorResponse(500, 'CONFIG_MISSING', msg);
  console.error('[api]', e);
  return errorResponse(500, 'INTERNAL', 'Something went wrong', process.env.DEBUG_API_ERRORS === '1' ? [{ path: err?.name ?? 'Error', message: msg.slice(0, 300) }] : undefined);
}

/** The whole API as `Request → Response`, so it is used by the Next route handler and called directly in tests. */
export async function handle(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
    let matched: { route: Compiled; params: Record<string, string> } | null = null; let pathExists = false;
    for (const route of routes) {
      const m = route.re.exec(path); if (!m) continue; pathExists = true;
      if (route.method !== req.method) continue;
      matched = { route, params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; break;
    }
    if (!matched) return pathExists ? errorResponse(405, 'METHOD_NOT_ALLOWED', 'Method not allowed') : errorResponse(404, 'NOT_FOUND', 'Not found');
    const { route, params } = matched;
    await connectDb();
    const user = await authenticate(req);
    if (route.access !== 'public' && !user) return errorResponse(401, 'UNAUTHENTICATED', 'Sign in to continue');
    if (route.access === 'staff' && user!.role === 'USER') throw new HttpError(403, 'FORBIDDEN', 'Not allowed');
    if (route.access === 'admin' && user!.role !== 'ADMIN') throw new HttpError(403, 'FORBIDDEN', 'Not allowed');

    const ctx: Ctx = { req, params, query: Object.fromEntries(url.searchParams), user,
      json: async () => { try { return await req.json(); } catch { return {}; } }, form: () => req.formData() };

    // Replay protection for critical repeated actions.
    const key = route.idempotent && user ? req.headers.get('idempotency-key') : null;
    const idemKey = key && key.length >= 8 && key.length <= 100 ? { userId: toId(user!.id), key, route: `${req.method} ${route.path}:${JSON.stringify(params)}` } : null;
    if (idemKey) {
      const prior = await IdempotencyKey.findOne(idemKey).lean();
      if (prior) return new Response(JSON.stringify(prior.response), { status: prior.statusCode, headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true' } });
    }
    const result = await route.handler(ctx);
    const res = toResponse(result);
    // Anonymous, explicitly-public reads (client adds ?public=1 when it has no token) are CDN-cacheable; everything else is private.
    if (route.cache && req.method === 'GET' && !req.headers.get('authorization') && ctx.query.public === '1' && res.status === 200) {
      res.headers.set('Cache-Control', `public, s-maxage=${route.cache.sMaxAge}, stale-while-revalidate=${route.cache.swr}`);
    }
    res.headers.append('Vary', 'Authorization');
    if (idemKey && res.status < 300 && res.status !== 204) {
      const body = await res.clone().json().catch(() => ({}));
      await IdempotencyKey.create({ ...idemKey, statusCode: res.status, response: body }).catch(() => undefined);
    }
    return res;
  } catch (e) { return mapError(e); }
}
