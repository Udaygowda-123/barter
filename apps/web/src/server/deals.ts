import { DEAL_TRANSITIONS, canTransition, type DealStatus } from '@swapd/shared-types';
import type { ClientSession } from 'mongoose';
import type { AuthUser } from './auth-core';
import { addEventMessage } from './chat';
import { withTx } from './db';
import { bad, conflict, forbidden, notFound } from './http';
import { Deal, DealDoc, Listing, ListingLock, Offer, Report, Review, User } from './models';
import { notify } from './notifications';
import { sid, toId } from './util';
import { listingBriefs, userBrief } from './views';

async function loadForParty(id: string, userId: string) {
  const d = await Deal.findById(toId(id)).lean();
  if (!d || (sid(d.userAId) !== userId && sid(d.userBId) !== userId)) throw notFound('DEAL_NOT_FOUND', 'Deal not found');
  return d;
}
const other = (d: DealDoc, userId: string) => (sid(d.userAId) === userId ? d.userBId : d.userAId);

export async function dealViews(deals: DealDoc[], viewerId: string) {
  if (!deals.length) return [];
  const offers = new Map((await Offer.find({ _id: { $in: deals.map((d) => d.offerId) } }).lean()).map((o) => [sid(o._id), o]));
  const briefs = await listingBriefs(deals.flatMap((d) => d.listingIds));
  const users = new Map((await User.find({ _id: { $in: deals.map((d) => other(d, viewerId)) } }).select('displayName avatarUrl').lean()).map((u) => [sid(u._id), u]));
  const reviews = await Review.find({ dealId: { $in: deals.map((d) => d._id) } }).lean();
  return deals.map((d) => {
    const o = offers.get(sid(d.offerId)); const rev = o?.revisions.find((r) => r.number === d.acceptedRevisionNo);
    const isA = viewerId === sid(d.userAId); const items = [...(rev?.offeredListingIds ?? []), ...(rev?.requestedListingIds ?? [])].map((id) => briefs.get(sid(id))).filter(Boolean) as ReturnType<typeof briefs.get>[];
    const mine = reviews.find((r) => sid(r.dealId) === sid(d._id) && sid(r.authorId) === viewerId); const theirs = reviews.find((r) => sid(r.dealId) === sid(d._id) && sid(r.authorId) !== viewerId);
    const rv = (r?: typeof mine) => (r ? { id: sid(r._id), rating: r.rating, body: r.body, createdAt: r.createdAt } : null);
    const cp = users.get(sid(other(d, viewerId)));
    return {
      id: sid(d._id), offerId: sid(d.offerId), status: d.status, createdAt: d.createdAt, completedAt: d.completedAt, conversationId: o?.conversationId ? sid(o.conversationId) : null,
      counterpart: cp ? userBrief(cp) : { id: sid(other(d, viewerId)), displayName: 'Unknown', avatarUrl: null },
      terms: { revisionNumber: d.acceptedRevisionNo, cashAmount: rev?.cashAmount ?? 0, currency: rev?.currency ?? 'INR', cashPayerId: rev?.cashPayerId ? sid(rev.cashPayerId) : null, message: rev?.message ?? null,
        giving: items.filter((i) => i!.ownerId === viewerId), receiving: items.filter((i) => i!.ownerId !== viewerId) },
      handover: { method: d.handoverMethod, notes: d.handoverNotes, confirmedByMe: !!(isA ? d.handoverConfirmedByA : d.handoverConfirmedByB), confirmedByOther: !!(isA ? d.handoverConfirmedByB : d.handoverConfirmedByA) },
      completion: { confirmedByMe: !!(isA ? d.completedByA : d.completedByB), confirmedByOther: !!(isA ? d.completedByB : d.completedByA) },
      cancellation: d.status === 'CANCELLED' ? { byMe: sid(d.cancelledById) === viewerId, reason: d.cancelReason } : null,
      dispute: d.status === 'DISPUTED' ? { byMe: sid(d.disputedById) === viewerId, reason: d.disputeReason } : null,
      reviews: { mine: rv(mine), theirs: rv(theirs), canReview: d.status === 'COMPLETED' && !mine },
    };
  });
}

export async function listDeals(userId: string) {
  const uid = toId(userId);
  return dealViews(await Deal.find({ $or: [{ userAId: uid }, { userBId: uid }] }).sort({ _id: -1 }).limit(50).lean(), userId);
}
export async function getDeal(id: string, userId: string) { return (await dealViews([await loadForParty(id, userId)], userId))[0]; }

/** Bumping lockVersion first makes concurrent writers on one deal conflict, so the driver retries them one at a time. */
async function serialize(session: ClientSession, id: unknown) {
  const d = await Deal.findOneAndUpdate({ _id: id }, { $inc: { lockVersion: 1 } }, { session, returnDocument: 'after' }).lean();
  if (!d) throw notFound('DEAL_NOT_FOUND', 'Deal not found');
  return d;
}
const event = async (s: ClientSession, d: DealDoc, text: string) => { const o = await Offer.findById(d.offerId).select('conversationId').session(s).lean(); if (o?.conversationId) await addEventMessage(s, o.conversationId, 'SYSTEM', text, null); };
const releaseLocks = (s: ClientSession, d: DealDoc) => ListingLock.deleteMany({ dealId: d._id }, { session: s });

export async function setHandover(user: AuthUser, id: string, input: { method: string; notes?: string }) {
  await loadForParty(id, user.id);
  await withTx(async (s) => {
    const d = await serialize(s, toId(id));
    if (d.status !== 'ACTIVE') throw conflict('DEAL_NOT_ACTIVE', 'This deal is no longer active');
    // Changing the plan clears earlier agreement so nobody confirms something they have not seen.
    await Deal.updateOne({ _id: d._id }, { $set: { handoverMethod: input.method, handoverNotes: input.notes ?? null, handoverConfirmedByA: null, handoverConfirmedByB: null } }, { session: s });
    await event(s, d, `Handover plan updated: ${input.method === 'SHIPPING' ? 'shipping' : 'local meet-up'}.`);
  });
  return getDeal(id, user.id);
}

export async function confirmHandover(user: AuthUser, id: string) {
  const d = await loadForParty(id, user.id);
  if (d.status !== 'ACTIVE') throw conflict('DEAL_NOT_ACTIVE', 'This deal is no longer active');
  if (!d.handoverMethod) throw bad('NO_HANDOVER_PLAN', 'Agree a handover plan first');
  const field = sid(d.userAId) === user.id ? 'handoverConfirmedByA' : 'handoverConfirmedByB';
  await Deal.updateOne({ _id: d._id, [field]: null, status: 'ACTIVE' }, { $set: { [field]: new Date() } });
  await notify(other(d, user.id), 'DEAL_UPDATED', { dealId: id, event: 'handover_confirmed' }, { dedupeKey: `deal:${id}:handover:${user.id}` });
  return getDeal(id, user.id);
}

/** One party's confirmation never completes a deal; both must confirm. */
export async function confirmCompletion(user: AuthUser, id: string) {
  const d0 = await loadForParty(id, user.id);
  if (!['ACTIVE', 'DISPUTED'].includes(d0.status)) throw conflict('DEAL_NOT_ACTIVE', 'This deal is no longer active');
  if (!d0.handoverMethod) throw bad('NO_HANDOVER_PLAN', 'Agree a handover plan before confirming');
  const isA = sid(d0.userAId) === user.id;
  await withTx(async (s) => {
    const d = await serialize(s, d0._id);
    if (!['ACTIVE', 'DISPUTED'].includes(d.status)) throw conflict('DEAL_NOT_ACTIVE', 'This deal is no longer active');
    const now = new Date(); const a = d.completedByA ?? (isA ? now : null); const b = d.completedByB ?? (!isA ? now : null);
    await Deal.updateOne({ _id: d._id }, { $set: { completedByA: a, completedByB: b } }, { session: s });
    if (!a || !b) {
      await notify(other(d, user.id), 'DEAL_UPDATED', { dealId: id, event: 'completion_requested' }, { dedupeKey: `deal:${id}:completion:${user.id}`, session: s });
      return event(s, d, 'One person has confirmed the swap is complete. Waiting for the other.');
    }
    if (!canTransition(DEAL_TRANSITIONS, d.status as DealStatus, 'COMPLETED')) throw conflict('INVALID_TRANSITION', 'Invalid deal state');
    await Deal.updateOne({ _id: d._id }, { $set: { status: 'COMPLETED', completedAt: now } }, { session: s });
    await Listing.updateMany({ _id: { $in: d.listingIds } }, { $set: { status: 'EXCHANGED', updatedAt: now } }, { session: s });
    await releaseLocks(s, d);
    for (const uid of [d.userAId, d.userBId]) await notify(uid, 'DEAL_UPDATED', { dealId: id, event: 'completed' }, { dedupeKey: `deal:${id}:completed`, session: s });
    await event(s, d, 'Swap complete! Both of you confirmed. You can now leave a review.');
  });
  return getDeal(id, user.id);
}

export async function cancelDeal(user: AuthUser, id: string, reason: string) {
  await loadForParty(id, user.id);
  await withTx(async (s) => {
    const d = await serialize(s, toId(id));
    if (!canTransition(DEAL_TRANSITIONS, d.status as DealStatus, 'CANCELLED')) throw conflict('INVALID_TRANSITION', `A ${d.status.toLowerCase()} deal cannot be cancelled`);
    await Deal.updateOne({ _id: d._id }, { $set: { status: 'CANCELLED', cancelledById: toId(user.id), cancelReason: reason } }, { session: s });
    await Listing.updateMany({ _id: { $in: d.listingIds }, status: 'RESERVED' }, { $set: { status: 'ACTIVE', updatedAt: new Date() } }, { session: s }); // release items
    await releaseLocks(s, d);
    await notify(other(d, user.id), 'DEAL_UPDATED', { dealId: id, event: 'cancelled' }, { dedupeKey: `deal:${id}:cancelled`, session: s });
    await event(s, d, 'This deal was cancelled. The items are available again.');
  });
  return getDeal(id, user.id);
}

/** Opens a dispute and files a moderation report so staff can review it. */
export async function disputeDeal(user: AuthUser, id: string, reason: string) {
  await loadForParty(id, user.id);
  await withTx(async (s) => {
    const d = await serialize(s, toId(id));
    if (!canTransition(DEAL_TRANSITIONS, d.status as DealStatus, 'DISPUTED')) throw conflict('INVALID_TRANSITION', `A ${d.status.toLowerCase()} deal cannot be disputed`);
    await Deal.updateOne({ _id: d._id }, { $set: { status: 'DISPUTED', disputedById: toId(user.id), disputeReason: reason } }, { session: s });
    await Report.create([{ reporterId: toId(user.id), targetType: 'USER', targetId: sid(other(d, user.id)), reason: 'Deal dispute', details: `Deal ${id}: ${reason}` }], { session: s });
    await notify(other(d, user.id), 'DEAL_UPDATED', { dealId: id, event: 'disputed' }, { dedupeKey: `deal:${id}:disputed`, session: s });
    await event(s, d, 'A dispute was opened. SWAPD moderators will review this deal.');
  });
  return getDeal(id, user.id);
}

/** Reviews exist only for COMPLETED deals (both parties confirmed), one per participant. */
export async function createReview(user: AuthUser, dealId: string, input: { rating: number; body?: string }) {
  const d = await loadForParty(dealId, user.id);
  if (d.status !== 'COMPLETED') throw forbidden('REVIEW_NOT_ELIGIBLE', 'You can review once both of you have confirmed the swap');
  const subjectId = other(d, user.id);
  try {
    const r = await Review.create({ dealId: d._id, authorId: toId(user.id), subjectId, rating: input.rating, body: input.body ?? null });
    await notify(subjectId, 'REVIEW_RECEIVED', { dealId, reviewId: sid(r._id), rating: input.rating }, { dedupeKey: `review:${sid(r._id)}` });
    return { id: sid(r._id), dealId, authorId: user.id, subjectId: sid(subjectId), rating: r.rating, body: r.body, createdAt: r.createdAt };
  } catch (e) { if ((e as { code?: number }).code === 11000) throw conflict('ALREADY_REVIEWED', 'You already reviewed this swap'); throw e; }
}
