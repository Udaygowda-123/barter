import { beforeAll, describe, expect, it } from 'vitest';
import { api, get, listItem, M, post, resetDb, signUp, type U } from './helpers';

describe('listings, search, favorites and discovery', () => {
  let A: U, B: U;
  beforeAll(async () => { await resetDb(); A = await signUp('Seller'); B = await signUp('Buyer'); });

  it('searches, filters and paginates with stable cursors', async () => {
    const tag = `zq${Date.now()}`;
    for (let i = 0; i < 5; i++) await listItem(A, { title: `${tag} item ${i}`, category: i % 2 ? 'GAMING' : 'BOOKS', estimatedValue: 1000 * (i + 1) });
    const q = (qs: string) => get(`/listings?q=${tag}&${qs}`);
    expect((await q('')).body.items).toHaveLength(5);
    expect((await q('category=GAMING')).body.items).toHaveLength(2);
    expect((await q('minValue=2500&maxValue=4500')).body.items).toHaveLength(2);
    const p1 = (await q('limit=2')).body; const p2 = (await q(`limit=2&cursor=${p1.pageInfo.nextCursor}`)).body; const p3 = (await q(`limit=2&cursor=${p2.pageInfo.nextCursor}`)).body;
    expect(new Set([...p1.items, ...p2.items, ...p3.items].map((x: any) => x.id)).size).toBe(5); expect(p3.pageInfo.nextCursor).toBeNull();
    expect((await get('/listings?limit=500')).status).toBe(400);
    expect((await get(`/listings?q=${encodeURIComponent('.*(')}`)).status).toBe(200); // regex metacharacters are escaped
  });

  it('never exposes coordinates, emails or hidden listings publicly; list payloads are lean', async () => {
    await api('PATCH', '/users/me', { token: A.token, body: { locationCity: 'Pune', locationConsent: true, locationLat: 18.5204, locationLng: 73.8567 } });
    const l = await listItem(A, { title: 'Located item' }); const pub = (await get(`/listings/${l.id}`)).body;
    expect(pub.locationCity).toBe('Pune'); expect(pub.locationLat).toBeUndefined(); expect(pub.owner.email).toBeUndefined();
    const lite = (await get('/discover?limit=1')).body.items[0]; expect(Object.keys(lite)).not.toContain('wantedCategories'); expect(lite.images[0].originalUrl).toBeUndefined();
    await M.Listing.updateOne({ _id: l.id }, { $set: { status: 'UNDER_REVIEW' } });
    expect((await get(`/listings/${l.id}`)).status).toBe(404); expect((await get(`/listings/${l.id}`, A.token)).status).toBe(200);
  });

  it('stores only consent-gated, coarse location', async () => {
    const U2 = await signUp('Locator');
    expect((await api('PATCH', '/users/me', { token: U2.token, body: { locationLat: 18.5204, locationLng: 73.8567 } })).status).toBe(400);
    expect((await api('PATCH', '/users/me', { token: U2.token, body: { locationConsent: true, locationLat: 18.5204, locationLng: 73.8567 } })).body.locationLat).toBe(18.5);
    expect((await api('PATCH', '/users/me', { token: U2.token, body: { locationConsent: false } })).body.locationLat).toBeNull();
  });

  it('favorites and dismissals work, and discovery ranks wanted categories first with reasons', async () => {
    await api('PATCH', '/users/me', { token: B.token, body: { wantedCategories: ['COLLECTIBLES'] } });
    const want = await listItem(A, { title: 'Vinyl record', category: 'COLLECTIBLES' }); const other = await listItem(A, { title: 'Old paperback', category: 'BOOKS' });
    const feed = (await get('/discover?limit=50', B.token)).body.items; const ids = feed.map((i: any) => i.id);
    expect(ids.indexOf(want.id)).toBeLessThan(ids.indexOf(other.id)); expect(feed.find((i: any) => i.id === want.id).match.reasons.join(' ')).toMatch(/category you want/);
    expect((await post(`/listings/${want.id}/favorite`, B.token)).status).toBe(200);
    expect((await get('/favorites', B.token)).body.map((x: any) => x.id)).toContain(want.id);
    expect((await api('DELETE', `/listings/${want.id}/favorite`, { token: B.token })).body.favorited).toBe(false);
    await post(`/listings/${other.id}/dismiss`, B.token);
    expect((await get('/discover?limit=50', B.token)).body.items.map((i: any) => i.id)).not.toContain(other.id);
    expect((await get('/discover?limit=50', A.token)).body.items.map((i: any) => i.id)).not.toContain(want.id); // never your own items
  });

  it('filters out restricted-content listings and honours prohibited terms', async () => {
    const admin = await signUp('Admin'); await M.User.updateOne({ _id: admin.id }, { $set: { role: 'ADMIN' } });
    expect((await post('/admin/prohibited-terms', admin.token, { term: 'counterfeit' })).status).toBe(201);
    const r = await post('/listings', A.token, { title: 'Counterfeit watch', description: 'Looks real enough honestly', category: 'OTHER', condition: 'NEW', exchangeMethods: ['SHIPPING'], imageIds: [(await (await import('./helpers')).upload(A))] });
    expect(r.status).toBe(422); expect(r.body.code).toBe('PROHIBITED_ITEM');
  });
});
