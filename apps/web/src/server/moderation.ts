import type { ClientSession } from 'mongoose';
import { audit } from './audit';
import type { AuthUser } from './auth-core';
import { withTx } from './db';
import { bad, conflict, forbidden, notFound } from './http';
import { AuditLog, Deal, Listing, ListingLock, Message, ProhibitedTerm, RefreshToken, Report, User } from './models';
import { notify } from './notifications';
import { closeOffersForListings } from './offers';
import { sid, toId } from './util';

export async function report(user: AuthUser, input: { targetType: 'LISTING' | 'USER' | 'MESSAGE'; targetId: string; reason: string; details?: string }) {
  const oid = (() => { try { return toId(input.targetId); } catch { return null; } })();
  const exists = !oid ? false : input.targetType === 'LISTING' ? !!(await Listing.exists({ _id: oid })) : input.targetType === 'USER' ? !!(await User.exists({ _id: oid })) : !!(await Message.exists({ _id: oid }));
  if (!exists) throw notFound('TARGET_NOT_FOUND', 'Nothing to report here');
  if (input.targetType === 'USER' && input.targetId === user.id) throw bad('SELF_REPORT', 'You cannot report yourself');
  const dup = await Report.findOne({ reporterId: toId(user.id), targetType: input.targetType, targetId: input.targetId, status: 'OPEN' }).lean();
  if (dup) return { ...dup, id: sid(dup._id) };
  const r = await Report.create({ reporterId: toId(user.id), ...input });
  return { ...r.toObject(), id: sid(r._id) };
}

export async function listReports(status: string) {
  const rows = await Report.find({ status }).sort({ createdAt: 1 }).limit(100).lean();
  const reporters = new Map((await User.find({ _id: { $in: rows.map((r) => r.reporterId) } }).select('displayName').lean()).map((u) => [sid(u._id), u]));
  return rows.map((r) => ({ ...r, id: sid(r._id), reporter: { id: sid(r.reporterId), displayName: reporters.get(sid(r.reporterId))?.displayName ?? 'Unknown' } }));
}

async function assertCanModerate(actor: AuthUser, targetUserId: string) {
  if (actor.id === targetUserId) throw forbidden('SELF_ACTION', 'You cannot moderate your own account');
  const t = await User.findById(toId(targetUserId)).select('role').lean();
  if (!t) throw notFound('USER_NOT_FOUND', 'User not found');
  if (t.role === 'ADMIN' && actor.role !== 'ADMIN') throw forbidden('FORBIDDEN', 'Only admins can act on admins');
}

export async function setUserStatus(actor: AuthUser, userId: string, status: 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED', note?: string) {
  if (status === 'SUSPENDED' && actor.role !== 'ADMIN') throw forbidden('FORBIDDEN', 'Only admins can suspend accounts');
  await assertCanModerate(actor, userId);
  await withTx(async (s) => {
    await User.updateOne({ _id: toId(userId) }, { $set: { status } }, { session: s });
    if (status === 'SUSPENDED') await RefreshToken.updateMany({ userId: toId(userId), revokedAt: null }, { $set: { revokedAt: new Date() } }, { session: s });
    await audit(actor.id, `user.${status.toLowerCase()}`, 'User', userId, { note }, s);
    await notify(userId, 'MODERATION', { event: `account_${status.toLowerCase()}`, note: note ?? null }, { session: s });
  });
  return { id: userId, status };
}

export async function removeListing(actor: AuthUser, listingId: string, note?: string) {
  await withTx(async (s) => {
    const l = await Listing.findById(toId(listingId)).session(s);
    if (!l) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
    if (l.status === 'RESERVED') throw conflict('LISTING_LOCKED', 'Resolve the active deal first');
    l.status = 'REMOVED'; await l.save({ session: s });
    await closeOffersForListings(s, [l._id], { reason: 'listing_removed' });
    await audit(actor.id, 'listing.remove', 'Listing', listingId, { note }, s);
    await notify(l.ownerId, 'MODERATION', { event: 'listing_removed', listingId, title: l.title, note: note ?? null }, { dedupeKey: `mod:listing:${listingId}:removed`, session: s });
  });
  return { id: listingId, status: 'REMOVED' };
}

async function setListingState(actor: AuthUser, listingId: string, from: string[], to: string, action: string, event: string, note?: string) {
  const l = await Listing.findById(toId(listingId));
  if (!l) throw notFound('LISTING_NOT_FOUND', 'Listing not found');
  if (!from.includes(l.status)) throw conflict('INVALID_STATE', `Only ${from.join(' / ').toLowerCase()} listings can be changed this way`);
  await withTx(async (s) => {
    await Listing.updateOne({ _id: l._id }, { $set: { status: to, updatedAt: new Date() } }, { session: s });
    await audit(actor.id, action, 'Listing', listingId, { note }, s);
    await notify(l.ownerId, 'MODERATION', { event, listingId, title: l.title, note: note ?? null }, { session: s });
  });
  return { id: listingId, status: to };
}
export const restoreListing = (a: AuthUser, id: string, note?: string) => setListingState(a, id, ['REMOVED', 'UNDER_REVIEW'], 'ACTIVE', 'listing.restore', 'listing_restored', note);
export const holdListing = (a: AuthUser, id: string, note?: string) => setListingState(a, id, ['ACTIVE'], 'UNDER_REVIEW', 'listing.hold', 'listing_held', note);

export async function resolveReport(actor: AuthUser, reportId: string, action: string, note?: string) {
  const r = await Report.findById(toId(reportId));
  if (!r) throw notFound('REPORT_NOT_FOUND', 'Report not found');
  if (r.status !== 'OPEN') throw conflict('REPORT_CLOSED', 'This report was already handled');
  const subjectUser = async () => {
    if (r.targetType === 'USER') return r.targetId;
    if (r.targetType === 'LISTING') { const l = await Listing.findById(toId(r.targetId)).select('ownerId').lean(); return l ? sid(l.ownerId) : undefined; }
    const m = await Message.findById(toId(r.targetId)).select('senderId').lean(); return m?.senderId ? sid(m.senderId) : undefined;
  };
  if (action === 'REMOVE_LISTING') {
    if (r.targetType !== 'LISTING') throw bad('INVALID_ACTION', 'Only listing reports can remove a listing');
    await removeListing(actor, r.targetId, note);
  } else if (action === 'RESTRICT_USER' || action === 'SUSPEND_USER') {
    const uid = await subjectUser(); if (!uid) throw bad('NO_USER', 'No user to act on');
    await setUserStatus(actor, uid, action === 'RESTRICT_USER' ? 'RESTRICTED' : 'SUSPENDED', note);
  }
  const status = action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
  await withTx(async (s) => {
    await Report.updateOne({ _id: r._id }, { $set: { status, resolvedById: toId(actor.id), resolvedAt: new Date(), resolution: `${action}${note ? `: ${note}` : ''}` } }, { session: s });
    await audit(actor.id, `report.${action.toLowerCase()}`, 'Report', reportId, { note }, s);
  });
  return { id: reportId, status };
}

/** Staff outcome for a disputed deal. */
export async function resolveDeal(actor: AuthUser, dealId: string, outcome: 'COMPLETED' | 'CANCELLED', note?: string) {
  await withTx(async (s: ClientSession) => {
    const d = await Deal.findOneAndUpdate({ _id: toId(dealId) }, { $inc: { lockVersion: 1 } }, { session: s, returnDocument: 'after' });
    if (!d) throw notFound('DEAL_NOT_FOUND', 'Deal not found');
    if (d.status !== 'DISPUTED') throw conflict('INVALID_TRANSITION', 'Only disputed deals can be resolved by staff');
    const now = new Date();
    if (outcome === 'COMPLETED') Object.assign(d, { status: 'COMPLETED', completedAt: now, completedByA: d.completedByA ?? now, completedByB: d.completedByB ?? now });
    else Object.assign(d, { status: 'CANCELLED', cancelledById: toId(actor.id), cancelReason: `Resolved by moderator${note ? `: ${note}` : ''}` });
    await d.save({ session: s });
    await Listing.updateMany({ _id: { $in: d.listingIds } }, { $set: { status: outcome === 'COMPLETED' ? 'EXCHANGED' : 'ACTIVE', updatedAt: now } }, { session: s });
    await ListingLock.deleteMany({ dealId: d._id }, { session: s });
    await audit(actor.id, `deal.resolve_${outcome.toLowerCase()}`, 'Deal', dealId, { note }, s);
    for (const uid of [d.userAId, d.userBId]) await notify(uid, 'MODERATION', { event: 'deal_resolved', dealId, outcome }, { dedupeKey: `mod:deal:${dealId}`, session: s });
  });
  return { id: dealId, status: outcome };
}

export const listHeld = async () => (await Listing.find({ status: 'UNDER_REVIEW' }).sort({ updatedAt: 1 }).limit(100).select('title ownerId status updatedAt').lean()).map((l) => ({ id: sid(l._id), title: l.title, ownerId: sid(l.ownerId), status: l.status, updatedAt: l.updatedAt }));
export async function listAudit() {
  const rows = await AuditLog.find().sort({ _id: -1 }).limit(200).lean();
  const actors = new Map((await User.find({ _id: { $in: rows.map((r) => r.actorId).filter(Boolean) } }).select('displayName').lean()).map((u) => [sid(u._id), u]));
  return rows.map((r) => ({ id: sid(r._id), actorId: r.actorId ? sid(r.actorId) : null, action: r.action, targetType: r.targetType, targetId: r.targetId, createdAt: r.createdAt, actor: r.actorId ? { id: sid(r.actorId), displayName: actors.get(sid(r.actorId))?.displayName ?? 'Unknown' } : null }));
}
export const listTerms = async () => (await ProhibitedTerm.find().sort({ term: 1 }).lean()).map((t) => ({ id: sid(t._id), term: t.term, reason: t.reason }));
export async function addTerm(actor: AuthUser, term: string, reason?: string) {
  const t = await ProhibitedTerm.findOneAndUpdate({ term: term.toLowerCase() }, { $set: { reason: reason ?? null } }, { upsert: true, returnDocument: 'after' });
  await audit(actor.id, 'prohibited_term.add', 'ProhibitedTerm', t._id, { term });
  return { id: sid(t._id), term: t.term, reason: t.reason };
}
export async function removeTerm(actor: AuthUser, id: string) { await ProhibitedTerm.deleteOne({ _id: toId(id) }); await audit(actor.id, 'prohibited_term.remove', 'ProhibitedTerm', id); }
