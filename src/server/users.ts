import type { updateProfileSchema } from '@/shared/validation';
import type { z } from 'zod';
import { bad, notFound } from './http';
import { Block, Deal, Listing, Review, User, UserDoc } from './models';
import { toId, sid } from './util';
import { userBrief } from './views';

const round1 = (n: number) => Math.round(n * 10) / 10; // ≈11 km: privacy-safe coordinates

export function meDto(u: UserDoc) {
  const { _id, passwordHash: _p, __v: _v, ...rest } = u as UserDoc & Record<string, unknown>;
  return { ...rest, id: sid(_id), preference: Object.assign({ interests: [], wantedCategories: [], locationConsent: false, maxDistanceKm: null, onboardedAt: null }, u.preference) };
}
export async function me(id: string) { const u = await User.findById(toId(id)).lean(); if (!u) throw notFound(); return meDto(u); }

export async function updateMe(id: string, input: z.infer<typeof updateProfileSchema>) {
  const u = await User.findById(toId(id)); if (!u) throw notFound();
  const { interests, wantedCategories, maxDistanceKm, locationConsent, completeOnboarding, locationLat, locationLng, ...profile } = input;
  const consent = locationConsent ?? u.preference?.locationConsent ?? false;
  if ((locationLat != null || locationLng != null) && !consent) throw bad('LOCATION_CONSENT_REQUIRED', 'Location sharing needs your consent first');
  for (const [k, v] of Object.entries(profile)) if (v !== undefined) (u as unknown as Record<string, unknown>)[k] = v;
  if (locationLat !== undefined) u.locationLat = locationLat === null ? null : round1(locationLat);
  if (locationLng !== undefined) u.locationLng = locationLng === null ? null : round1(locationLng);
  if (consent === false) { u.locationLat = null; u.locationLng = null; } // revoking consent wipes stored coordinates
  const p = u.preference;
  if (interests) p.interests = interests;
  if (wantedCategories) p.wantedCategories = wantedCategories;
  if (maxDistanceKm !== undefined) p.maxDistanceKm = maxDistanceKm;
  if (locationConsent !== undefined) p.locationConsent = locationConsent;
  if (completeOnboarding) p.onboardedAt = new Date();
  await u.save();
  return meDto(u.toObject());
}

/** Public profile: no email, no coordinates. `verified` only when an email was truly verified. */
export async function publicProfile(id: string) {
  const u = await User.findById(toId(id)).lean();
  if (!u || u.status === 'SUSPENDED') throw notFound('USER_NOT_FOUND', 'Profile not found');
  const [agg, completedSwaps, activeListings] = await Promise.all([
    Review.aggregate([{ $match: { subjectId: u._id } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    Deal.countDocuments({ status: 'COMPLETED', $or: [{ userAId: u._id }, { userBId: u._id }] }),
    Listing.countDocuments({ ownerId: u._id, status: 'ACTIVE' }),
  ]);
  return { id: sid(u._id), displayName: u.displayName, bio: u.bio, avatarUrl: u.avatarUrl, locationCity: u.locationCity, locationRegion: u.locationRegion, createdAt: u.createdAt, verified: !!u.emailVerifiedAt,
    stats: { completedSwaps, activeListings, reviewCount: agg[0]?.n ?? 0, averageRating: agg[0]?.avg ?? null } };
}

export async function userReviews(userId: string) {
  const rows = await Review.find({ subjectId: toId(userId) }).sort({ _id: -1 }).limit(50).lean();
  const authors = new Map((await User.find({ _id: { $in: rows.map((r) => r.authorId) } }).select('displayName avatarUrl').lean()).map((a) => [sid(a._id), a]));
  return rows.map((r) => ({ id: sid(r._id), rating: r.rating, body: r.body, createdAt: r.createdAt, dealId: sid(r.dealId), author: authors.get(sid(r.authorId)) ? userBrief(authors.get(sid(r.authorId))!) : null }));
}

export async function block(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw bad('SELF_BLOCK', 'You cannot block yourself');
  if (!(await User.exists({ _id: toId(blockedId) }))) throw notFound();
  await Block.updateOne({ blockerId: toId(blockerId), blockedId: toId(blockedId) }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return { blocked: true };
}
export async function unblock(blockerId: string, blockedId: string) { await Block.deleteOne({ blockerId: toId(blockerId), blockedId: toId(blockedId) }); return { blocked: false }; }

/** Ids of everyone the user has blocked or who blocked the user. */
export async function blockedIds(userId: string): Promise<string[]> {
  const rows = await Block.find({ $or: [{ blockerId: toId(userId) }, { blockedId: toId(userId) }] }).lean();
  return rows.map((r) => (sid(r.blockerId) === userId ? sid(r.blockedId) : sid(r.blockerId)));
}
export async function isBlockedBetween(a: string, b: string) { return !!(await Block.exists({ $or: [{ blockerId: toId(a), blockedId: toId(b) }, { blockerId: toId(b), blockedId: toId(a) }] })); }
