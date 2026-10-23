import { Notification } from './models';
import { decodeCursor, encodeCursor, sid, toId } from './util';

export async function listNotifications(userId: string, cursor?: string, limit = 30) {
  const uid = toId(userId); const cur = decodeCursor(cursor);
  const rows = await Notification.find({ userId: uid, ...(cur ? { _id: { $lt: cur } } : {}) }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const items = rows.slice(0, limit);
  return { items: items.map((n) => ({ id: sid(n._id), type: n.type, payload: n.payload, readAt: n.readAt, createdAt: n.createdAt })), pageInfo: { nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]._id) : null }, unreadCount: await Notification.countDocuments({ userId: uid, readAt: null }) };
}
export async function markNotificationRead(userId: string, id: string) {
  await Notification.updateOne({ _id: toId(id), userId: toId(userId), readAt: null }, { $set: { readAt: new Date() } });
  return { unreadCount: await Notification.countDocuments({ userId: toId(userId), readAt: null }) };
}
export async function markAllRead(userId: string) { await Notification.updateMany({ userId: toId(userId), readAt: null }, { $set: { readAt: new Date() } }); return { unreadCount: 0 }; }
