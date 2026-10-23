import { beforeAll, describe, expect, it } from 'vitest';
import { api, get, listItem, M, makeStaff, offer, post, resetDb, signUp, upload, type U } from './helpers';

describe('security & authorization', () => {
  let A: U, B: U, S: U;
  beforeAll(async () => { await resetDb(); A = await signUp('Alice'); B = await signUp('Bob'); S = await signUp('Staff'); await makeStaff(S, 'MODERATOR'); });

  it('rejects missing/forged/expired tokens and never trusts client-supplied roles or owners', async () => {
    expect((await get('/users/me')).status).toBe(401);
    expect((await get('/users/me', 'garbage')).status).toBe(401);
    const forged = (await import('jose')).SignJWT; const bad = await new forged({}).setProtectedHeader({ alg: 'HS256' }).setSubject(A.id).setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(40)));
    expect((await get('/users/me', bad)).status).toBe(401);
    const expired = await new forged({}).setProtectedHeader({ alg: 'HS256' }).setSubject(A.id).setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET!));
    expect((await get('/users/me', expired)).status).toBe(401);
    const r = await api('PATCH', '/users/me', { token: A.token, body: { displayName: 'Alice', role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() } });
    expect(r.status).toBe(200); expect(r.body.role).toBe('USER'); expect(r.body.emailVerifiedAt).toBeNull();
    expect((await get('/admin/reports', A.token)).status).toBe(403);
    const l = await post('/listings', A.token, { title: 'Mine', description: 'A description here', category: 'OTHER', condition: 'GOOD', exchangeMethods: ['SHIPPING'], imageIds: [await upload(A)], ownerId: B.id, status: 'REMOVED' });
    expect(l.body.ownerId).toBe(A.id); expect(l.body.status).toBe('ACTIVE');
  });

  it('enforces listing ownership and image ownership', async () => {
    const a = await listItem(A);
    expect((await api('PATCH', `/listings/${a.id}`, { token: B.token, body: { title: 'Hijacked' } })).status).toBe(403);
    expect((await api('DELETE', `/listings/${a.id}`, { token: B.token })).status).toBe(403);
    const bImg = await upload(B);
    expect((await post('/listings', A.token, { title: 'Steal photo', description: 'Using someone else photo', category: 'OTHER', condition: 'GOOD', exchangeMethods: ['SHIPPING'], imageIds: [bImg] })).status).toBe(400);
    expect((await get(`/media/images/${bImg}`, A.token)).status).toBe(403);
    expect((await api('PATCH', `/media/images/${bImg}`, { token: A.token, body: { useEnhanced: true } })).status).toBe(403);
  });

  it('validates uploads by decoding, caps size, and strips SVG/scripts', async () => {
    const f = (buf: Buffer, name: string, type: string) => { const form = new FormData(); form.set('file', new Blob([new Uint8Array(buf)], { type }), name); return api('POST', '/media/images', { token: A.token, form }); };
    expect((await f(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.png', 'image/png')).status).toBe(400);
    expect((await f(Buffer.from('not an image at all'), 'x.jpg', 'image/jpeg')).status).toBe(400);
    expect((await f(Buffer.alloc(5 * 1024 * 1024, 1), 'big.png', 'image/png')).status).toBe(413);
    expect((await api('POST', '/media/images', { token: A.token, form: new FormData() })).status).toBe(400);
    expect((await api('POST', '/media/images', { form: new FormData() })).status).toBe(401);
  });

  it('reports: only reportable targets, no duplicate spam, and message reports require membership', async () => {
    const a = await listItem(A); const b = await listItem(B); const o = (await offer(B, { requestedListingIds: [a.id], offeredListingIds: [b.id] })).body;
    const msg = (await post(`/conversations/${o.conversationId}/messages`, A.token, { content: 'private text' })).body;
    const outsider = await signUp('Outsider');
    expect((await post('/reports', outsider.token, { targetType: 'MESSAGE', targetId: msg.id, reason: 'spam spam' })).status).toBe(404);   // can't report what you can't see
    expect((await post('/reports', B.token, { targetType: 'MESSAGE', targetId: msg.id, reason: 'harassment' })).status).toBe(201);
    const r1 = await post('/reports', B.token, { targetType: 'LISTING', targetId: a.id, reason: 'fake item' }); const r2 = await post('/reports', B.token, { targetType: 'LISTING', targetId: a.id, reason: 'fake item' });
    expect(r2.body.id).toBe(r1.body.id);
    expect((await post('/reports', B.token, { targetType: 'USER', targetId: B.id, reason: 'self report' })).status).toBe(400);
    expect((await get('/admin/reports', B.token)).status).toBe(403);
    expect((await get('/admin/reports', S.token)).status).toBe(200);
    expect((await post(`/admin/reports/${r1.body.id}/resolve`, S.token, { action: 'REMOVE_LISTING' })).status).toBe(200);
    expect((await M.Listing.findById(a.id).lean())!.status).toBe('REMOVED');
    expect((await M.AuditLog.countDocuments({ actorId: S.id }))).toBeGreaterThan(0);
    expect((await get('/admin/audit-logs', S.token)).status).toBe(403);   // audit log is admin-only
  });

  it('blocking hides users from each other and stops messaging', async () => {
    const C = await signUp('Carol'); const D = await signUp('Dan'); const c = await listItem(C); const d = await listItem(D);
    const o = (await offer(D, { requestedListingIds: [c.id], offeredListingIds: [d.id] })).body;
    expect((await post(`/users/${C.id}/block`, D.token)).status).toBe(200);
    expect((await post(`/conversations/${o.conversationId}/messages`, C.token, { content: 'hello?' })).status).toBe(403);
    expect((await post(`/conversations/${o.conversationId}/messages`, D.token, { content: 'hello?' })).status).toBe(403);
    expect((await post(`/users/${D.id}/block`, D.token)).status).toBe(400);
    expect((await get(`/listings?ownerId=${C.id}`, D.token)).body.items).toHaveLength(0); // hidden even when filtered by owner
    expect((await get(`/listings/${c.id}`, D.token)).status).toBe(404);
  });

  it('rate-limits abusive sign-in attempts (database-backed, works across instances)', async () => {
    const saved = process.env.RATE_LIMIT_SCALE; process.env.RATE_LIMIT_SCALE = '1';
    try {
      let last = 0; for (let i = 0; i < 25; i++) last = (await post('/auth/login', undefined, { email: 'nobody@example.test', password: 'wrong-password-123' }, { 'x-forwarded-for': '9.9.9.9' })).status;
      expect(last).toBe(429);
    } finally { process.env.RATE_LIMIT_SCALE = saved; }
  });

  it('creates the unique indexes that enforce the money-free invariants', async () => {
    const idx = async (m: any) => (await m.collection.indexes()).filter((i: any) => i.unique).map((i: any) => Object.keys(i.key).join('+'));
    expect(await idx(M.Offer)).toContain('senderId+targetListingId'); expect(await idx(M.ListingLock)).toContain('listingId');
    expect(await idx(M.Review)).toContain('dealId+authorId'); expect(await idx(M.Message)).toContain('conversationId+senderId+clientId');
  });
});
