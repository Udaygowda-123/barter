import { beforeAll, describe, expect, it } from 'vitest';
import { get, listItem, M, offer, post, resetDb, signUp, type U } from './helpers';

describe('Offers ↔ Messages share one source of truth', () => {
  let A: U, B: U, a: any, b: any, o: any;
  beforeAll(async () => {
    await resetDb(); A = await signUp('Alice'); B = await signUp('Bob'); a = await listItem(A, { title: 'Alpha' }); b = await listItem(B, { title: 'Beta' });
    o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 100, cashPayer: 'ME' })).body;
  });
  const cards = async (u: U) => (await get(`/conversations/${o.conversationId}/messages`, u.token)).body.items.filter((m: any) => m.type === 'OFFER_CARD');

  it('the initial offer appears as a structured card in the linked conversation, for both sides', async () => {
    for (const u of [A, B]) { const c = await cards(u); expect(c).toHaveLength(1); expect(c[0].offerRevision).toMatchObject({ offerId: o.id, number: 1, cashAmount: 100 }); }
    const list = (await get('/conversations', A.token)).body; expect(list[0]).toMatchObject({ id: o.conversationId, unreadCount: 1, offer: { id: o.id, status: 'PENDING' } });
  });

  it('chat cards carry the live offer status and flag superseded revisions', async () => {
    const c = (await post(`/offers/${o.id}/counter`, A.token, { expectedVersion: o.version, requestedListingIds: [a.id], offeredListingIds: [b.id], cashAmount: 300, cashPayer: 'THEM' })).body;
    const cs = await cards(B); expect(cs).toHaveLength(2);                       // same thread, new card — not a new conversation
    expect(cs.every((m: any) => m.offerStatus === 'COUNTERED')).toBe(true);
    expect(cs.map((m: any) => m.isCurrentRevision)).toEqual([false, true]);
    expect((await get('/conversations', B.token)).body[0].offer.status).toBe('COUNTERED');
    o = { ...o, version: c.version };
  });

  it('a normal chat message never accepts or changes the offer', async () => {
    const before = (await get(`/offers/${o.id}`, B.token)).body;
    for (const text of ['I accept!', 'deal done', 'accepted ✅']) expect((await post(`/conversations/${o.conversationId}/messages`, B.token, { content: text })).status).toBe(201);
    const after = (await get(`/offers/${o.id}`, B.token)).body;
    expect(after.status).toBe(before.status); expect(after.version).toBe(before.version); expect(after.deal).toBeNull();
    expect(await M.Deal.countDocuments({ offerId: o.id })).toBe(0);
  });

  it('accepting updates the Offer, the conversation card, a system message, unread state and notifications together', async () => {
    const cur = (await get(`/offers/${o.id}`, B.token)).body;
    const r = await post(`/offers/${o.id}/accept`, B.token, { expectedVersion: cur.version, revisionNumber: 2 }); expect(r.status).toBe(200);
    expect((await cards(A)).every((m: any) => m.offerStatus === 'ACCEPTED')).toBe(true);
    const msgs = (await get(`/conversations/${o.conversationId}/messages`, A.token)).body.items; expect(msgs.at(-1)).toMatchObject({ type: 'SYSTEM' });
    expect((await get('/conversations', A.token)).body[0]).toMatchObject({ offer: { status: 'ACCEPTED' } });
    expect((await get('/notifications', A.token)).body.items.some((n: any) => n.type === 'DEAL_UPDATED' || n.type === 'OFFER_ACCEPTED')).toBe(true);
    expect((await get('/pulse', A.token)).body.unreadConversations).toBeGreaterThan(0);
    const deals = (await get('/deals', A.token)).body; expect(deals.map((d: any) => d.id)).toContain(r.body.deal.id);
  });

  it('a new offer between the same people about the same item reuses the negotiation thread', async () => {
    const C = await signUp('Carol'); const D = await signUp('Dave'); const c1 = await listItem(C); const d1 = await listItem(D);
    const o1 = (await offer(D, { requestedListingIds: [c1.id], offeredListingIds: [d1.id] })).body;
    await post(`/offers/${o1.id}/reject`, C.token, { expectedVersion: o1.version });
    const o2 = (await offer(D, { requestedListingIds: [c1.id], offeredListingIds: [d1.id], cashAmount: 50, cashPayer: 'ME' })).body;
    expect(o2.conversationId).toBe(o1.conversationId);
    expect((await get('/conversations', C.token)).body).toHaveLength(1);
    expect((await get('/conversations', C.token)).body[0].offer.id).toBe(o2.id);   // shows the latest offer
    // a different item is a different negotiation context
    const c2 = await listItem(C); const o3 = (await offer(D, { requestedListingIds: [c2.id], offeredListingIds: [d1.id] })).body;
    expect(o3.conversationId).not.toBe(o1.conversationId);
  });

  it('only participants can read or write a conversation; messages persist, de-duplicate and page', async () => {
    const X = await signUp('Mallory');
    expect((await get(`/conversations/${o.conversationId}/messages`, X.token)).status).toBe(404);
    expect((await post(`/conversations/${o.conversationId}/messages`, X.token, { content: 'hi' })).status).toBe(404);
    expect((await post(`/conversations/${o.conversationId}/read`, X.token)).status).toBe(404);
    const m1 = await post(`/conversations/${o.conversationId}/messages`, A.token, { content: 'once', clientId: 'client-dedupe-01' });
    const m2 = await post(`/conversations/${o.conversationId}/messages`, A.token, { content: 'once', clientId: 'client-dedupe-01' });
    expect(m2.body.id).toBe(m1.body.id);
    const inc = await get(`/conversations/${o.conversationId}/messages?after=${m1.body.id}`, B.token); expect(inc.body.items).toHaveLength(0);
    const before = (await get('/conversations', B.token)).body.find((c: any) => c.id === o.conversationId).unreadCount; expect(before).toBeGreaterThan(0);
    await post(`/conversations/${o.conversationId}/read`, B.token);
    expect((await get('/conversations', B.token)).body.find((c: any) => c.id === o.conversationId).unreadCount).toBe(0);
  });
});
