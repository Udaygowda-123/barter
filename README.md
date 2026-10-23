# SWAPD

Your next favorite thing is already out there — a peer-to-peer barter marketplace (item-for-item, bundles, or item + negotiated cash).

**Stack:** one Next.js 15 app (App Router) — UI *and* API (`src/app/api/v1`) — on MongoDB (Mongoose). No separate backend.

```
apps/web/src/app          pages + the API route handler (api/v1/[[...path]])
apps/web/src/server       API logic: models, offers, deals, chat, moderation …
packages/validation       Zod schemas shared by UI and API
packages/shared-types     enums + state machines
```

## Run locally
```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill MONGODB_URI + JWT_ACCESS_SECRET (the only env file)
pnpm bootstrap                                 # builds the two small shared packages
pnpm seed                                      # optional demo data
pnpm dev                                       # http://localhost:3000
```
Demo logins (after seeding): `maya@swapd.demo`, `arjun@swapd.demo`, `zoya@swapd.demo`, `kabir@swapd.demo` (admin: `admin@swapd.demo`) — password `swapd-demo-pass`.

## Deploy to Vercel
1. Push to GitHub → import in Vercel. **Root Directory:** `apps/web`.
2. **Build Command:** `cd ../.. && pnpm build` · **Install Command:** `cd ../.. && pnpm install`
3. **Environment variables:** `MONGODB_URI`, `JWT_ACCESS_SECRET` (32+ random chars), and `BLOB_READ_WRITE_TOKEN` (Storage → Blob → create store; needed for photo uploads in production).
4. In MongoDB Atlas → Network Access, allow `0.0.0.0/0` (Vercel IPs change).

## Notes
- Offer accept/deal changes use MongoDB transactions (Atlas supports them). A unique `ListingLock` index makes it impossible for two active deals to hold one item.
- Chat/notifications update by polling (every 4–10 s) — serverless has no WebSockets.
- Photos are enhanced (light/colour/framing, never retouching defects) on upload; originals are kept.
- Offers expire lazily when read; no cron needed.
- Password-reset emails aren't sent yet (the token is logged in dev).
- Cash is only ever a proposal — SWAPD doesn't move money.
