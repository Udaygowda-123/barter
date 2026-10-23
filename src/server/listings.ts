import { CATEGORIES } from '@/shared/types';
import type { createListingSchema, listingQuerySchema, updateListingSchema } from '@/shared/validation';
import type { QueryFilter as FilterQuery } from 'mongoose';
import type { z } from 'zod';
import type { AuthUser } from './auth-core';
import { withTx } from './db';
import { HttpError, bad, conflict, forbidden, notFound } from './http';
import { Dismissal, Favorite, Image, Listing, ListingDoc, ProhibitedTerm, User } from './models';
import { closeOffersForListings } from './offers';
import { blockedIds } from './users';
import { decodeCursor, encodeCursor, escapeRegex, sid, toId } from './util';
import { listingViews } from './views';

void CATEGORIES;
const hidden = ['REMOVED', 'UNDER_REVIEW'];

async function assertAllowedContent(...texts: (string | null | undefined)[]) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase();
  if (!hay) return;
  const terms = await ProhibitedTerm.find().select('term').lean();
  if (terms.some((t) => hay.includes(t.term.toLowerCase()))) throw new HttpError(422, 'PROHIBITED_ITEM', 'This item type is not allowed on SWAPD');
}
const assertCanPost = (u: AuthUser) => { if (u.status !== 'ACTIVE') throw forbidden('ACCOUNT_RESTRICTED', 'Your account is restricted from posting'); };
async function isStaff(userId?: string) { if (!userId) return false; const u = await User.findById(toId(userId)).select('role').lean(); return u?.role === 'ADMIN' || u?.role === 'MODERATOR'; }

async function attachImages(listingId: unknown, userId: string, imageIds: string[], coverId: string | undefined, title: string, replace: boolean) {
  const ids = imageIds.map(toId);
  const existing = replace ? await Image.find({ listingId }).lean() : [];
  const keep = new Set(imageIds);
  const fresh = await Image.find({ _id: { $in: ids }, uploaderId: toId(userId), listingId: null }).lean();
  const kept = existing.filter((e) => keep.has(sid(e._id)));
  if (kept.length + fresh.length !== imageIds.length) throw bad('INVALID_IMAGES', 'One or more photos are missing or already used');
  if (replace) await Image.deleteMany({ listingId, _id: { $nin: ids } });
  const cover = coverId && keep.has(coverId) ? coverId : imageIds[0];
  await Promise.all(imageIds.map((id, position) => Image.updateOne({ _id: toId(id) }, { $set: { listingId, position, isCover: id === cover, altText: `${title} — photo ${position + 1}` } })));
}

export async function createListing(user: AuthUser, input: z.infer<typeof createListingSchema>) {
  assertCanPost(user);
  await assertAllowedContent(input.title, input.description, input.wantedText);
  const { imageIds, coverImageId, ...data } = input;
  const owner = await User.findById(toId(user.id)).select('locationCity locationRegion locationLat locationLng').lean();
  const doc = await Listing.create({ ...data, ownerId: toId(user.id), locationCity: owner?.locationCity ?? null, locationRegion: owner?.locationRegion ?? null, locationLat: owner?.locationLat ?? null, locationLng: owner?.locationLng ?? null });
  try { await attachImages(doc._id, user.id, imageIds, coverImageId, data.title, false); }
  catch (e) { await doc.deleteOne(); throw e; }
  return getListing(sid(doc._id), user.id);
}

export async function getListing(id: string, viewerId?: string) {
  const l = await Listing.findById(toId(id)).lean();
  if (!l) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  const isOwner = viewerId === sid(l.ownerId);
  if (hidden.includes(l.status) && !isOwner && !(await isStaff(viewerId))) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  const [favorited, related, blockedList] = await Promise.all([
    viewerId ? Favorite.exists({ userId: toId(viewerId), listingId: l._id }) : null,
    Listing.find({ _id: { $ne: l._id }, status: 'ACTIVE', category: l.category }).sort({ _id: -1 }).limit(4).lean(),
    viewerId && !isOwner ? blockedIds(viewerId) : [],
  ]);
  if ((blockedList as string[]).includes(sid(l.ownerId))) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  const [[view], relatedViews] = await Promise.all([listingViews([l], viewerId, () => ({ favorited: !!favorited })), listingViews(related, viewerId, () => ({}), { lite: true })]);
  return { ...view, related: relatedViews };
}

export async function listListings(q: z.infer<typeof listingQuerySchema>, viewerId?: string) {
  const blocked = viewerId ? await blockedIds(viewerId) : [];
  if (q.ownerId && blocked.includes(q.ownerId)) return { items: [], pageInfo: { nextCursor: null } }; // blocked people stay hidden even when filtering by owner
  const own = viewerId && q.ownerId === viewerId;
  const and: FilterQuery<ListingDoc>[] = [];
  if (q.q) { const r = new RegExp(escapeRegex(q.q), 'i'); and.push({ $or: [{ title: r }, { description: r }, { wantedText: r }] }); }
  const cur = decodeCursor(q.cursor); if (cur) and.push({ _id: { $lt: cur } });
  const filter: FilterQuery<ListingDoc> = {
    status: q.status ?? { $in: own ? ['ACTIVE', 'RESERVED', 'EXCHANGED', 'UNDER_REVIEW'] : ['ACTIVE', 'RESERVED', 'EXCHANGED'] },
    ...(q.ownerId ? { ownerId: toId(q.ownerId) } : blocked.length ? { ownerId: { $nin: blocked.map(toId) } } : {}),
    ...(q.category ? { category: q.category } : {}), ...(q.condition ? { condition: q.condition } : {}),
    ...(q.city ? { locationCity: new RegExp(`^${escapeRegex(q.city)}$`, 'i') } : {}),
    ...(q.minValue != null || q.maxValue != null ? { estimatedValue: { ...(q.minValue != null ? { $gte: q.minValue } : {}), ...(q.maxValue != null ? { $lte: q.maxValue } : {}) } } : {}),
    ...(and.length ? { $and: and } : {}),
  };
  const rows = await Listing.find(filter).sort({ _id: -1 }).limit(q.limit + 1).lean();
  const items = rows.slice(0, q.limit);
  return { items: await listingViews(items, viewerId, () => ({}), { lite: true }), pageInfo: { nextCursor: rows.length > q.limit ? encodeCursor(items[items.length - 1]._id) : null } };
}

async function owned(id: string, user: AuthUser) {
  const l = await Listing.findById(toId(id));
  if (!l) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  if (sid(l.ownerId) !== user.id) throw forbidden('NOT_OWNER', 'You can only change your own listings');
  return l;
}

export async function updateListing(id: string, user: AuthUser, input: z.infer<typeof updateListingSchema>) {
  const l = await owned(id, user);
  assertCanPost(user);
  if (l.status !== 'ACTIVE') throw conflict('LISTING_LOCKED', 'This listing can no longer be edited');
  await assertAllowedContent(input.title, input.description, input.wantedText);
  const { imageIds, coverImageId, ...data } = input;
  // Offers snapshot terms by listing id; editing text never rewrites an accepted deal.
  Object.assign(l, data, { updatedAt: new Date() }); await l.save();
  if (imageIds) await attachImages(l._id, user.id, imageIds, coverImageId, l.title, true);
  return getListing(id, user.id);
}

/** Soft-delete. Blocked while the item is locked by an active deal; closes open offers that involve it. */
export async function removeListing(id: string, user: AuthUser) {
  const l = await owned(id, user);
  if (['RESERVED', 'EXCHANGED'].includes(l.status)) throw conflict('LISTING_LOCKED', 'This item is part of a deal and cannot be removed');
  await withTx(async (s) => {
    await Listing.updateOne({ _id: l._id }, { $set: { status: 'REMOVED', updatedAt: new Date() } }, { session: s });
    await closeOffersForListings(s, [l._id], { reason: 'listing_removed' });
  });
}

export async function setFavorite(userId: string, listingId: string, on: boolean) {
  const lid = toId(listingId); const uid = toId(userId);
  if (on) {
    const l = await Listing.findById(lid).select('status').lean();
    if (!l || l.status === 'REMOVED') throw notFound('LISTING_NOT_FOUND', 'Listing not found');
    await Favorite.updateOne({ userId: uid, listingId: lid }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  } else await Favorite.deleteOne({ userId: uid, listingId: lid });
  return { favorited: on };
}
export async function favorites(userId: string) {
  const favs = await Favorite.find({ userId: toId(userId) }).sort({ _id: -1 }).limit(100).lean();
  const ls = await Listing.find({ _id: { $in: favs.map((f) => f.listingId) }, status: { $ne: 'REMOVED' } }).lean();
  const order = new Map(favs.map((f, i) => [sid(f.listingId), i]));
  ls.sort((a, b) => order.get(sid(a._id))! - order.get(sid(b._id))!);
  return listingViews(ls, userId, () => ({ favorited: true }), { lite: true });
}
export async function dismissListing(userId: string, listingId: string) {
  const lid = toId(listingId);
  if (!(await Listing.exists({ _id: lid }))) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  await Dismissal.updateOne({ userId: toId(userId), listingId: lid }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { dismissed: true };
}
