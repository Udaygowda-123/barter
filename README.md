# SWAPD

Your next favorite thing is already out there — a peer-to-peer barter marketplace (item-for-item, bundles, or item + negotiated cash).

**Stack:** one Next.js 15 app (App Router) — UI *and* API (`src/app/api/v1`) — on MongoDB (Mongoose). No separate backend.

```
src/app            pages + the API (src/app/api/v1/[[...path]]/route.ts)
src/server         API logic: models, offers, deals, chat, moderation …
src/shared         Zod schemas + enums/state machines used by UI and API
src/components     UI components      src/lib   client helpers (api, auth, toast)
scripts/           seed.ts, reset-demo.ts, demo-photos/ (credits)
public/demo        demo listing photos
```

## Run locally
```bash
pnpm install
cp .env.example .env.local   # fill MONGODB_URI + JWT_ACCESS_SECRET (the only env file)
pnpm seed                    # optional demo data (use a dev database such as …/swapd_dev, never your live one)
pnpm dev                     # http://localhost:3000
```
Demo logins (after seeding): `maya@swapd.demo`, `arjun@swapd.demo`, `zoya@swapd.demo`, `kabir@swapd.demo` (admin: `admin@swapd.demo`) — password `swapd-demo-pass`.

## Deploy to Vercel
1. Push to GitHub → import in Vercel (framework: Next.js, no Root Directory or custom commands needed).
2. **Environment variables:** `MONGODB_URI`, `JWT_ACCESS_SECRET` (32+ random chars), and for photo uploads either `CLOUDINARY_URL` (Cloudinary → Settings → API Keys → copy the "API environment variable" and replace the placeholders) or `BLOB_READ_WRITE_TOKEN` (Vercel Storage → Blob). Cloudinary wins if both are set.
3. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (Vercel IPs change).

## Tests
`pnpm test` runs 42 API/flow tests (auth, offers & revisions, offer↔chat sync, deals & reviews, listings, security) against an in-memory MongoDB replica set — your real database is never touched. `pnpm typecheck` checks client and server. See [docs/AUDIT.md](docs/AUDIT.md) for the offer/message/deal model and the verification checklist.

## Auth & email
Email + password sign-up, sign-in with rotating refresh tokens, **email verification** (link emailed on sign-up; the profile gets a verified badge), **forgot password** (one-time link, 1 h expiry, only the newest link works, all sessions signed out after a reset), and **change password**. Reset requests are rate-limited (3 per hour per address) and answer identically for unknown addresses.

Emails go through, in order: `RESEND_API_KEY` → `SMTP_*` → console (dev only). Easiest free setup — Gmail:
1. Google Account → Security → turn on **2-Step Verification**, then **App passwords** → create one for "Mail".
2. Set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`, `MAIL_FROM="SWAPD <you@gmail.com>"`.
3. Set `APP_URL` to your site's public URL (links in emails use it, never request headers). On Vercel add all of these under Environment Variables and redeploy.

Gmail limits you to ~500 emails/day, which is fine for a prototype. For a real launch use a domain + Resend/SES so mail doesn't land in spam.

## Performance & caching
- **Server-rendered, cached pages:** item pages (`/listing/[id]`, ISR 60 s, with share-preview metadata) and the first screen of `/discover` (ISR 30 s). The landing hero is server-rendered with CSS-only motion; animated sections load lazily.
- **Debugging:** in `pnpm dev` pages fetch their data from the browser, so every `/api/v1/...` call shows in DevTools → Network (Fetch/XHR). Server-rendered first loads only apply to production builds.
- **API caching:** anonymous reads of public data (`?public=1`, added automatically by the client when signed out) send `s-maxage=30, stale-while-revalidate=300`; everything personalised is `private, no-store`. Static demo photos are `immutable`.
- **Lean payloads:** feeds return only what cards need (≈25 % smaller); `/auth/*` returns the user, saving a round trip; one 15 s `/pulse` request drives badges and toasts; open chat threads fetch only messages newer than the last one (`?after=`).
- **Database:** indexes are synced once per schema version (`INDEX_VERSION` in `src/server/db.ts`) because Mongoose auto-indexing is off in production; small connection pool for serverless.
- **Type-checking:** `pnpm typecheck` (client + server projects) runs as part of `pnpm build`.

## Notes
- Offer accept/deal changes use MongoDB transactions (Atlas supports them). A unique `ListingLock` index makes it impossible for two active deals to hold one item.
- Chat/notifications update by polling (every 4–10 s) — serverless has no WebSockets.
- Photos: any common image works (HEIC/HEIF from iPhones, JPEG, PNG, WebP, GIF, AVIF, BMP, TIFF). HEIC is converted to JPEG in the browser (decoder loads only when needed), everything is resized and re-encoded to WebP on the server (EXIF/GPS stripped). SVG is intentionally rejected.
- Photos are enhanced (light/colour/framing, never retouching defects) on upload; originals are kept.
- Offers expire lazily when read; no cron needed.
- Cash is only ever a proposal — SWAPD doesn't move money.
