/** Clears all activity (offers, deals, chats, reviews, notifications, non-demo users) and resets demo listings. Run: pnpm reset-demo --yes (dev databases only) */
import mongoose from 'mongoose';
import path from 'path';
try { process.loadEnvFile(path.resolve(process.cwd(), '.env.local')); } catch { /* env provided */ }
import { Conversation, Deal, IdempotencyKey, Listing, ListingLock, Message, Notification, Offer, RateLimit, Review, Report, Block, User, Favorite, Dismissal, RefreshToken } from '../src/server/models';

/** DANGER: deletes users, listings, offers, chats, deals… Only for a LOCAL/DEV database (name ends with _dev or _test). */
const uri = process.env.MONGODB_URI ?? '';
const dbName = (uri.match(/\/([^/?]+)(\?|$)/) ?? [])[1] ?? '';
if (!/_(dev|test)$/.test(dbName) && !process.argv.includes('--i-understand-this-wipes-everything')) {
  console.error(`Refusing to run: database "${dbName}" doesn't end in _dev or _test, so it might be your LIVE database.\nUse a separate dev database (e.g. .../swapd_dev), or pass --i-understand-this-wipes-everything if you really mean it.`);
  process.exit(1);
}
if (!process.argv.includes('--yes')) { console.error(`This will wipe all activity in "${dbName}". Re-run with --yes to confirm.`); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  await Promise.all([Conversation, Deal, IdempotencyKey, ListingLock, Message, Notification, Offer, RateLimit, Review, Report, Block, Favorite, Dismissal].map((m) => m.deleteMany({})));
  await Listing.deleteMany({ isSeedData: { $ne: true } });
  await Listing.updateMany({ isSeedData: true }, { $set: { status: 'ACTIVE' } });
  await User.deleteMany({ email: { $not: /@swapd\.demo$/ } }); await RefreshToken.deleteMany({});
  console.log('Demo data reset.'); await mongoose.disconnect();
})();
