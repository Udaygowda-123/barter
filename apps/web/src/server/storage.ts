import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/**
 * Storage references kept in the database:
 *  - "https://…"  → Vercel Blob (when BLOB_READ_WRITE_TOKEN is set)
 *  - "/demo/x.webp" → static file shipped in /public (seed data)
 *  - "images/…"   → local dev disk (.uploads), served by /api/v1/files/*
 */
const localDir = () => path.resolve(process.env.MEDIA_LOCAL_DIR ?? '.uploads');

export async function put(key: string, body: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put: blobPut } = await import('@vercel/blob');
    const r = await blobPut(key, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 31536000 });
    return r.url;
  }
  const file = path.join(localDir(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return key;
}

export const url = (ref: string | null) => (!ref ? null : /^https?:\/\//.test(ref) || ref.startsWith('/') ? ref : `/api/v1/files/${ref}`);

export async function readLocal(key: string): Promise<Buffer | null> {
  const root = localDir(); const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) return null; // path traversal guard
  try { return await readFile(file); } catch { return null; }
}
