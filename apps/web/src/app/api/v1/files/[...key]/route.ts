import { readLocal } from '@/server/storage';

export const runtime = 'nodejs';

/** Dev-only disk driver: serves files written to .uploads. With Vercel Blob configured, URLs point at Blob directly. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const buf = await readLocal((await params).key.join('/'));
  if (!buf) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
