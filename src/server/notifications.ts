import type { ClientSession } from 'mongoose';
import { Notification } from './models';
import { toId } from './util';

interface Opts { dedupeKey?: string; coalesce?: boolean; session?: ClientSession }

/** Creates a notification. With a dedupeKey, repeats are ignored (or, with `coalesce`, re-surfaced as unread). */
export async function notify(userId: unknown, type: string, payload: Record<string, unknown>, opts: Opts = {}) {
  const userOid = toId(userId); const { session } = opts;
  if (!opts.dedupeKey) { await Notification.create([{ userId: userOid, type, payload }], { session }); return; }
  const where = { userId: userOid, dedupeKey: opts.dedupeKey };
  const existing = await Notification.findOne(where).session(session ?? null).lean();
  if (existing && !opts.coalesce) return;
  if (existing) { await Notification.updateOne(where, { $set: { payload, readAt: null, createdAt: new Date() } }, { session }); return; }
  await Notification.create([{ ...where, type, payload }], { session });
}
