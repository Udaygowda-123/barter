import type { ClientSession } from 'mongoose';
import { bad, forbidden, notFound } from './http';
import { imageDto } from './media';
import { Conversation, Image, Message, MessageDoc, Notification, Offer, User } from './models';
import { notify } from './notifications';
import { sid, toId, uniq } from './util';
import { isBlockedBetween } from './users';
import { listingBriefs, userBrief } from './views';

export async function assertMember(userId: string, conversationId: string) {
  // 404 rather than 403 so conversation ids cannot be probed.
  const c = await Conversation.findOne({ _id: toId(conversationId), 'members.userId': toId(userId) }).lean();
  if (!c) throw notFound('CONVERSATION_NOT_FOUND', 'Conversation not found');
  return c;
}

/** Persists an offer-card / system message inside the caller's transaction. */
export async function addEventMessage(session: ClientSession, conversationId: unknown, type: 'OFFER_CARD' | 'SYSTEM', content: string, senderId: unknown, offer?: { id: unknown; revision: number }) {
  await Message.create([{ conversationId, type, content, senderId: senderId ?? null, offerId: offer?.id ?? null, revisionNumber: offer?.revision ?? null }], { session });
  await Conversation.updateOne({ _id: conversationId }, { $set: { updatedAt: new Date() } }, { session });
}

export async function serializeMessages(rows: MessageDoc[]) {
  const senderIds = rows.map((r) => r.senderId).filter(Boolean);
  const attIds = rows.flatMap((r) => r.attachmentIds);
  const offerIds = rows.map((r) => r.offerId).filter(Boolean);
  const [senders, atts, offers] = await Promise.all([
    User.find({ _id: { $in: uniq(senderIds) } }).select('displayName avatarUrl').lean(),
    attIds.length ? Image.find({ _id: { $in: attIds } }).lean() : [],
    offerIds.length ? Offer.find({ _id: { $in: uniq(offerIds) } }).lean() : [],
  ]);
  const sMap = new Map(senders.map((s) => [sid(s._id), s])); const aMap = new Map(atts.map((a) => [sid(a._id), a])); const oMap = new Map(offers.map((o) => [sid(o._id), o]));
  const briefs = await listingBriefs(offers.flatMap((o) => o.revisions.flatMap((r) => [...r.offeredListingIds, ...r.requestedListingIds])));
  return rows.map((m) => {
    const o = m.offerId ? oMap.get(sid(m.offerId)) : null; const r = o?.revisions.find((x) => x.number === m.revisionNumber);
    return {
      id: sid(m._id), conversationId: sid(m.conversationId), type: m.type, content: m.content, clientId: m.clientId, createdAt: m.createdAt,
      sender: m.senderId && sMap.get(sid(m.senderId)) ? userBrief(sMap.get(sid(m.senderId))!) : null,
      attachments: m.attachmentIds.map((a) => aMap.get(sid(a))).filter(Boolean).map((a) => imageDto(a!)),
      offerRevision: o && r ? {
        id: `${sid(o._id)}:${r.number}`, number: r.number, offerId: sid(o._id), authorId: sid(r.authorId), cashAmount: r.cashAmount, currency: r.currency, cashPayerId: r.cashPayerId ? sid(r.cashPayerId) : null, message: r.message,
        items: [...r.offeredListingIds.map((id) => ({ role: 'OFFERED' as const, id })), ...r.requestedListingIds.map((id) => ({ role: 'REQUESTED' as const, id }))].map((i) => { const b = briefs.get(sid(i.id)); return { role: i.role, listing: { id: sid(i.id), title: b?.title ?? 'Item', ownerId: b?.ownerId ?? '', estimatedValue: b?.estimatedValue ?? null, thumbUrl: b?.thumbUrl ?? null } }; }),
      } : null,
    };
  });
}

export async function listConversations(userId: string) {
  const uid = toId(userId);
  const convs = await Conversation.find({ 'members.userId': uid }).sort({ updatedAt: -1 }).limit(50).lean();
  if (!convs.length) return [];
  const ids = convs.map((c) => c._id);
  const [users, offers, lastMsgs] = await Promise.all([
    User.find({ _id: { $in: uniq(convs.flatMap((c) => c.members.map((m) => m.userId))) } }).select('displayName avatarUrl').lean(),
    Offer.find({ _id: { $in: convs.map((c) => c.offerId).filter(Boolean) } }).select('status targetListingId').lean(),
    Message.aggregate([{ $match: { conversationId: { $in: ids } } }, { $sort: { _id: -1 } }, { $group: { _id: '$conversationId', m: { $first: '$$ROOT' } } }]),
  ]);
  const briefs = await listingBriefs(offers.map((o) => o.targetListingId));
  const uMap = new Map(users.map((u) => [sid(u._id), u])); const oMap = new Map(offers.map((o) => [sid(o._id), o])); const lMap = new Map(lastMsgs.map((l) => [sid(l._id), l.m as MessageDoc]));
  return Promise.all(convs.map(async (c) => {
    const mine = c.members.find((m) => sid(m.userId) === userId)!;
    const unread = await Message.countDocuments({ conversationId: c._id, createdAt: { $gt: mine.lastReadAt }, $or: [{ senderId: { $ne: uid } }, { senderId: null }] });
    const o = c.offerId ? oMap.get(sid(c.offerId)) : null; const lb = o ? briefs.get(sid(o.targetListingId)) : null; const last = lMap.get(sid(c._id));
    return {
      id: sid(c._id), updatedAt: c.updatedAt, unreadCount: unread,
      participants: c.members.filter((m) => sid(m.userId) !== userId).map((m) => uMap.get(sid(m.userId))).filter(Boolean).map((u) => userBrief(u!)),
      lastMessage: last ? { id: sid(last._id), content: last.content, type: last.type, createdAt: last.createdAt, senderId: last.senderId ? sid(last.senderId) : null } : null,
      offer: o ? { id: sid(o._id), status: o.status } : null, listing: lb ? { id: lb.id, title: lb.title, thumbUrl: lb.thumbUrl } : null,
    };
  }));
}

/** `after` lets a polling/reconnecting client fetch only what it missed; `before` pages older history. */
export async function getMessages(userId: string, conversationId: string, opts: { after?: string | null; before?: string | null; limit?: number }) {
  await assertMember(userId, conversationId);
  const cid = toId(conversationId); const limit = Math.min(opts.limit ?? 50, 100);
  const ref = async (id?: string | null) => (id ? (await Message.findOne({ _id: toId(id), conversationId: cid }).select('createdAt').lean())?.createdAt : undefined);
  const [afterAt, beforeAt] = await Promise.all([ref(opts.after), ref(opts.before)]);
  const rows = afterAt
    ? await Message.find({ conversationId: cid, createdAt: { $gt: afterAt } }).sort({ createdAt: 1, _id: 1 }).limit(limit).lean()
    : (await Message.find({ conversationId: cid, ...(beforeAt ? { createdAt: { $lt: beforeAt } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean()).reverse();
  return { items: await serializeMessages(rows), hasMore: rows.length === limit };
}

export async function sendMessage(userId: string, conversationId: string, input: { content: string; clientId?: string; attachmentKeys?: string[] }) {
  const conv = await assertMember(userId, conversationId); const uid = toId(userId);
  const others = conv.members.filter((m) => sid(m.userId) !== userId).map((m) => sid(m.userId));
  for (const o of others) if (await isBlockedBetween(userId, o)) throw forbidden('BLOCKED', 'You cannot message this person');
  const attachmentIds = (input.attachmentKeys ?? []).map(toId);
  if (attachmentIds.length && (await Image.countDocuments({ _id: { $in: attachmentIds }, uploaderId: uid, listingId: null })) !== attachmentIds.length) throw bad('INVALID_ATTACHMENT', 'Attachment not found');
  if (input.clientId) { // idempotent retries
    const dup = await Message.findOne({ conversationId: conv._id, senderId: uid, clientId: input.clientId }).lean();
    if (dup) return (await serializeMessages([dup]))[0];
  }
  let created;
  try { created = await Message.create({ conversationId: conv._id, senderId: uid, type: 'TEXT', content: input.content, clientId: input.clientId ?? null, attachmentIds }); }
  catch (e) { if ((e as { code?: number }).code === 11000) { const dup = await Message.findOne({ conversationId: conv._id, senderId: uid, clientId: input.clientId }).lean(); if (dup) return (await serializeMessages([dup]))[0]; } throw e; }
  await Promise.all([
    Conversation.updateOne({ _id: conv._id }, { $set: { updatedAt: new Date() } }),
    Conversation.updateOne({ _id: conv._id, 'members.userId': uid }, { $set: { 'members.$.lastReadAt': created.createdAt } }),
  ]);
  const me = await User.findById(uid).select('displayName').lean();
  for (const o of others) await notify(o, 'MESSAGE', { conversationId, preview: input.content.slice(0, 80), from: me?.displayName }, { dedupeKey: `msg:${conversationId}`, coalesce: true });
  return (await serializeMessages([created.toObject()]))[0];
}

export async function markRead(userId: string, conversationId: string) {
  await assertMember(userId, conversationId);
  await Conversation.updateOne({ _id: toId(conversationId), 'members.userId': toId(userId) }, { $set: { 'members.$.lastReadAt': new Date() } });
  await Notification.updateOne({ userId: toId(userId), dedupeKey: `msg:${conversationId}`, readAt: null }, { $set: { readAt: new Date() } });
  return { ok: true };
}
