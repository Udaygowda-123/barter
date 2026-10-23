import { randomUUID } from 'crypto';
import sharp, { Metadata, OutputInfo } from 'sharp';
import { LocalSharpProvider } from './enhance';
import { HttpError, bad, forbidden, notFound } from './http';
import { Image, ImageDoc } from './models';
import * as storage from './storage';
import { toId } from './util';

/** Vercel functions accept ≤ 4.5 MB request bodies, so the browser compresses before upload; this is the server-side cap. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff', 'bmp']); // SVG is deliberately not accepted
const provider = new LocalSharpProvider();

export type ImageLean = Pick<ImageDoc, '_id' | 'listingId' | 'originalKey' | 'enhancedKey' | 'thumbKey' | 'useEnhanced' | 'isCover' | 'position' | 'altText' | 'width' | 'height' | 'processingStatus' | 'processingError'> & { aiEdited?: boolean };

export function imageDto(img: ImageLean) {
  const display = img.useEnhanced && img.enhancedKey ? img.enhancedKey : img.originalKey;
  return {
    id: String(img._id), position: img.position, isCover: img.isCover, status: img.processingStatus, error: img.processingError,
    aiEdited: img.useEnhanced && !!img.enhancedKey, useEnhanced: img.useEnhanced, width: img.width, height: img.height, altText: img.altText,
    url: storage.url(display), thumbUrl: storage.url(img.thumbKey), originalUrl: storage.url(img.originalKey), enhancedUrl: storage.url(img.enhancedKey),
  };
}

/** Validates by decoding (not by mime/extension), strips metadata by re-encoding, and builds thumb + enhanced versions. */
export async function uploadImage(userId: string, file: Buffer) {
  if (!file?.length) throw bad('NO_FILE', 'Choose an image to upload');
  if (file.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'FILE_TOO_LARGE', 'Images must be under 4 MB');
  let meta: Metadata;
  try { meta = await sharp(file, { limitInputPixels: 50_000_000 }).metadata(); } catch { throw bad('INVALID_IMAGE', 'That file is not a readable image. HEIC photos are converted in your browser — if you see this, export the photo as JPEG.'); }
  if (!meta.format || !ALLOWED.has(meta.format)) throw bad('UNSUPPORTED_IMAGE_TYPE', meta.format === 'heif' || !meta.format ? 'This photo format is not supported. Export it as JPEG or PNG and try again.' : 'This image type is not supported. Use JPEG, PNG, HEIC or WebP.');
  if ((await Image.countDocuments({ uploaderId: toId(userId), listingId: null })) >= 30) throw bad('TOO_MANY_PENDING', 'Attach or remove unused photos first');

  let original: { data: Buffer; info: OutputInfo }; let thumb: Buffer; let enhanced: Buffer | null;
  try {
    original = await sharp(file).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    [thumb, enhanced] = await Promise.all([
      sharp(original.data).resize({ width: 480, height: 600, fit: 'cover' }).webp({ quality: 78 }).toBuffer(),
      provider.enhance(original.data).then((r) => r.data).catch(() => null),
    ]);
  } catch {
    // e.g. HEVC-encoded HEIC, which the browser normally converts before upload
    throw bad('UNSUPPORTED_IMAGE_TYPE', 'This photo format could not be processed. Export it as JPEG or PNG and try again.');
  }
  const base = `images/${randomUUID()}`;
  const [originalKey, thumbKey, enhancedKey] = await Promise.all([
    storage.put(`${base}/original.webp`, original.data, 'image/webp'), storage.put(`${base}/thumb.webp`, thumb, 'image/webp'),
    enhanced ? storage.put(`${base}/enhanced.webp`, enhanced, 'image/webp') : Promise.resolve(null),
  ]);
  const doc = await Image.create({
    uploaderId: toId(userId), originalKey, thumbKey, enhancedKey, width: original.info.width, height: original.info.height,
    processingStatus: enhanced ? 'READY' : 'FAILED', processingError: enhanced ? null : 'Enhancement unavailable — you can still use your original photo.',
  });
  return imageDto(doc.toObject());
}

export async function getImage(userId: string | undefined, id: string) {
  const img = await Image.findById(toId(id)).lean();
  if (!img) throw notFound('IMAGE_NOT_FOUND', 'Image not found');
  if (!img.listingId && String(img.uploaderId) !== userId) throw forbidden('FORBIDDEN', 'Not your image');
  return imageDto(img);
}

export async function chooseImage(userId: string, id: string, useEnhanced: boolean) {
  const img = await Image.findById(toId(id));
  if (!img) throw notFound('IMAGE_NOT_FOUND', 'Image not found');
  if (String(img.uploaderId) !== userId) throw forbidden('FORBIDDEN', 'Not your image');
  if (useEnhanced && !img.enhancedKey) throw bad('NOT_ENHANCED', 'The enhanced version is not ready');
  img.useEnhanced = useEnhanced; await img.save();
  return imageDto(img.toObject());
}

export async function discardImage(userId: string, id: string) {
  const img = await Image.findById(toId(id));
  if (!img) return;
  if (String(img.uploaderId) !== userId) throw forbidden('FORBIDDEN', 'Not your image');
  if (img.listingId) throw bad('ATTACHED', 'Remove the photo by editing the listing');
  await img.deleteOne();
}
