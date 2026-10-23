import { beforeAll, describe, expect, it } from 'vitest';
import { api, get, M, post, resetDb, signUp } from './helpers';

describe('authentication', () => {
  beforeAll(resetDb);

  it('registers (no password hash leaked), rejects duplicates and weak input with field errors', async () => {
    const u = await signUp('Alice'); const me = (await get('/users/me', u.token)).body;
    expect(me.email).toBe(u.email); expect(me.passwordHash).toBeUndefined(); expect(me.emailVerifiedAt).toBeNull();
    expect((await post('/auth/register', undefined, { email: u.email, password: 'another-long-password', displayName: 'Dup' })).body.code).toBe('EMAIL_TAKEN');
    const bad = await post('/auth/register', undefined, { email: 'nope', password: 'short', displayName: 'x' });
    expect(bad.status).toBe(400); expect(bad.body.details.map((d: any) => d.path).sort()).toEqual(['displayName', 'email', 'password']);
    expect((await M.User.findOne({ email: u.email }).lean())!.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('logs in with generic errors, locks out suspended accounts, and protects routes', async () => {
    const u = await signUp('Bob');
    expect((await post('/auth/login', undefined, { email: u.email, password: 'wrong-password-123' })).status).toBe(401);
    expect((await post('/auth/login', undefined, { email: 'ghost@example.test', password: 'wrong-password-123' })).body.message).toBe((await post('/auth/login', undefined, { email: u.email, password: 'wrong-password-123' })).body.message);
    expect((await post('/auth/login', undefined, { email: u.email, password: u.password })).status).toBe(200);
    await M.User.updateOne({ _id: u.id }, { $set: { status: 'SUSPENDED' } });
    expect((await get('/users/me', u.token)).status).toBe(401);
    expect((await post('/auth/login', undefined, { email: u.email, password: u.password })).status).toBe(403);
  });

  it('rotates refresh tokens and revokes the whole family when an old one is replayed', async () => {
    const u = await signUp('Carol');
    const r1 = await post('/auth/refresh', undefined, { refreshToken: u.refreshToken }); expect(r1.status).toBe(200); expect(r1.body.me.email).toBe(u.email);
    expect((await post('/auth/refresh', undefined, { refreshToken: u.refreshToken })).status).toBe(401);        // replay
    expect((await post('/auth/refresh', undefined, { refreshToken: r1.body.refreshToken })).status).toBe(401);   // family revoked
  });

  it('verifies email once, and runs forgot → reset with single-use, newest-only links', async () => {
    const u = await signUp('Dave');
    const { createHash } = await import('crypto'); const mk = async (model: any, userId: string) => { const t = 'tok_' + Math.random().toString(36).slice(2).padEnd(40, 'x'); await model.create({ userId, tokenHash: createHash('sha256').update(t).digest('hex'), expiresAt: new Date(Date.now() + 3600_000) }); return t; };
    const vt = await mk(M.EmailVerifyToken, u.id);
    expect((await post('/auth/verify-email', undefined, { token: vt })).status).toBe(200); expect((await get('/users/me', u.token)).body.emailVerifiedAt).toBeTruthy();
    expect((await post('/auth/verify-email', undefined, { token: vt })).status).toBe(401);
    const f1 = await post('/auth/forgot-password', undefined, { email: u.email }); const f2 = await post('/auth/forgot-password', undefined, { email: u.email });
    expect(f1.status).toBe(200); expect((await post('/auth/forgot-password', undefined, { email: 'ghost@example.test' })).body.ok).toBe(true);
    expect((await post('/auth/reset-password', undefined, { token: f1.body.devToken, password: 'a-brand-new-password' })).status).toBe(401); // superseded
    expect((await post('/auth/reset-password', undefined, { token: f2.body.devToken, password: 'short' })).status).toBe(400);
    expect((await post('/auth/reset-password', undefined, { token: f2.body.devToken, password: 'a-brand-new-password' })).status).toBe(204);
    expect((await post('/auth/reset-password', undefined, { token: f2.body.devToken, password: 'another-new-password' })).status).toBe(401); // single use
    expect((await post('/auth/refresh', undefined, { refreshToken: u.refreshToken })).status).toBe(401);                                  // signed out everywhere
    expect((await post('/auth/login', undefined, { email: u.email, password: 'a-brand-new-password' })).status).toBe(200);
  });

  it('changes password only with the current one and signs other sessions out', async () => {
    const u = await signUp('Erin');
    expect((await post('/auth/change-password', u.token, { currentPassword: 'wrong-password-123', newPassword: 'third-password-789' })).status).toBe(400);
    expect((await post('/auth/change-password', u.token, { currentPassword: u.password, newPassword: 'third-password-789' })).status).toBe(204);
    expect((await post('/auth/refresh', undefined, { refreshToken: u.refreshToken })).status).toBe(401);
    expect((await post('/auth/login', undefined, { email: u.email, password: 'third-password-789' })).status).toBe(200);
    expect((await api('POST', '/auth/change-password', { body: { currentPassword: 'x', newPassword: 'y'.repeat(12) } })).status).toBe(401);
  });
});
