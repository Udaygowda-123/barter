import { Types } from 'mongoose';
import { notFound } from './http';

export const toId = (v: unknown): Types.ObjectId => {
  if (v instanceof Types.ObjectId) return v;
  if (typeof v === 'string' && Types.ObjectId.isValid(v) && /^[a-f0-9]{24}$/i.test(v)) return new Types.ObjectId(v);
  throw notFound();
};
export const isId = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
export const sid = (v: unknown): string => String(v);
export const sameId = (a: unknown, b: unknown) => String(a) === String(b);
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const encodeCursor = (id: unknown) => Buffer.from(String(id)).toString('base64url');
export const decodeCursor = (c?: string | null) => { if (!c) return null; try { const v = Buffer.from(c, 'base64url').toString(); return /^[a-f0-9]{24}$/i.test(v) ? new Types.ObjectId(v) : null; } catch { return null; } };
export const uniq = <T>(a: T[]) => [...new Set(a.map(String))];
