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
pnpm seed                    # optional demo data
pnpm dev                     # http://localhost:3000
```
Demo logins (after seeding): `maya@swapd.demo`, `arjun@swapd.demo`, `zoya@swapd.demo`, `kabir@swapd.demo` (admin: `admin@swapd.demo`) — password `swapd-demo-pass`.

## Deploy to Vercel
1. Push to GitHub → import in Vercel (framework: Next.js, no Root Directory or custom commands needed).
2. **Environment variables:** `MONGODB_URI`, `JWT_ACCESS_SECRET` (32+ random chars), and `BLOB_READ_WRITE_TOKEN` (Storage → Blob → create store; needed for photo uploads in production).
3. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (Vercel IPs change).

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
- Photos are enhanced (light/colour/framing, never retouching defects) on upload; originals are kept.
- Offers expire lazily when read; no cron needed.
- Password-reset emails aren't sent yet (the token is logged in dev).
- Cash is only ever a proposal — SWAPD doesn't move money.
