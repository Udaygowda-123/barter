import { beforeAll, describe, expect, it } from 'vitest';
import { get, listItem, M, makeStaff, offer, post, resetDb, signUp, type U } from './helpers';

async function dealFor(A: U, B: U, extra: Record<string, unknown> = {}) {
  const a = await listItem(A, { title: 'A-item' }); const b = await listItem(B, { title: 'B-item' });
  const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id], ...extra })).body;
  const acc = (await post(`/offers/${o.id}/accept`, A.token, { expectedVersion: o.version, revisionNumber: 1 })).body;
  return { a, b, o, dealId: acc.deal.id as string };
}

describe('deal lifecycle, completion, reviews', () => {
  let A: U, B: U, C: U, S: U;
  beforeAll(async () => { await resetDb(); A = await signUp('Alice'); B = await signUp('Bob'); C = await signUp('Carol'); S = await signUp('Staff'); await makeStaff(S, 'MODERATOR'); });

  it('creates exactly one deal that reserves every item; both participants see it', async () => {
    const { a, b, dealId } = await dealFor(A, B, { cashAmount: 200, cashPayer: 'ME' });
    for (const id of [a.id, b.id]) expect((await M.Listing.findById(id).lean())!.status).toBe('RESERVED');
    for (const u of [A, B]) { const d = (await get(`/deals/${dealId}`, u.token)).body; expect(d.status).toBe('ACTIVE'); expect(d.terms.cashAmount).toBe(200); expect(d.terms.giving).toHaveLength(1); expect(d.terms.receiving).toHaveLength(1); }
    expect((await get(`/deals/${dealId}`, C.token)).status).toBe(404);
    expect((await M.Listing.findById(a.id).lean())!.status).toBe('RESERVED');
  });

  it('locked items cannot be edited or removed while a deal is active', async () => {
    const { a } = await dealFor(A, B);
    expect((await (await import('./helpers')).api('PATCH', `/listings/${a.id}`, { token: A.token, body: { title: 'Changed after deal' } })).status).toBe(409);
    expect((await (await import('./helpers')).api('DELETE', `/listings/${a.id}`, { token: A.token })).status).toBe(409);
  });

  it('completes only after BOTH confirm, requires a handover plan, and cash is never treated as paid', async () => {
    const { a, b, dealId } = await dealFor(A, B, { cashAmount: 500, cashPayer: 'ME' });
    expect((await post(`/deals/${dealId}/confirm-completion`, A.token)).status).toBe(400);             // no plan yet
    expect((await post(`/deals/${dealId}/handover`, C.token, { method: 'LOCAL_HANDOVER' })).status).toBe(404);
    expect((await post(`/deals/${dealId}/handover`, A.token, { method: 'LOCAL_HANDOVER', notes: 'Station café' })).status).toBe(200);
    const one = (await post(`/deals/${dealId}/confirm-completion`, A.token)).body; expect(one.status).toBe('ACTIVE'); expect(one.completion).toEqual({ confirmedByMe: true, confirmedByOther: false });
    expect((await post(`/deals/${dealId}/confirm-completion`, A.token)).body.status).toBe('ACTIVE');    // repeating changes nothing
    expect((await post(`/deals/${dealId}/reviews`, A.token, { rating: 5 })).status).toBe(403);           // not eligible yet
    const done = (await post(`/deals/${dealId}/confirm-completion`, B.token)).body; expect(done.status).toBe('COMPLETED');
    for (const id of [a.id, b.id]) expect((await M.Listing.findById(id).lean())!.status).toBe('EXCHANGED');
    expect(await M.ListingLock.countDocuments({ listingId: { $in: [a.id, b.id] } })).toBe(0);
    expect((await post(`/deals/${dealId}/cancel`, A.token, { reason: 'too late now' })).status).toBe(409); // final
    const doc = (await M.Deal.findById(dealId).lean()) as any; expect(doc.snapshot.cashAmount).toBe(500); // terms still as accepted
  });

  it('reviews: only participants, only after completion, one each, rating 1–5, shown on the profile', async () => {
    const { dealId } = await dealFor(A, B);
    await post(`/deals/${dealId}/handover`, A.token, { method: 'SHIPPING' }); await post(`/deals/${dealId}/confirm-completion`, A.token); await post(`/deals/${dealId}/confirm-completion`, B.token);
    expect((await post(`/deals/${dealId}/reviews`, C.token, { rating: 5 })).status).toBe(404);
    expect((await post(`/deals/${dealId}/reviews`, A.token, { rating: 9 })).status).toBe(400);
    expect((await post(`/deals/${dealId}/reviews`, A.token, { rating: 5, body: 'Great' })).status).toBe(201);
    expect((await post(`/deals/${dealId}/reviews`, A.token, { rating: 1 })).status).toBe(409);
    expect((await post(`/deals/${dealId}/reviews`, B.token, { rating: 4 })).status).toBe(201);
    const p = (await get(`/users/${B.id}`)).body; expect(p.stats.reviewCount).toBeGreaterThanOrEqual(1); expect(p.email).toBeUndefined();
    expect((await get(`/deals/${dealId}`, A.token)).body.reviews).toMatchObject({ canReview: false });
  });

  it('cancelling releases the items and frees them for new offers', async () => {
    const { a, b, dealId } = await dealFor(A, B);
    expect((await post(`/deals/${dealId}/cancel`, B.token, { reason: 'Changed my mind' })).body.status).toBe('CANCELLED');
    for (const id of [a.id, b.id]) expect((await M.Listing.findById(id).lean())!.status).toBe('ACTIVE');
    expect((await offer(C, { requestedListingIds: [a.id], cashAmount: 100, cashPayer: 'ME' })).status).toBe(201);
  });

  it('disputes go to the moderation queue; only staff can resolve, and every action is audited', async () => {
    const { a, dealId } = await dealFor(A, B);
    expect((await post(`/deals/${dealId}/dispute`, B.token, { reason: 'Item not as described at the meet-up' })).body.status).toBe('DISPUTED');
    expect((await get('/admin/reports', S.token)).body.some((r: any) => r.details?.includes(dealId))).toBe(true);
    expect((await post(`/admin/deals/${dealId}/resolve`, B.token, { outcome: 'CANCELLED' })).status).toBe(403);
    expect((await post(`/admin/deals/${dealId}/resolve`, S.token, { outcome: 'CANCELLED', note: 'no evidence' })).status).toBe(200);
    expect((await M.Listing.findById(a.id).lean())!.status).toBe('ACTIVE');
    expect(await M.AuditLog.countDocuments({ action: 'deal.resolve_cancelled' })).toBe(1);
  });
});
