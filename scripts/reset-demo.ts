/** Clears all activity (offers, deals, chats, reviews, notifications, non-demo users) and resets demo listings. Run: pnpm tsx scripts/reset-demo.ts */
import mongoose from 'mongoose';
import path from 'path';
try { process.loadEnvFile(path.resolve(process.cwd(), '.env.local')); } catch { /* env provided */ }
import { Conversation, Deal, IdempotencyKey, Listing, ListingLock, Message, Notification, Offer, RateLimit, Review, Report, Block, User, Favorite, Dismissal, RefreshToken } from '../src/server/models';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  await Promise.all([Conversation, Deal, IdempotencyKey, ListingLock, Message, Notification, Offer, RateLimit, Review, Report, Block, Favorite, Dismissal].map((m) => m.deleteMany({})));
  await Listing.deleteMany({ isSeedData: { $ne: true } });
  await Listing.updateMany({ isSeedData: true }, { $set: { status: 'ACTIVE' } });
  await User.deleteMany({ email: { $not: /@swapd\.demo$/ } }); await RefreshToken.deleteMany({});
  console.log('Demo data reset.'); await mongoose.disconnect();
})();
