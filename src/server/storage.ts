import { mkdir, readFile, writeFile } from 'fs/promises';
import { createHash } from 'crypto';
import path from 'path';

/**
 * Storage drivers, first match wins: CLOUDINARY_URL → BLOB_READ_WRITE_TOKEN (Vercel Blob) → local disk (dev).
 * References kept in the database:
 *  - "https://…"  → Cloudinary / Vercel Blob public URL
 *  - "/demo/x.webp" → static file shipped in /public (seed data)
 *  - "images/…"   → local dev disk (.uploads), served by /api/v1/files/*
 */
const localDir = () => path.resolve(process.env.MEDIA_LOCAL_DIR ?? '.uploads');

/** Signed upload straight to Cloudinary's REST API (no SDK). CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME */
async function cloudinaryPut(key: string, body: Buffer): Promise<string> {
  const u = new URL(process.env.CLOUDINARY_URL!);
  const cloud = u.hostname; const apiKey = decodeURIComponent(u.username); const secret = decodeURIComponent(u.password);
  const timestamp = String(Math.floor(Date.now() / 1000)); const publicId = `swapd/${key.replace(/\.\w+$/, '')}`;
  // Signature = sha1 of the sorted params (excluding file/api_key) + secret.
  const signature = createHash('sha1').update(`overwrite=true&public_id=${publicId}&timestamp=${timestamp}${secret}`).digest('hex');
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(body)], { type: 'image/webp' }), 'image.webp');
  for (const [k, v] of Object.entries({ api_key: apiKey, timestamp, public_id: publicId, overwrite: 'true', signature })) form.set(k, v);
  const base = process.env.CLOUDINARY_API_BASE ?? 'https://api.cloudinary.com'; // overridable for tests
  const r = await fetch(`${base}/v1_1/${cloud}/image/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!r.ok || !j.secure_url) throw new Error(`Cloudinary upload failed (${r.status}): ${j.error?.message ?? 'no URL returned'}`);
  return j.secure_url;
}

export async function put(key: string, body: Buffer, contentType: string): Promise<string> {
  if (process.env.CLOUDINARY_URL) return cloudinaryPut(key, body);
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
