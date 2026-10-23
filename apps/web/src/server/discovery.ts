import type { Category } from '@swapd/shared-types';
import type { listingQuerySchema } from '@swapd/validation';
import type { FilterQuery } from 'mongoose';
import type { z } from 'zod';
import { Dismissal, Favorite, Listing, ListingDoc, User } from './models';
import { MatchListing, scoreMatch, tokens, Viewer } from './match';
import { blockedIds } from './users';
import { escapeRegex, sid, toId } from './util';
import { listingViews } from './views';

const POOL = 300;
const asMatch = (l: ListingDoc): MatchListing => ({ id: sid(l._id), title: l.title, description: l.description, category: l.category as Category, wantedCategories: l.wantedCategories as Category[], wantedText: l.wantedText,
  estimatedValue: l.estimatedValue, cashFlexibility: l.cashFlexibility as MatchListing['cashFlexibility'], exchangeMethods: l.exchangeMethods as MatchListing['exchangeMethods'], lat: l.locationLat, lng: l.locationLng });

/** Hard rules first (active, not mine, not blocked/dismissed, owner in good standing), then explainable scoring. */
export async function discover(q: z.infer<typeof listingQuerySchema>, viewerId?: string) {
  const offset = Number(q.cursor) || 0;
  const [blocked, dismissed] = viewerId ? await Promise.all([blockedIds(viewerId), Dismissal.find({ userId: toId(viewerId) }).select('listingId').lean()]) : [[], []];
  const suspended = (await User.find({ status: 'SUSPENDED' }).select('_id').lean()).map((u) => u._id);
  const and: FilterQuery<ListingDoc>[] = [];
  if (q.q) { const r = new RegExp(escapeRegex(q.q), 'i'); and.push({ $or: [{ title: r }, { description: r }, { wantedText: r }] }); }
  const filter: FilterQuery<ListingDoc> = {
    status: 'ACTIVE',
    ownerId: { $nin: [...suspended, ...blocked.map(toId), ...(viewerId ? [toId(viewerId)] : [])] },
    ...(dismissed.length ? { _id: { $nin: dismissed.map((d) => d.listingId) } } : {}),
    ...(q.category ? { category: q.category } : {}), ...(q.condition ? { condition: q.condition } : {}),
    ...(q.city ? { locationCity: new RegExp(`^${escapeRegex(q.city)}$`, 'i') } : {}),
    ...(q.minValue != null || q.maxValue != null ? { estimatedValue: { ...(q.minValue != null ? { $gte: q.minValue } : {}), ...(q.maxValue != null ? { $lte: q.maxValue } : {}) } } : {}),
    ...(and.length ? { $and: and } : {}),
  };
  const pool = await Listing.find(filter).sort({ _id: -1 }).limit(POOL).lean();
  let ranked: { l: ListingDoc; match?: ReturnType<typeof scoreMatch> }[] = pool.map((l) => ({ l }));
  if (viewerId) {
    const [me, mine] = await Promise.all([User.findById(toId(viewerId)).lean(), Listing.find({ ownerId: toId(viewerId), status: 'ACTIVE' }).lean()]);
    const consent = me?.preference?.locationConsent ?? false;
    const viewer: Viewer = {
      wantedCategories: [...new Set<Category>([...((me?.preference?.wantedCategories ?? []) as Category[]), ...mine.flatMap((l) => l.wantedCategories as Category[])])],
      wantedText: mine.flatMap((l) => tokens(l.wantedText)), listings: mine.map(asMatch), lat: consent ? me?.locationLat : null, lng: consent ? me?.locationLng : null, maxDistanceKm: me?.preference?.maxDistanceKm,
    };
    ranked = pool.map((l) => ({ l, match: scoreMatch(viewer, asMatch(l)) }));
    ranked.sort((a, b) => b.match!.score - a.match!.score || +b.l.createdAt - +a.l.createdAt);
  }
  const page = ranked.slice(offset, offset + q.limit);
  const matchOf = new Map(page.map((p) => [sid(p.l._id), p.match]));
  const favs = viewerId ? new Set((await Favorite.find({ userId: toId(viewerId), listingId: { $in: page.map((p) => p.l._id) } }).select('listingId').lean()).map((f) => sid(f.listingId))) : new Set<string>();
  const items = await listingViews(page.map((p) => p.l), viewerId, (l) => { const m = matchOf.get(sid(l._id)); return { favorited: favs.has(sid(l._id)), match: m ? { score: m.score, reasons: m.reasons.slice(0, 3) } : null }; });
  return { items, pageInfo: { nextCursor: offset + q.limit < ranked.length ? String(offset + q.limit) : null } };
}
