/** Vercel functions accept ≤ 4.5 MB bodies, so photos are normalised in the browser before upload. */
const MAX_DIRECT = 3.5 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.avif,.tif,.tiff,.bmp,.gif';

/** HEIC/HEIF (iPhone photos) detected by MIME, extension, or the "ftyp" brand in the file header. */
async function looksHeic(f: File) {
  if (/image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return true;
  const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
  return String.fromCharCode(...head.slice(4, 8)) === 'ftyp' && /hei[cxms]|mif1|msf1/.test(String.fromCharCode(...head.slice(8, 12)));
}

async function convertHeic(f: File): Promise<File> {
  const heic2any = (await import('heic2any')).default; // ~1 MB decoder, only fetched when a HEIC file is picked
  try {
    const out = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 });
    return new File([Array.isArray(out) ? out[0] : out], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { throw new Error('Could not read this HEIC photo — try exporting it as JPEG'); }
}

/** Any common image in → a JPEG/PNG/WebP under the upload limit out. Throws a readable error if the file can't be read. */
export async function prepareImage(file: File): Promise<File> {
  let f = file;
  if (await looksHeic(f)) f = await convertHeic(f);
  if (/^image\/(jpeg|png|webp)$/.test(f.type) && f.size <= MAX_DIRECT) return f;
  const bmp = await createImageBitmap(f).catch(() => null); // decodes GIF/AVIF/BMP/… and applies EXIF rotation
  if (!bmp) return f; // let the server try (TIFF etc.)
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); // flatten transparency
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height); bmp.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!blob) throw new Error('Could not process this image');
  return new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}
