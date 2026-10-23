# SWAPD audit & flow correction (branch `develop`)

Scope: the offer ↔ message ↔ deal flow, security, and the matching UI. Existing design and features were preserved. Everything below was verified by tests that were actually run (see *Results*).

## 1. Confirmed bugs found (each had a failing test before the fix)
| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | Offers closed *by the system* (item removed / locked by another deal) were labelled **Rejected/Withdrawn**, indistinguishable from a human decision | P1 | New `CANCELLED` offer state + `OFFER_CANCELLED` notification with a reason |
| 2 | Deals kept no snapshot of the accepted terms — only a pointer to the offer revision | P1 | `Deal.snapshot` (revision, cash, payer, message, per-item title/value/photo) written once at acceptance |
| 3 | **Security:** any user could file a report against *any* message id, including conversations they are not in | P0 | Reports on messages require conversation membership |
| 4 | **Security:** `GET /listings?ownerId=<blocked user>` still returned a blocked user's listings | P0 | Blocked owners return an empty page for owner-filtered lists |
| 5 | Chat offer cards showed terms only — no live status, no "superseded", no "your turn" | P1 | Cards carry `offerStatus`, `isCurrentRevision`, `yourTurn`, `dealId`; UI shows badges and links to the deal once accepted |
| 6 | Every new offer created a **new conversation**, even for the same two people and the same item | P1 | One thread per (pair + target item) via a unique `key`; later offers/counters reuse it; the thread points at its latest offer |
| 7 | Item page crashed (`Cannot read properties of undefined`) when opened from a feed card if server data was missing — the card placeholder lacked fields | P1 | Placeholder is normalised with safe defaults |
| 8 | A dead session (deleted/suspended account, rotated secret) left the app polling `pulse` with 401s forever | P1 | The session now ends cleanly: sign-out toast, polling stops (on `main`) |

Other review findings that were **already correct** and are now locked in by tests: server-side ownership validation of every item, turn-taking, optimistic version checks, exact-revision acceptance, idempotent accept (double-click), concurrent-accept race (exactly one deal, DB unique index as backstop), refresh-token reuse detection, client-supplied roles/owners ignored, upload validation by decoding, rate limiting, consent-gated coarse location.

## 2. State model
Offer: `PENDING` (latest revision by sender) ⇄ `COUNTERED` (latest by recipient) → `ACCEPTED | REJECTED | WITHDRAWN | EXPIRED | CANCELLED`. Completion lives on the **deal** (`ACTIVE → COMPLETED | CANCELLED | DISPUTED`). Revisions are append-only (`$push`); acceptance must quote `{expectedVersion, revisionNumber}`. A pending offer does **not** reserve anything — items are reserved atomically at acceptance, and other open offers touching those items are cancelled in the same transaction.

## 3. Files changed (vs `main`)
Backend: `src/server/{offers,chat,deals,listings,moderation,models,db,routes}.ts`, `src/shared/types.ts`.
Frontend: `src/app/(app)/{messages/[id],offers,offers/[id],swap/[id],notifications}/page.tsx`, `src/components/{offers/terms,profile/profile-view}.tsx`, `src/lib/{providers,seed,types}.ts`.
Tests/tooling: `test/*.test.ts`, `vitest.config.ts`, `package.json` (`pnpm test`).

## 4. Database changes (MongoDB — no SQL migrations)
Applied automatically on first connect (`INDEX_VERSION` 4 → 5): unique partial index `Conversation.key`; index `Offer.conversationId`; new fields `Conversation.key`, `Deal.snapshot`; new offer status `CANCELLED`.
Existing data is compatible: older deals without a snapshot fall back to their offer revision; older conversations without a `key` stay as they are and new offers create keyed threads. No data is rewritten or deleted.

## 5. Results (actually executed)
- `pnpm typecheck` — 0 errors (client + server projects).
- `pnpm test` — **42 passed / 42** across 6 files (auth 5, offers 13, sync 6, deals 6, listings 5, security 7). Tests run against a throwaway in-memory MongoDB replica set, never your real database.
- `pnpm build` — compiles.
- Browser walk-through on a phone-sized screen (two signed-in users, dev database): builder wording ("You want" / "You're offering"), explicit cash direction and no-payment note, recipient sees "Your turn" in Offers **and** in the chat card, failed message stays visible with Retry and delivers exactly once, counter keeps the same thread and marks the old card "Superseded", accept names the exact version, both sides then see **Accepted** in Offers/Messages and the card links to the deal. 13/15 scripted checks passed first time; the other two were my script reading the page before it loaded, and were re-verified separately with proper waits (all ✓).

## 6. Environment / manual steps
No new environment variables. Keep local dev on a **separate database** (`…/swapd_dev`) from production (`…/swapd`). Run `pnpm test` before merging.

## 7. Known remaining issues
- Revision immutability and deal-snapshot immutability are enforced by application code (offers are only ever `$push`ed); MongoDB has no trigger equivalent. Tests assert it, the database does not.
- Offer expiry is applied lazily (when read/acted on); there is no scheduled job, so an untouched stale offer keeps its old stored status until someone opens it (lists already *display* it as Expired).
- Chat/notification updates are polling (≈4–15 s), not push.
- No UI yet to list/unblock blocked users (API exists).
- Browser-level (Playwright) tests were run ad hoc, not committed as a suite.
- Cash is only an agreed term; there is deliberately no payment, escrow or "paid" state.

## 8. End-to-end verification checklist
1. Sign in as user A and B (two browsers). A lists an item; B opens it → **Make an offer** → pick items + cash → review → send.
2. B: Offers → *Sent* shows it as Pending. A: Offers → *Received* shows **Your turn**; A's Messages shows the same offer card (Pending, Your turn).
3. A counters (change cash). B's Offers shows **Countered**; the chat has a second card and the first says **Superseded** — same conversation.
4. Type "I accept!" in chat → nothing changes (offer still open, no deal).
5. B opens the offer → **Accept these terms** → dialog names the version → confirm. Both sides see **Accepted**; chat card says **View deal**; items show *In a deal*.
6. Both set/agree a handover plan, then each confirms completion. Only after both → **Completed**; items become *Swapped*; reviews unlock.
7. Remove an item that is in another open offer → that offer shows **Cancelled** for both.
8. Turn off the network, send a chat message → it stays with **Not sent · Retry**; turn it back on → Retry delivers it once.
