/** The API lives in this same Next.js app (src/app/api/v1), so URLs are relative — no env needed. */
export const API_URL = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) { super(message); }
  fieldErrors() { return Object.fromEntries((this.details ?? []).map((d) => [d.path, d.message])); }
}

/** Access token lives in memory only; the refresh token is an httpOnly cookie managed by the API. */
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
let sessionUser: unknown = null; // the user returned alongside a refreshed token (saves a /users/me round-trip)
export const consumeSessionUser = <T,>() => { const u = sessionUser as T | null; sessionUser = null; return u; };
const listeners = new Set<(t: string | null) => void>();
const endListeners = new Set<() => void>();
/** Fired when the server no longer accepts our session (expired refresh, deleted/suspended account, rotated secret). */
export const onSessionEnded = (fn: () => void) => { endListeners.add(fn); return () => { endListeners.delete(fn); }; };
const endSession = () => { setToken(null); endListeners.forEach((l) => l()); };
export const getToken = () => accessToken;
export const setToken = (t: string | null) => { accessToken = t; listeners.forEach((l) => l(t)); };
export const onTokenChange = (fn: (t: string | null) => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export async function refreshSession(): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) { setToken(null); return null; }
      const data = await res.json();
      sessionUser = data.me ?? null;
      setToken(data.accessToken);
      return data.accessToken as string;
    } catch { return null; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

const PUBLIC_READ = /^\/(discover|listings|users\/(?!me)[^/?]+)(\/|\?|$)/;

interface Opts extends Omit<RequestInit, 'body'> { body?: unknown; idempotencyKey?: string; retry?: boolean }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { body, idempotencyKey, retry = true, headers, ...rest } = opts;
  // Anonymous reads of public data are CDN-cacheable; the marker keeps them separate from personalised (private) responses.
  if (!accessToken && (rest.method ?? 'GET') === 'GET' && PUBLIC_READ.test(path) && !path.includes('public=')) path += `${path.includes('?') ? '&' : '?'}public=1`;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest, credentials: 'include',
    headers: {
      ...(body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (res.status === 401 && retry && accessToken && !path.startsWith('/auth/')) {
    const t = await refreshSession();
    if (t) return api<T>(path, { ...opts, retry: false });
    endSession(); // refresh failed → signed out everywhere, stop polling
  } else if (res.status === 401 && !retry && accessToken && !path.startsWith('/auth/')) endSession(); // fresh token still refused (e.g. account deleted)
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? 'Something went wrong', data.details);
  return data as T;
}

export const newIdempotencyKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
