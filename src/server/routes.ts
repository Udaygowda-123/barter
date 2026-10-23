import { acceptOfferSchema, cancelDealSchema, counterOfferSchema, createListingSchema, createOfferSchema, createReportSchema, createReviewSchema, disputeDealSchema, enhanceSchema, forgotPasswordSchema, handoverSchema, listingQuerySchema, loginSchema, offerActionSchema, prohibitedTermSchema, refreshSchema, registerSchema, resetPasswordSchema, resolveReportSchema, restoreSchema, sendMessageSchema, updateListingSchema, updateProfileSchema } from '@/shared/validation';
import { z } from 'zod';
import * as auth from './auth';
import { clearRefreshCookie, clientIp, rateLimit, readCookie, setRefreshCookie } from './auth-core';
import * as chat from './chat';
import { connectDb } from './db';
import * as deals from './deals';
import { discover } from './discovery';
import { HttpError, bad, parse, reply } from './http';
import * as listings from './listings';
import * as media from './media';
import * as mod from './moderation';
import * as notifs from './notifs';
import * as offers from './offers';
import { Message } from './models';
import * as users from './users';
import { add, addPublic } from './router';
import { env } from './config';

const noContent = () => reply(null, 204);
const offersQuery = z.object({ box: z.enum(['sent', 'received', 'all']).default('all'), status: z.enum(['PENDING', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED']).optional(), cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });
const statusQuery = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN') });
const resolveDealSchema = z.object({ outcome: z.enum(['COMPLETED', 'CANCELLED']), note: z.string().trim().max(500).optional() });
const AUTH_LIMIT = 10;

// ───────── health ─────────
addPublic('GET', '/health', async () => { await connectDb(); return { status: 'ok' }; });

// ───────── auth ─────────
const session = (r: Awaited<ReturnType<typeof auth.login>>) => reply(r, 200, { cookies: [setRefreshCookie(r.refreshToken)] });
addPublic('POST', '/auth/register', async (c) => { await rateLimit(`auth:${clientIp(c.req)}`, AUTH_LIMIT, 60); const r = await auth.register(parse(registerSchema, await c.json())); return reply(r, 201, { cookies: [setRefreshCookie(r.refreshToken)] }); });
addPublic('POST', '/auth/login', async (c) => { await rateLimit(`auth:${clientIp(c.req)}`, AUTH_LIMIT, 60); return session(await auth.login(parse(loginSchema, await c.json()))); });
addPublic('POST', '/auth/refresh', async (c) => {
  await rateLimit(`auth:${clientIp(c.req)}`, AUTH_LIMIT * 3, 60);
  const body = (await c.json()) as { refreshToken?: string };
  const token = readCookie(c.req) ?? (body.refreshToken ? parse(refreshSchema, body).refreshToken : null);
  if (!token) throw new HttpError(401, 'NO_REFRESH', 'Please sign in again');
  return session(await auth.refresh(token));
});
addPublic('POST', '/auth/logout', async (c) => { await auth.logout(readCookie(c.req) ?? ((await c.json()) as { refreshToken?: string }).refreshToken); return reply(null, 204, { cookies: [clearRefreshCookie()] }); });
addPublic('POST', '/auth/forgot-password', async (c) => {
  await rateLimit(`auth:${clientIp(c.req)}`, AUTH_LIMIT, 60);
  const token = await auth.forgotPassword(parse(forgotPasswordSchema, await c.json()).email);
  return env.nodeEnv === 'test' ? { ok: true, devToken: token } : { ok: true }; // same response whether or not the account exists
});
addPublic('POST', '/auth/reset-password', async (c) => { await rateLimit(`auth:${clientIp(c.req)}`, AUTH_LIMIT, 60); const b = parse(resetPasswordSchema, await c.json()); await auth.resetPassword(b.token, b.password); return noContent(); });

// ───────── users ─────────
add('GET', '/users/me', 'user', (c) => users.me(c.user.id));
add('PATCH', '/users/me', 'user', async (c) => users.updateMe(c.user.id, parse(updateProfileSchema, await c.json())));
addPublic('GET', '/users/:id/reviews', (c) => users.userReviews(c.params.id));
addPublic('GET', '/users/:id', (c) => users.publicProfile(c.params.id), { cache: { sMaxAge: 60, swr: 300 } });
add('POST', '/users/:id/block', 'user', (c) => users.block(c.user.id, c.params.id));
add('DELETE', '/users/:id/block', 'user', (c) => users.unblock(c.user.id, c.params.id));

// ───────── media ─────────
add('POST', '/media/images', 'user', async (c) => {
  await rateLimit(`upload:${c.user.id}`, 30, 60);
  const file = (await c.form()).get('file');
  if (!(file instanceof Blob)) throw bad('NO_FILE', 'Choose an image to upload');
  return reply(await media.uploadImage(c.user.id, Buffer.from(await file.arrayBuffer())), 201);
});
add('GET', '/media/images/:id', 'user', (c) => media.getImage(c.user.id, c.params.id));
add('PATCH', '/media/images/:id', 'user', async (c) => media.chooseImage(c.user.id, c.params.id, parse(enhanceSchema, await c.json()).useEnhanced));
add('DELETE', '/media/images/:id', 'user', async (c) => { await media.discardImage(c.user.id, c.params.id); return noContent(); });

// ───────── listings & discovery ─────────
addPublic('GET', '/listings', (c) => listings.listListings(parse(listingQuerySchema, c.query), c.user?.id), { cache: { sMaxAge: 30, swr: 300 } });
add('POST', '/listings', 'user', async (c) => reply(await listings.createListing(c.user, parse(createListingSchema, await c.json())), 201));
addPublic('GET', '/listings/:id', (c) => listings.getListing(c.params.id, c.user?.id), { cache: { sMaxAge: 30, swr: 300 } });
add('PATCH', '/listings/:id', 'user', async (c) => listings.updateListing(c.params.id, c.user, parse(updateListingSchema, await c.json())));
add('DELETE', '/listings/:id', 'user', async (c) => { await listings.removeListing(c.params.id, c.user); return noContent(); });
add('POST', '/listings/:id/favorite', 'user', (c) => listings.setFavorite(c.user.id, c.params.id, true));
add('DELETE', '/listings/:id/favorite', 'user', (c) => listings.setFavorite(c.user.id, c.params.id, false));
add('POST', '/listings/:id/dismiss', 'user', (c) => listings.dismissListing(c.user.id, c.params.id));
add('GET', '/favorites', 'user', (c) => listings.favorites(c.user.id));
addPublic('GET', '/discover', (c) => discover(parse(listingQuerySchema, c.query), c.user?.id), { cache: { sMaxAge: 30, swr: 300 } });

// ───────── offers ─────────
add('GET', '/offers', 'user', (c) => offers.listOffers(c.user.id, parse(offersQuery, c.query)));
add('POST', '/offers', 'user', async (c) => { await rateLimit(`offer:${c.user.id}`, 30, 60); return reply(await offers.createOffer(c.user, parse(createOfferSchema, await c.json())), 201); }, { idempotent: true });
add('GET', '/offers/:id', 'user', (c) => offers.getOffer(c.params.id, c.user.id));
add('POST', '/offers/:id/counter', 'user', async (c) => offers.counterOffer(c.user, c.params.id, parse(counterOfferSchema, await c.json())), { idempotent: true });
add('POST', '/offers/:id/accept', 'user', async (c) => offers.acceptOffer(c.user, c.params.id, parse(acceptOfferSchema, await c.json())), { idempotent: true });
add('POST', '/offers/:id/reject', 'user', async (c) => offers.rejectOffer(c.user, c.params.id, parse(offerActionSchema, await c.json()).expectedVersion), { idempotent: true });
add('POST', '/offers/:id/withdraw', 'user', async (c) => offers.withdrawOffer(c.user, c.params.id, parse(offerActionSchema, await c.json()).expectedVersion), { idempotent: true });

// ───────── chat (polling-based: clients re-fetch; `after` returns only new messages) ─────────
add('GET', '/conversations', 'user', (c) => chat.listConversations(c.user.id));
add('GET', '/pulse', 'user', (c) => chat.pulse(c.user.id));
add('GET', '/conversations/:id/messages', 'user', (c) => chat.getMessages(c.user.id, c.params.id, { after: c.query.after, before: c.query.before, limit: c.query.limit ? Number(c.query.limit) : undefined }));
add('POST', '/conversations/:id/messages', 'user', async (c) => { await rateLimit(`msg:${c.user.id}`, 60, 60); return reply(await chat.sendMessage(c.user.id, c.params.id, parse(sendMessageSchema, await c.json())), 201); });
add('POST', '/conversations/:id/read', 'user', (c) => chat.markRead(c.user.id, c.params.id));

// ───────── deals ─────────
add('GET', '/deals', 'user', (c) => deals.listDeals(c.user.id));
add('GET', '/deals/:id', 'user', (c) => deals.getDeal(c.params.id, c.user.id));
add('POST', '/deals/:id/handover', 'user', async (c) => deals.setHandover(c.user, c.params.id, parse(handoverSchema, await c.json())));
add('POST', '/deals/:id/confirm-handover', 'user', (c) => deals.confirmHandover(c.user, c.params.id), { idempotent: true });
add('POST', '/deals/:id/confirm-completion', 'user', (c) => deals.confirmCompletion(c.user, c.params.id), { idempotent: true });
add('POST', '/deals/:id/cancel', 'user', async (c) => deals.cancelDeal(c.user, c.params.id, parse(cancelDealSchema, await c.json()).reason));
add('POST', '/deals/:id/dispute', 'user', async (c) => deals.disputeDeal(c.user, c.params.id, parse(disputeDealSchema, await c.json()).reason));
add('POST', '/deals/:id/reviews', 'user', async (c) => reply(await deals.createReview(c.user, c.params.id, parse(createReviewSchema, await c.json())), 201));

// ───────── notifications ─────────
add('GET', '/notifications', 'user', (c) => notifs.listNotifications(c.user.id, c.query.cursor));
add('POST', '/notifications/read-all', 'user', (c) => notifs.markAllRead(c.user.id));
add('POST', '/notifications/:id/read', 'user', (c) => notifs.markNotificationRead(c.user.id, c.params.id));

// ───────── safety & staff ─────────
add('POST', '/reports', 'user', async (c) => reply(await mod.report(c.user, parse(createReportSchema, await c.json())), 201));
add('GET', '/admin/reports', 'staff', (c) => mod.listReports(parse(statusQuery, c.query).status));
add('POST', '/admin/reports/:id/resolve', 'staff', async (c) => { const b = parse(resolveReportSchema, await c.json()); return mod.resolveReport(c.user, c.params.id, b.action, b.note); });
add('GET', '/admin/listings/held', 'staff', () => mod.listHeld());
add('POST', '/admin/listings/:id/hold', 'staff', async (c) => mod.holdListing(c.user, c.params.id, parse(restoreSchema, await c.json()).note));
add('POST', '/admin/listings/:id/restore', 'staff', async (c) => mod.restoreListing(c.user, c.params.id, parse(restoreSchema, await c.json()).note));
add('POST', '/admin/listings/:id/remove', 'staff', async (c) => mod.removeListing(c.user, c.params.id, parse(restoreSchema, await c.json()).note));
add('POST', '/admin/users/:id/restrict', 'staff', async (c) => mod.setUserStatus(c.user, c.params.id, 'RESTRICTED', parse(restoreSchema, await c.json()).note));
add('POST', '/admin/users/:id/restore', 'staff', async (c) => mod.setUserStatus(c.user, c.params.id, 'ACTIVE', parse(restoreSchema, await c.json()).note));
add('POST', '/admin/users/:id/suspend', 'admin', async (c) => mod.setUserStatus(c.user, c.params.id, 'SUSPENDED', parse(restoreSchema, await c.json()).note));
add('POST', '/admin/deals/:id/resolve', 'staff', async (c) => { const b = parse(resolveDealSchema, await c.json()); return mod.resolveDeal(c.user, c.params.id, b.outcome, b.note); });
add('GET', '/admin/prohibited-terms', 'admin', () => mod.listTerms());
add('POST', '/admin/prohibited-terms', 'admin', async (c) => { const b = parse(prohibitedTermSchema, await c.json()); return reply(await mod.addTerm(c.user, b.term, b.reason), 201); });
add('DELETE', '/admin/prohibited-terms/:id', 'admin', async (c) => { await mod.removeTerm(c.user, c.params.id); return noContent(); });
add('GET', '/admin/audit-logs', 'admin', () => mod.listAudit());

// ───────── ops ─────────
/** Vercel Cron hits this (see vercel.json); expiry is also applied lazily whenever an offer is read or acted on. */
addPublic('GET', '/cron/expire-offers', async (c) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || c.req.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'UNAUTHENTICATED', 'Not allowed');
  return { expired: await offers.expireDueOffers() };
});
void Message;
