/** Demo data for development/preview. Flagged isSeedData; photos are openly licensed (scripts/demo-photos/credits.json); no fake reviews. Run: pnpm seed */
import { hash } from '@node-rs/argon2';
import { readFileSync } from 'fs';
import mongoose from 'mongoose';
import path from 'path';
try { process.loadEnvFile(path.resolve(__dirname, '../.env.local')); } catch { /* env already provided */ }
import { Image, Listing, ProhibitedTerm, User } from '../src/server/models';

const PASSWORD = 'swapd-demo-pass';
const credits: Record<string, { file: string }[]> = JSON.parse(readFileSync(path.resolve(__dirname, 'demo-photos/credits.json'), 'utf8'));
const photo = (f: string) => `/demo/${f.replace('.jpg', '.webp')}`;

const USERS = [
  { email: 'maya@swapd.demo', displayName: 'Maya (demo)', city: 'Pune', region: 'Maharashtra', lat: 18.5, lng: 73.9 },
  { email: 'arjun@swapd.demo', displayName: 'Arjun (demo)', city: 'Mumbai', region: 'Maharashtra', lat: 19.1, lng: 72.9 },
  { email: 'zoya@swapd.demo', displayName: 'Zoya (demo)', city: 'Bengaluru', region: 'Karnataka', lat: 13.0, lng: 77.6 },
  { email: 'kabir@swapd.demo', displayName: 'Kabir (demo)', city: 'Delhi', region: 'Delhi', lat: 28.6, lng: 77.2 },
];
const ITEMS = [
  { owner: 0, title: 'Retro running sneakers', category: 'SNEAKERS', condition: 'GOOD', value: 4000, wants: 'Wireless headphones or a gaming handheld', cats: ['ELECTRONICS', 'GAMING'] },
  { owner: 0, title: 'Oversized denim jacket', category: 'FASHION', condition: 'LIKE_NEW', value: 1800, wants: 'Vintage tees or sneakers', cats: ['FASHION', 'SNEAKERS'] },
  { owner: 0, title: 'Film camera, 35mm', category: 'HOBBIES', condition: 'GOOD', value: 6500, wants: 'Open to cash plus a lens', cats: ['ELECTRONICS'] },
  { owner: 1, title: 'Noise-cancelling headphones', category: 'ELECTRONICS', condition: 'LIKE_NEW', value: 3000, wants: 'Sneakers, size 9', cats: ['SNEAKERS'] },
  { owner: 1, title: 'Handheld console + 3 games', category: 'GAMING', condition: 'GOOD', value: 7000, wants: 'Camera gear or a bike light', cats: ['HOBBIES', 'ELECTRONICS'] },
  { owner: 1, title: 'Sci-fi paperback set (6)', category: 'BOOKS', condition: 'FAIR', value: 900, wants: 'Graphic novels', cats: ['BOOKS'] },
  { owner: 2, title: 'Limited-run vinyl, sealed', category: 'COLLECTIBLES', condition: 'NEW', value: 2500, wants: 'Other vinyl or a turntable', cats: ['COLLECTIBLES', 'ELECTRONICS'] },
  { owner: 2, title: 'Ceramic desk lamp', category: 'HOME', condition: 'LIKE_NEW', value: 1200, wants: 'Plants or books', cats: ['BOOKS', 'HOME'] },
  { owner: 2, title: 'Mechanical keyboard, 65%', category: 'ELECTRONICS', condition: 'GOOD', value: 3500, wants: 'Gaming gear', cats: ['GAMING'] },
  { owner: 3, title: 'Vintage band tee, size M', category: 'FASHION', condition: 'WORN', value: 800, wants: 'Jackets or caps', cats: ['FASHION'] },
  { owner: 3, title: 'Trading card binder', category: 'COLLECTIBLES', condition: 'GOOD', value: 5000, wants: 'Board games or consoles', cats: ['GAMING', 'HOBBIES'] },
  { owner: 3, title: 'Trail running shoes', category: 'SNEAKERS', condition: 'FAIR', value: 2200, wants: 'Fitness gear', cats: ['HOBBIES'] },
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (.env.local)');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.init(), Listing.init(), ProhibitedTerm.init()]);
  const passwordHash = await hash(PASSWORD);
  const upsertUser = (email: string, data: Record<string, unknown>) => User.findOneAndUpdate({ email }, { $setOnInsert: { email, passwordHash, bio: 'Demo account — seed data, not a real person.', ...data } }, { upsert: true, returnDocument: 'after' });
  await upsertUser('admin@swapd.demo', { displayName: 'SWAPD Admin (demo)', role: 'ADMIN', bio: 'Demo admin account — seed data.', preference: { onboardedAt: new Date() } });
  const users = [];
  for (const u of USERS) users.push(await upsertUser(u.email, { displayName: u.displayName, locationCity: u.city, locationRegion: u.region, locationLat: u.lat, locationLng: u.lng, preference: { locationConsent: true, onboardedAt: new Date() } }));

  let created = 0;
  for (const [i, it] of ITEMS.entries()) {
    const owner = users[it.owner];
    let l = await Listing.findOne({ ownerId: owner._id, title: it.title, isSeedData: true });
    if (!l) {
      l = await Listing.create({ ownerId: owner._id, title: it.title, description: `Demo listing (seed data). ${it.title} in ${it.condition.toLowerCase().replace('_', ' ')} condition — shown only so you can try the app.`,
        category: it.category, condition: it.condition, estimatedValue: it.value, wantedText: it.wants, wantedCategories: it.cats, cashFlexibility: ['EITHER', 'WILL_ADD', 'NONE'][i % 3],
        exchangeMethods: i % 2 ? ['LOCAL_HANDOVER', 'SHIPPING'] : ['LOCAL_HANDOVER'], locationCity: owner.locationCity, locationRegion: owner.locationRegion, locationLat: owner.locationLat, locationLng: owner.locationLng, isSeedData: true });
      created++;
    }
    await Image.deleteMany({ listingId: l._id });
    const files = credits[it.title]?.map((c) => c.file) ?? [];
    await Image.insertMany(files.map((f, n) => ({ listingId: l!._id, uploaderId: owner._id, originalKey: photo(f), thumbKey: photo(f), enhancedKey: null, isCover: n === 0, position: n, processingStatus: 'READY', altText: `${it.title} — demo photo ${n + 1}`, width: 1000, height: 1250 })));
  }
  for (const term of ['firearm', 'ammunition', 'counterfeit', 'stolen', 'illegal drugs', 'fake id']) await ProhibitedTerm.updateOne({ term }, { $setOnInsert: { term, reason: 'Default prohibited category' } }, { upsert: true });
  console.log(`Seeded ${created} new demo listings (${ITEMS.length} total). Demo logins: maya@swapd.demo … admin@swapd.demo / ${PASSWORD}`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
