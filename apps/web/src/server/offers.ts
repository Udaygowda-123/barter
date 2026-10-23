import { Types, type ClientSession } from 'mongoose';
import type { counterOfferSchema, createOfferSchema } from '@swapd/validation';
import type { z } from 'zod';
import type { AuthUser } from './auth-core';
import { env } from './config';
import { addEventMessage } from './chat';
import { connectDb, withTx } from './db';
import { HttpError, bad, conflict, forbidden, notFound } from './http';
import { Conversation, Deal, Listing, ListingLock, Offer, OfferDoc, RevisionDoc, User } from './models';
import { notify } from './notifications';
import { isBlockedBetween } from './users';
import { decodeCursor, encodeCursor, sid, toId, uniq } from './util';
import { listingBriefs, userBrief } from './views';

const OPEN = ['PENDING', 'COUNTERED'];
type Terms = Pick<z.infer<typeof createOfferSchema>, 'offeredListingIds' | 'requestedListingIds' | 'cashAmount' | 'cashPayer' | 'message'>;
const ttl = () => new Date(Date.now() + env.offerTtlHours * 3_600_000);
const closedFields = (status: string) => ({ status, open: false, updatedAt: new Date() });

// ───────── views ─────────

export async function offerViews(offers: OfferDoc[], viewerId: string) {
  if (!offers.length) return [];
  const users = new Map((await User.find({ _id: { $in: uniq(offers.flatMap((o) => [o.senderId, o.recipientId])) } }).select('displayName avatarUrl').lean()).map((u) => [sid(u._id), u]));
  const briefs = await listingBriefs(offers.flatMap((o) => [o.targetListingId, ...o.revisions.flatMap((r) => [...r.offeredListingIds, ...r.requestedListingIds])]));
  const deals = new Map((await Deal.find({ _id: { $in: offers.map((o) => o.dealId).filter(Boolean) } }).select('status').lean()).map((d) => [sid(d._id), d]));
  const brief = (id: unknown) => briefs.get(sid(id)) ?? { id: sid(id), title: 'Removed item', status: 'REMOVED', ownerId: '', category: 'OTHER', estimatedValue: null, thumbUrl: null };
  return offers.map((o) => {
    const expired = OPEN.includes(o.status) && o.expiresAt <= new Date(); const status = expired ? 'EXPIRED' : o.status;
    const latest = o.revisions[o.revisions.length - 1];
    const awaiting = !expired && OPEN.includes(o.status) ? (sid(latest.authorId) === sid(o.senderId) ? sid(o.recipientId) : sid(o.senderId)) : null;
    const s = users.get(sid(o.senderId)); const r = users.get(sid(o.recipientId));
    const deal = o.dealId ? deals.get(sid(o.dealId)) : null;
    return {
      id: sid(o._id), status, version: o.version, expiresAt: o.expiresAt, createdAt: o.createdAt, updatedAt: o.updatedAt,
      sender: s ? userBrief(s) : { id: sid(o.senderId), displayName: 'Unknown', avatarUrl: null }, recipient: r ? userBrief(r) : { id: sid(o.recipientId), displayName: 'Unknown', avatarUrl: null },
      targetListing: brief(o.targetListingId), awaitingUserId: awaiting, yourTurn: awaiting === viewerId,
      conversationId: o.conversationId ? sid(o.conversationId) : null, deal: deal ? { id: sid(deal._id), status: deal.status } : null,
      acceptedRevisionId: o.acceptedRevisionNo ? `${sid(o._id)}:${o.acceptedRevisionNo}` : null,
      revisions: o.revisions.map((rv) => ({
        id: `${sid(o._id)}:${rv.number}`, number: rv.number, authorId: sid(rv.authorId), cashAmount: rv.cashAmount, currency: rv.currency, cashPayerId: rv.cashPayerId ? sid(rv.cashPayerId) : null, message: rv.message, createdAt: rv.createdAt,
        offered: rv.offeredListingIds.map(brief), requested: rv.requestedListingIds.map(brief),
      })),
    };
  });
}

async function load(id: string) { const o = await Offer.findById(toId(id)).lean(); if (!o) throw notFound('OFFER_NOT_FOUND', 'Offer not found'); return o; }
async function loadForParty(id: string, userId: string) {
  const o = await load(id);
  if (sid(o.senderId) !== userId && sid(o.recipientId) !== userId) throw notFound('OFFER_NOT_FOUND', 'Offer not found');
  return o;
}
const latestOf = (o: OfferDoc) => o.revisions[o.revisions.length - 1];
const awaitingOf = (o: OfferDoc) => (sid(latestOf(o).authorId) === sid(o.senderId) ? sid(o.recipientId) : sid(o.senderId));
function assertActive(user: AuthUser) { if (user.status !== 'ACTIVE') throw forbidden('ACCOUNT_RESTRICTED', 'Your account is restricted from making offers'); }
function assertOpen(o: OfferDoc) { if (!OPEN.includes(o.status)) throw conflict('OFFER_CLOSED', `This offer is already ${o.status.toLowerCase()}`); }

/** Server-side ownership + availability validation of every item in a proposal. */
async function validateTerms(senderId: string, recipientId: string, t: Terms) {
  const offered = uniq(t.offeredListingIds); const requested = uniq(t.requestedListingIds);
  if (offered.length !== t.offeredListingIds.length || requested.length !== t.requestedListingIds.length) throw bad('DUPLICATE_ITEMS', 'Each item can only be added once');
  const rows = await Listing.find({ _id: { $in: [...offered, ...requested].map(toId) } }).select('ownerId status').lean();
  const byId = new Map(rows.map((r) => [sid(r._id), r]));
  for (const id of offered) {
    const l = byId.get(id);
    if (!l || sid(l.ownerId) !== senderId) throw forbidden('NOT_YOUR_ITEM', 'You can only offer items you own');
    if (l.status !== 'ACTIVE') throw conflict('ITEM_UNAVAILABLE', 'One of your items is no longer available');
  }
  for (const id of requested) {
    const l = byId.get(id);
    if (!l || sid(l.ownerId) !== recipientId) throw bad('INVALID_REQUESTED_ITEM', 'Requested items must all belong to the other person');
    if (l.status !== 'ACTIVE') throw conflict('ITEM_UNAVAILABLE', 'One of the requested items is no longer available');
  }
  return { offered, requested };
}

function buildRevision(number: number, authorId: string, senderId: string, recipientId: string, t: Terms, ids: { offered: string[]; requested: string[] }): RevisionDoc {
  const payer = t.cashAmount > 0 ? (t.cashPayer === 'ME' ? authorId : authorId === senderId ? recipientId : senderId) : null;
  return { number, authorId: toId(authorId), cashAmount: t.cashAmount, currency: 'INR', cashPayerId: payer ? toId(payer) : null, message: t.message ?? null, offeredListingIds: ids.offered.map(toId), requestedListingIds: ids.requested.map(toId), createdAt: new Date() };
}

// ───────── expiry & closing ─────────

export async function expireOffer(id: unknown) {
  const o = await Offer.findOneAndUpdate({ _id: id, status: { $in: OPEN } }, { $set: closedFields('EXPIRED'), $inc: { version: 1 } }, { returnDocument: 'after' }).lean();
  if (!o) return;
  await withTx(async (s) => {
    for (const uid of [o.senderId, o.recipientId]) await notify(uid, 'OFFER_EXPIRED', { offerId: sid(o._id) }, { dedupeKey: `offer:${sid(o._id)}:expired`, session: s });
    if (o.conversationId) await addEventMessage(s, o.conversationId, 'SYSTEM', 'This offer expired.', null);
  });
}
async function expireIfDue(o: OfferDoc) { if (OPEN.includes(o.status) && o.expiresAt <= new Date()) { await expireOffer(o._id); return true; } return false; }

export async function expireDueOffers() {
  await connectDb();
  const due = await Offer.find({ status: { $in: OPEN }, expiresAt: { $lte: new Date() } }).select('_id').limit(200).lean();
  for (const { _id } of due) await expireOffer(_id).catch(() => undefined);
  return due.length;
}

/** Closes open offers that can no longer be fulfilled (item removed, or locked by another deal). Runs inside the caller's transaction. */
export async function closeOffersForListings(session: ClientSession, listingIds: unknown[], opts: { exceptOfferId?: unknown; reason: 'listing_removed' | 'item_unavailable' }) {
  const ids = uniq(listingIds).map(toId);
  const open = await Offer.find({ open: true, ...(opts.exceptOfferId ? { _id: { $ne: opts.exceptOfferId } } : {}), $or: [{ targetListingId: { $in: ids } }, { 'revisions.offeredListingIds': { $in: ids } }, { 'revisions.requestedListingIds': { $in: ids } }] }).session(session).lean();
  for (const o of open) {
    const senderSide = await Listing.exists({ _id: { $in: ids }, ownerId: o.senderId }).session(session);
    const status = senderSide ? 'WITHDRAWN' : 'REJECTED';
    await Offer.updateOne({ _id: o._id }, { $set: closedFields(status), $inc: { version: 1 } }, { session });
    for (const uid of [o.senderId, o.recipientId]) await notify(uid, status === 'WITHDRAWN' ? 'OFFER_WITHDRAWN' : 'OFFER_REJECTED', { offerId: sid(o._id), reason: opts.reason }, { dedupeKey: `offer:${sid(o._id)}:closed`, session });
    if (o.conversationId) await addEventMessage(session, o.conversationId, 'SYSTEM', 'This offer was closed because an item is no longer available.', null);
  }
}

// ───────── queries ─────────

export async function listOffers(userId: string, q: { box: 'sent' | 'received' | 'all'; status?: string; cursor?: string; limit: number }) {
  const uid = toId(userId);
  const parties = q.box === 'sent' ? { senderId: uid } : q.box === 'received' ? { recipientId: uid } : { $or: [{ senderId: uid }, { recipientId: uid }] };
  const cur = decodeCursor(q.cursor);
  const rows = await Offer.find({ ...parties, ...(q.status ? { status: q.status } : {}), ...(cur ? { _id: { $lt: cur } } : {}) }).sort({ _id: -1 }).limit(q.limit + 1).lean();
  const items = rows.slice(0, q.limit);
  return { items: await offerViews(items, userId), pageInfo: { nextCursor: rows.length > q.limit ? encodeCursor(items[items.length - 1]._id) : null } };
}

export async function getOffer(id: string, userId: string) {
  let o = await loadForParty(id, userId);
  if (await expireIfDue(o)) o = await load(id);
  return (await offerViews([o], userId))[0];
}

// ───────── commands ─────────

export async function createOffer(user: AuthUser, input: z.infer<typeof createOfferSchema>) {
  assertActive(user);
  const target = await Listing.findById(toId(input.requestedListingIds[0])).select('ownerId status').lean();
  if (!target || ['REMOVED', 'UNDER_REVIEW'].includes(target.status)) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  if (sid(target.ownerId) === user.id) throw bad('OWN_LISTING', 'You cannot make an offer on your own item');
  // Same answer as viewing the listing, so a block is never revealed to the blocked person.
  if (await isBlockedBetween(user.id, sid(target.ownerId))) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  const ids = await validateTerms(user.id, sid(target.ownerId), input);
  const offerId = new Types.ObjectId(); const convId = new Types.ObjectId();
  try {
    await withTx(async (s) => {
      await Offer.create([{ _id: offerId, targetListingId: target._id, senderId: toId(user.id), recipientId: target.ownerId, expiresAt: ttl(), conversationId: convId, revisions: [buildRevision(1, user.id, user.id, sid(target.ownerId), input, ids)] }], { session: s });
      await Conversation.create([{ _id: convId, offerId, listingId: target._id, members: [{ userId: toId(user.id) }, { userId: target.ownerId }] }], { session: s });
      await addEventMessage(s, convId, 'OFFER_CARD', 'New offer', user.id, { id: offerId, revision: 1 });
      await notify(target.ownerId, 'OFFER_RECEIVED', { offerId: sid(offerId), revision: 1 }, { dedupeKey: `offer:${sid(offerId)}:rev1`, session: s });
    });
  } catch (e) {
    // Partial unique index: one open offer per sender + target listing.
    if ((e as { code?: number }).code === 11000) throw conflict('OFFER_EXISTS', 'You already have an open offer on this item');
    throw e;
  }
  return getOffer(sid(offerId), user.id);
}

export async function counterOffer(user: AuthUser, id: string, input: z.infer<typeof counterOfferSchema>) {
  assertActive(user);
  const o = await loadForParty(id, user.id);
  if (await expireIfDue(o)) throw new HttpError(410, 'OFFER_EXPIRED', 'This offer has expired');
  assertOpen(o);
  if (awaitingOf(o) !== user.id) throw forbidden('NOT_YOUR_TURN', 'Waiting for the other person to respond');
  if (o.version !== input.expectedVersion) throw conflict('STALE_OFFER', 'This offer changed — refresh and try again');
  if (await isBlockedBetween(sid(o.senderId), sid(o.recipientId))) throw forbidden('BLOCKED', 'You cannot make offers to this person');
  const ids = await validateTerms(sid(o.senderId), sid(o.recipientId), input);
  const latest = latestOf(o); const rev = buildRevision(latest.number + 1, user.id, sid(o.senderId), sid(o.recipientId), input, ids);
  const same = (a: unknown[], b: unknown[]) => a.length === b.length && uniq(a).sort().every((v, i) => v === uniq(b).sort()[i]);
  if (same(ids.offered, latest.offeredListingIds) && same(ids.requested, latest.requestedListingIds) && rev.cashAmount === latest.cashAmount && String(rev.cashPayerId) === String(latest.cashPayerId)) throw bad('NO_CHANGES', 'Change at least one term to counter');
  const other = user.id === sid(o.senderId) ? o.recipientId : o.senderId;
  await withTx(async (s) => {
    // Optimistic concurrency: succeeds only if nobody changed the offer since the client read it.
    const upd = await Offer.findOneAndUpdate({ _id: o._id, version: input.expectedVersion, status: { $in: OPEN } },
      { $set: { status: user.id === sid(o.senderId) ? 'PENDING' : 'COUNTERED', latestRevisionNo: rev.number, expiresAt: ttl(), updatedAt: new Date() }, $inc: { version: 1 }, $push: { revisions: rev } }, { session: s, returnDocument: 'after' });
    if (!upd) throw conflict('STALE_OFFER', 'This offer changed — refresh and try again');
    await notify(other, 'OFFER_COUNTERED', { offerId: sid(o._id), revision: rev.number }, { dedupeKey: `offer:${sid(o._id)}:rev${rev.number}`, session: s });
    if (o.conversationId) await addEventMessage(s, o.conversationId, 'OFFER_CARD', 'Counteroffer', user.id, { id: o._id, revision: rev.number });
  });
  return getOffer(id, user.id);
}

/**
 * Accept = one transaction that (1) locks every item ACTIVE→RESERVED with a conditional update, (2) flips the offer
 * guarded by version + revision, (3) creates the deal and per-item locks (unique index). If a competing deal took
 * any item the transaction aborts, so conflicting deals cannot both succeed.
 */
export async function acceptOffer(user: AuthUser, id: string, input: { expectedVersion: number; revisionNumber: number }) {
  assertActive(user);
  const o = await loadForParty(id, user.id);
  if (await expireIfDue(o)) throw new HttpError(410, 'OFFER_EXPIRED', 'This offer has expired');
  assertOpen(o);
  if (awaitingOf(o) !== user.id) throw forbidden('NOT_YOUR_TURN', 'You cannot accept your own proposal');
  const latest = latestOf(o);
  if (input.revisionNumber !== latest.number || input.expectedVersion !== o.version) throw conflict('REVISION_CHANGED', 'The terms changed — review the latest version before accepting');
  if (await isBlockedBetween(sid(o.senderId), sid(o.recipientId))) throw forbidden('BLOCKED', 'You cannot make offers to this person');
  const listingIds = [...latest.offeredListingIds, ...latest.requestedListingIds];

  try {
    await withTx(async (s) => {
      const locked = await Listing.updateMany({ _id: { $in: listingIds }, status: 'ACTIVE' }, { $set: { status: 'RESERVED', updatedAt: new Date() } }, { session: s });
      if (locked.modifiedCount !== listingIds.length) throw conflict('ITEM_UNAVAILABLE', 'One of the items is no longer available');
      const upd = await Offer.findOneAndUpdate({ _id: o._id, version: o.version, status: { $in: OPEN }, latestRevisionNo: latest.number, expiresAt: { $gt: new Date() } },
        { $set: { ...closedFields('ACCEPTED'), acceptedRevisionNo: latest.number }, $inc: { version: 1 } }, { session: s, returnDocument: 'after' });
      if (!upd) throw conflict('STALE_OFFER', 'This offer changed — refresh and try again');
      const [deal] = await Deal.create([{ offerId: o._id, acceptedRevisionNo: latest.number, userAId: o.senderId, userBId: o.recipientId, listingIds }], { session: s });
      await ListingLock.create(listingIds.map((listingId) => ({ listingId, dealId: deal._id })), { session: s, ordered: true });
      await Offer.updateOne({ _id: o._id }, { $set: { dealId: deal._id } }, { session: s });
      await closeOffersForListings(s, listingIds, { exceptOfferId: o._id, reason: 'item_unavailable' });
      if (o.conversationId) await addEventMessage(s, o.conversationId, 'SYSTEM', `Offer accepted (terms v${latest.number}). A deal has been created.`, null);
      for (const uid of [o.senderId, o.recipientId]) await notify(uid, sid(uid) === sid(latest.authorId) ? 'OFFER_ACCEPTED' : 'DEAL_UPDATED', { offerId: sid(o._id), dealId: sid(deal._id) }, { dedupeKey: `offer:${sid(o._id)}:accepted`, session: s });
    });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw conflict('ITEM_UNAVAILABLE', 'One of the items is no longer available');
    throw e;
  }
  return getOffer(id, user.id);
}

async function closeOffer(user: AuthUser, id: string, expectedVersion: number, as: 'reject' | 'withdraw') {
  const o = await loadForParty(id, user.id);
  if (await expireIfDue(o)) throw new HttpError(410, 'OFFER_EXPIRED', 'This offer has expired');
  assertOpen(o);
  const awaiting = awaitingOf(o);
  // Reject is for the person being asked; withdraw is for the person who made the latest proposal.
  if (as === 'reject' && awaiting !== user.id) throw forbidden('NOT_YOUR_TURN', 'You can only reject a proposal sent to you — withdraw your own instead');
  if (as === 'withdraw' && awaiting === user.id) throw forbidden('NOT_YOUR_TURN', 'You can only withdraw your own proposal — reject this one instead');
  const status = as === 'reject' ? 'REJECTED' : 'WITHDRAWN'; const other = user.id === sid(o.senderId) ? o.recipientId : o.senderId;
  await withTx(async (s) => {
    const upd = await Offer.findOneAndUpdate({ _id: o._id, version: expectedVersion, status: { $in: OPEN } }, { $set: closedFields(status), $inc: { version: 1 } }, { session: s });
    if (!upd) throw conflict('STALE_OFFER', 'This offer changed — refresh and try again');
    await notify(other, as === 'reject' ? 'OFFER_REJECTED' : 'OFFER_WITHDRAWN', { offerId: sid(o._id) }, { dedupeKey: `offer:${sid(o._id)}:closed`, session: s });
    if (o.conversationId) await addEventMessage(s, o.conversationId, 'SYSTEM', as === 'reject' ? 'Offer declined.' : 'Offer withdrawn.', null);
  });
  return getOffer(id, user.id);
}
export const rejectOffer = (u: AuthUser, id: string, v: number) => closeOffer(u, id, v, 'reject');
export const withdrawOffer = (u: AuthUser, id: string, v: number) => closeOffer(u, id, v, 'withdraw');
