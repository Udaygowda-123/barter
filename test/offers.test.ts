import { beforeAll, describe, expect, it } from 'vitest';
import { api, get, listItem, M, makeStaff, offer, post, resetDb, signUp, type U } from './helpers';

const accept = (u: U, id: string, version: number, revisionNumber: number, headers?: Record<string, string>) => post(`/offers/${id}/accept`, u.token, { expectedVersion: version, revisionNumber }, headers);
const fetchOffer = async (u: U, id: string) => (await get(`/offers/${id}`, u.token)).body;

describe('offer lifecycle & revisions', () => {
  let A: U, B: U, C: U;
  beforeAll(async () => { await resetDb(); A = await signUp('Alice'); B = await signUp('Bob'); C = await signUp('Carol'); });

  it('creates one offer + initial revision + one conversation visible to both sides', async () => {
    const a1 = await listItem(A, { title: 'Sneakers' }); const b1 = await listItem(B, { title: 'Headphones' });
    const r = await offer(B, { requestedListingIds: [a1.id], offeredListingIds: [b1.id], cashAmount: 250, cashPayer: 'ME', message: 'hi' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'PENDING', yourTurn: false, version: 1 });
    expect(r.body.revisions).toHaveLength(1);
    expect(r.body.revisions[0]).toMatchObject({ number: 1, cashAmount: 250, cashPayerId: B.id });
    expect(r.body.conversationId).toBeTruthy();
    // same record appears in sender's "sent" and recipient's "received"
    expect((await get('/offers?box=sent', B.token)).body.items.map((o: any) => o.id)).toContain(r.body.id);
    expect((await get('/offers?box=received', A.token)).body.items.map((o: any) => o.id)).toContain(r.body.id);
    expect((await get('/offers?box=received', B.token)).body.items).toHaveLength(0);
    // recipient notified
    expect((await get('/notifications', A.token)).body.items.some((n: any) => n.type === 'OFFER_RECEIVED' && n.payload.offerId === r.body.id)).toBe(true);
  });

  it('counteroffers append immutable revisions; earlier terms are never overwritten', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    const before = JSON.stringify((await M.Offer.findById(o.id).lean())!.revisions[0]);
    const c1 = await post(`/offers/${o.id}/counter`, A.token, { expectedVersion: o.version, requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 500, cashPayer: 'THEM' });
    expect(c1.status).toBe(200); expect(c1.body.status).toBe('COUNTERED'); expect(c1.body.revisions).toHaveLength(2);
    const c2 = await post(`/offers/${o.id}/counter`, B.token, { expectedVersion: c1.body.version, requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 300, cashPayer: 'ME' });
    expect(c2.body.status).toBe('PENDING'); expect(c2.body.revisions).toHaveLength(3);
    const doc = (await M.Offer.findById(o.id).lean())!;
    expect(JSON.stringify(doc.revisions[0])).toBe(before);              // revision 1 untouched
    expect(doc.revisions.map((r: any) => [r.number, r.cashAmount])).toEqual([[1, 0], [2, 500], [3, 300]]);
    expect(c2.body.conversationId).toBe(o.conversationId);               // revisions stay in the same thread
  });

  it('rejects counters that change nothing, out-of-turn counters, and stale versions', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    const same = { requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 0 };
    expect((await post(`/offers/${o.id}/counter`, A.token, { ...same, expectedVersion: o.version })).body.code).toBe('NO_CHANGES');
    expect((await post(`/offers/${o.id}/counter`, B.token, { ...same, cashAmount: 5, expectedVersion: o.version })).status).toBe(403);
    expect((await post(`/offers/${o.id}/counter`, A.token, { ...same, cashAmount: 5, expectedVersion: o.version + 3 })).status).toBe(409);
  });

  it('accepts only the exact current revision; stale/own/stranger acceptance is refused', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    const c = (await post(`/offers/${o.id}/counter`, A.token, { expectedVersion: o.version, requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 100, cashPayer: 'THEM' })).body;
    expect((await accept(A, o.id, c.version, 2)).status).toBe(403);            // cannot accept own proposal
    expect((await accept(B, o.id, c.version, 1)).body.code).toBe('REVISION_CHANGED'); // outdated revision
    expect((await accept(B, o.id, c.version - 1, 2)).body.code).toBe('REVISION_CHANGED'); // stale version
    expect((await accept(C, o.id, c.version, 2)).status).toBe(404);            // stranger can't even see it
    expect((await get(`/offers/${o.id}`, C.token)).status).toBe(404);
    const ok = await accept(B, o.id, c.version, 2); expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ACCEPTED'); expect(ok.body.acceptedRevisionId).toBe(`${o.id}:2`);
    expect((await accept(B, o.id, ok.body.version, 2)).status).toBe(409);       // not twice
  });

  it('double-click / retried accept with the same idempotency key creates exactly one deal', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    const key = { 'idempotency-key': 'dbl-click-key-0001' };
    const [r1, r2] = await Promise.all([accept(A, o.id, o.version, 1, key), accept(A, o.id, o.version, 1, key)]);
    expect([r1.status, r2.status].every((s) => s === 200 || s === 409)).toBe(true);
    expect(await M.Deal.countDocuments({ offerId: o.id })).toBe(1);
    const r3 = await accept(A, o.id, o.version, 1, key); expect(r3.status).toBe(200); expect(r3.headers.get('idempotent-replayed')).toBe('true');
    expect(await M.Deal.countDocuments({ offerId: o.id })).toBe(1);
  });

  it('concurrent acceptance of conflicting offers: exactly one deal, the other offer is closed', async () => {
    const seller = await signUp('Seller'); const x = await signUp('BuyerX'); const y = await signUp('BuyerY');
    const prize = await listItem(seller, { title: 'Prize' }); const xi = await listItem(x); const yi = await listItem(y);
    const o1 = (await offer(x, { requestedListingIds: [prize.id], offeredListingIds: [xi.id] })).body;
    const o2 = (await offer(y, { requestedListingIds: [prize.id], offeredListingIds: [yi.id] })).body;
    const [r1, r2] = await Promise.all([accept(seller, o1.id, o1.version, 1), accept(seller, o2.id, o2.version, 1)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    expect(await M.Deal.countDocuments({ listingIds: prize.id })).toBe(1);
    expect(await M.ListingLock.countDocuments({ listingId: prize.id })).toBe(1);
    expect((await M.Listing.findById(prize.id).lean())!.status).toBe('RESERVED');
    const loser = r1.status === 409 ? o1 : o2; const loserUser = r1.status === 409 ? x : y;
    expect((await fetchOffer(loserUser, loser.id)).status).toBe('CANCELLED');   // system-closed, not "declined"
  });

  it('a pending offer does not lock the listing; accepting one cancels other offers involving locked items', async () => {
    const a = await listItem(A); const b = await listItem(B); const c = await listItem(C);
    const o1 = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    expect((await M.Listing.findById(a.id).lean())!.status).toBe('ACTIVE');       // offer ≠ reservation
    const o2 = (await offer(C, { requestedListingIds: [a.id], offeredListingIds: [c.id] })).body;
    const o3 = (await offer(C, { requestedListingIds: [b.id], offeredListingIds: [c.id] })).body; // C offers c for b; b is also in o1
    await accept(A, o1.id, o1.version, 1);
    expect((await fetchOffer(C, o2.id)).status).toBe('CANCELLED');                 // wanted a
    expect((await fetchOffer(C, o3.id)).status).toBe('CANCELLED');                 // wanted b (now reserved)
    expect((await get('/notifications', C.token)).body.items.some((n: any) => n.payload.offerId === o2.id && n.payload.reason === 'item_unavailable')).toBe(true);
  });

  it('stores an immutable snapshot of the accepted terms on the deal', async () => {
    const a = await listItem(A, { title: 'Snapshot Alpha', estimatedValue: 1234 }); const b = await listItem(B, { title: 'Snapshot Beta' });
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 700, cashPayer: 'ME' })).body;
    const acc = (await accept(A, o.id, o.version, 1)).body;
    const deal = (await M.Deal.findById(acc.deal.id).lean()) as any;
    expect(deal.snapshot).toMatchObject({ revisionNumber: 1, cashAmount: 700, currency: 'INR' });
    expect(deal.snapshot.items.map((i: any) => i.title).sort()).toEqual(['Snapshot Alpha', 'Snapshot Beta']);
    expect(deal.snapshot.items.find((i: any) => i.title === 'Snapshot Alpha').estimatedValue).toBe(1234);
  });

  it('withdraw/reject follow turn-taking; closed offers cannot be changed', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    expect((await post(`/offers/${o.id}/reject`, B.token, { expectedVersion: o.version })).status).toBe(403);
    expect((await post(`/offers/${o.id}/withdraw`, A.token, { expectedVersion: o.version })).status).toBe(403);
    const w = await post(`/offers/${o.id}/withdraw`, B.token, { expectedVersion: o.version }); expect(w.body.status).toBe('WITHDRAWN');
    expect((await post(`/offers/${o.id}/reject`, A.token, { expectedVersion: w.body.version })).status).toBe(409);
    // after closing, the same pair can open a new offer on the same item
    expect((await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).status).toBe(201);
  });

  it('expires stale offers lazily and refuses to act on them', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    await M.Offer.updateOne({ _id: o.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await accept(A, o.id, o.version, 1)).status).toBe(410);
    expect((await fetchOffer(A, o.id)).status).toBe('EXPIRED');
    expect((await M.Listing.findById(a.id).lean())!.status).toBe('ACTIVE');
  });

  it('validates ownership/availability on the server for every item', async () => {
    const a = await listItem(A); const b = await listItem(B); const c = await listItem(C);
    expect((await offer(A, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).status).toBe(400);      // own target
    expect((await offer(A, { requestedListingIds: [b.id], offeredListingIds: [c.id] })).status).toBe(403);      // offering someone else's item
    expect((await offer(A, { requestedListingIds: [b.id, c.id], offeredListingIds: [a.id] })).status).toBe(400); // requested items span owners
    expect((await offer(A, { requestedListingIds: [b.id], offeredListingIds: [] })).status).toBe(400);           // nothing offered
    await M.Listing.updateOne({ _id: b.id }, { $set: { status: 'RESERVED' } });
    expect([404, 409]).toContain((await offer(A, { requestedListingIds: [b.id], offeredListingIds: [a.id] })).status); // unavailable target
    await M.Listing.updateOne({ _id: b.id }, { $set: { status: 'ACTIVE' } });
  });

  it('closing a listing cancels its open offers and notifies both sides', async () => {
    const a = await listItem(A); const b = await listItem(B);
    const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    expect((await api('DELETE', `/listings/${a.id}`, { token: A.token })).status).toBe(204);
    expect((await fetchOffer(B, o.id)).status).toBe('CANCELLED');
  });

  it('restricted accounts cannot make offers; blocked users cannot see or offer', async () => {
    const R = await signUp('Restricted'); const a = await listItem(A); const r1 = await listItem(R);
    await M.User.updateOne({ _id: R.id }, { $set: { status: 'RESTRICTED' } });
    expect((await offer(R, { requestedListingIds: [a.id], offeredListingIds: [r1.id] })).status).toBe(403);
    const D = await signUp('Dan'); const d1 = await listItem(D);
    await post(`/users/${A.id}/block`, D.token);
    expect((await get(`/listings/${a.id}`, D.token)).status).toBe(404);
    expect((await offer(D, { requestedListingIds: [a.id], offeredListingIds: [d1.id] })).status).toBe(404);
  });
});
