import { Types } from 'mongoose';
import { imageDto, type ImageLean } from './media';
import { Image, Listing, ListingDoc, User } from './models';
import { sid, uniq } from './util';

export const userBrief = (u: { _id: unknown; displayName: string; avatarUrl: string | null }) => ({ id: sid(u._id), displayName: u.displayName, avatarUrl: u.avatarUrl });

/** Batch loaders keep list pages to a handful of queries instead of N+1. */
export async function loadUsers(ids: unknown[]) {
  const rows = await User.find({ _id: { $in: uniq(ids) } }).select('displayName avatarUrl locationCity locationRegion emailVerifiedAt status').lean();
  return new Map(rows.map((u) => [sid(u._id), u]));
}
export async function loadImages(listingIds: unknown[]) {
  const rows = await Image.find({ listingId: { $in: uniq(listingIds) } }).sort({ position: 1 }).lean();
  const m = new Map<string, typeof rows>();
  for (const r of rows) { const k = sid(r.listingId); m.set(k, [...(m.get(k) ?? []), r]); }
  return m;
}

const LITE_KEYS = new Set(['title', 'category', 'condition', 'estimatedValue', 'locationCity', 'locationRegion', 'status', 'isSeedData', 'cashFlexibility', 'wantedText']);
const imageLite = (i: ImageLean) => { const d = imageDto(i); return { id: d.id, position: d.position, isCover: d.isCover, aiEdited: d.aiEdited, altText: d.altText, url: d.url, thumbUrl: d.thumbUrl }; };

/** Public listing shape: city/region only, never coordinates. `lite` (feeds/lists) trims descriptions and image fields to what cards need. */
export async function listingViews(docs: ListingDoc[], viewerId?: string, extra: (l: ListingDoc) => Record<string, unknown> = () => ({}), opts: { lite?: boolean } = {}) {
  if (!docs.length) return [];
  const [owners, images] = await Promise.all([loadUsers(docs.map((d) => d.ownerId)), loadImages(docs.map((d) => d._id))]);
  return docs.map((l) => {
    const o = owners.get(sid(l.ownerId));
    const { _id, ownerId, locationLat: _a, locationLng: _b, __v: _v, updatedAt: _u, ...rest } = l as ListingDoc & Record<string, unknown>;
    return {
      ...(opts.lite ? Object.fromEntries(Object.entries(rest).filter(([k]) => LITE_KEYS.has(k))) : rest), id: sid(_id), ownerId: sid(ownerId),
      owner: { id: sid(ownerId), displayName: o?.displayName ?? 'Unknown', avatarUrl: o?.avatarUrl ?? null, locationCity: o?.locationCity ?? null, locationRegion: o?.locationRegion ?? null, verified: !!o?.emailVerifiedAt },
      images: (images.get(sid(_id)) ?? []).map(opts.lite ? imageLite : imageDto), isOwner: viewerId === sid(ownerId), ...extra(l),
    };
  });
}

/** Compact listing used inside offers, deals and chat cards. */
export async function listingBriefs(ids: unknown[]) {
  const unique = uniq(ids);
  const [rows, imgs] = await Promise.all([
    Listing.find({ _id: { $in: unique } }).select('title status ownerId category estimatedValue').lean(),
    Image.find({ listingId: { $in: unique }, isCover: true }).lean(),
  ]);
  const cover = new Map(imgs.map((i) => [sid(i.listingId), i]));
  return new Map(rows.map((l) => [sid(l._id), { id: sid(l._id), title: l.title, status: l.status, ownerId: sid(l.ownerId), category: l.category, estimatedValue: l.estimatedValue, thumbUrl: cover.get(sid(l._id)) ? imageDto(cover.get(sid(l._id))!).thumbUrl : null }]));
}
export { Types };
