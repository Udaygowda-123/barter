import { randomUUID } from 'crypto';
import sharp from 'sharp';
import mongoose from 'mongoose';
import '@/server/routes';
import { handle } from '@/server/router';
import { connectDb } from '@/server/db';
import * as M from '@/server/models';

export { M };
export interface Res<T = any> { status: number; body: T; headers: Headers } // eslint-disable-line @typescript-eslint/no-explicit-any
export interface U { id: string; token: string; refreshToken: string; email: string; password: string; name: string }

/** Calls the real API handler (routing, auth, validation, DB) without a network hop. */
export async function api<T = any>(method: string, path: string, o: { token?: string; body?: unknown; headers?: Record<string, string>; form?: FormData } = {}): Promise<Res<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const headers: Record<string, string> = { ...(o.token ? { authorization: `Bearer ${o.token}` } : {}), ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}), ...o.headers };
  const res = await handle(new Request(`http://localhost/api/v1${path}`, { method, headers, body: o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined) }));
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T, headers: res.headers };
}
export const get = <T = any>(p: string, t?: string) => api<T>('GET', p, { token: t }); // eslint-disable-line @typescript-eslint/no-explicit-any
export const post = <T = any>(p: string, t?: string, body: unknown = {}, headers?: Record<string, string>) => api<T>('POST', p, { token: t, body, headers }); // eslint-disable-line @typescript-eslint/no-explicit-any

export async function setup() { await connectDb(); }
export async function resetDb() { await connectDb(); await mongoose.connection.db!.dropDatabase(); await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes())); }

export async function signUp(name = 'Tester'): Promise<U> {
  const email = `${name.toLowerCase().replace(/\W/g, '')}-${randomUUID().slice(0, 8)}@example.test`; const password = 'correct-horse-battery';
  const r = await post('/auth/register', undefined, { email, password, displayName: name });
  if (r.status !== 201) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
  return { id: r.body.user, token: r.body.accessToken, refreshToken: r.body.refreshToken, email, password, name };
}
export const png = (color = '#c44') => sharp({ create: { width: 640, height: 480, channels: 3, background: color } }).png().toBuffer();
export async function upload(u: U): Promise<string> {
  const form = new FormData(); form.set('file', new Blob([new Uint8Array(await png())], { type: 'image/png' }), 'photo.png');
  const r = await api('POST', '/media/images', { token: u.token, form });
  if (r.status !== 201) throw new Error(`upload failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id;
}
export async function listItem(u: U, o: Record<string, unknown> = {}) {
  const r = await post('/listings', u.token, { title: 'Vintage sneakers', description: 'Worn a few times, small scuff on the left toe.', category: 'SNEAKERS', condition: 'GOOD', estimatedValue: 4000, exchangeMethods: ['LOCAL_HANDOVER'], cashFlexibility: 'EITHER', imageIds: [await upload(u)], ...o });
  if (r.status !== 201) throw new Error(`listing failed ${r.status} ${JSON.stringify(r.body)}`);
  return r.body as { id: string; title: string; status: string };
}
export const offer = (buyer: U, body: Record<string, unknown>, headers?: Record<string, string>) => post('/offers', buyer.token, { offeredListingIds: [], cashAmount: 0, ...body }, headers);
export const makeStaff = (u: U, role: 'ADMIN' | 'MODERATOR' = 'ADMIN') => M.User.updateOne({ _id: u.id }, { $set: { role } });
