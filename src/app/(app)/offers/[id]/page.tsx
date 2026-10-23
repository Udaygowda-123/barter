'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, MessageCircle, PartyPopper, Repeat, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { CashNote, OfferStatusBadge, TermsEditor, TermsState, TermsSummary, toBrief } from '@/components/offers/terms';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { timeAgo, timeLeft } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Listing, Offer, Page, Revision } from '@/lib/types';

type Action = 'accept' | 'counter' | 'reject' | 'withdraw' | null;

export default function OfferPage() {
  const { id } = useParams<{ id: string }>(); const { user, status } = useRequireAuth(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['offer', id], queryFn: () => api<Offer>(`/offers/${id}`), enabled: status === 'authed', retry: false, refetchOnWindowFocus: true });
  const [action, setAction] = useState<Action>(null); const idem = useRef(newIdempotencyKey()); const [counterError, setCounterError] = useState<string>();
  const o = q.data; const me = user?.id;
  const latest = o?.revisions[o.revisions.length - 1];
  const open = o && (o.status === 'PENDING' || o.status === 'COUNTERED');
  const nameOf = (uid: string) => (o ? (uid === me ? 'You' : uid === o.sender.id ? o.sender.displayName : o.recipient.displayName) : '');

  const pools = useQuery({
    queryKey: ['counter-pools', id, o?.version], enabled: action === 'counter' && !!o,
    queryFn: async () => { const [s, r] = await Promise.all([api<Page<Listing>>(`/listings?ownerId=${o!.sender.id}&status=ACTIVE&limit=50`), api<Page<Listing>>(`/listings?ownerId=${o!.recipient.id}&status=ACTIVE&limit=50`)]); return { sender: s.items.map(toBrief), recipient: r.items.map(toBrief) }; },
  });
  const iAmSender = o?.sender.id === me;
  const [terms, setTerms] = useState<TermsState | null>(null);
  const initialTerms = useMemo<TermsState | null>(() => latest ? {
    give: (iAmSender ? latest.offered : latest.requested).map((i) => i.id), get: (iAmSender ? latest.requested : latest.offered).map((i) => i.id),
    cash: latest.cashAmount, payer: latest.cashPayerId === me || !latest.cashAmount ? 'ME' : 'THEM', message: '',
  } : null, [latest, iAmSender, me]);

  function openAction(a: Action) { idem.current = newIdempotencyKey(); setCounterError(undefined); if (a === 'counter') setTerms(initialTerms); setAction(a); }

  const run = useMutation({
    mutationFn: async (a: Exclude<Action, null>) => {
      const base = { expectedVersion: o!.version };
      if (a === 'accept') return api<Offer>(`/offers/${id}/accept`, { method: 'POST', idempotencyKey: idem.current, body: { ...base, revisionNumber: latest!.number } });
      if (a === 'counter') {
        const t = terms!; const offeredListingIds = iAmSender ? t.give : t.get; const requestedListingIds = iAmSender ? t.get : t.give;
        return api<Offer>(`/offers/${id}/counter`, { method: 'POST', idempotencyKey: idem.current, body: { ...base, offeredListingIds, requestedListingIds, cashAmount: t.cash, cashPayer: t.payer, message: t.message || undefined } });
      }
      return api<Offer>(`/offers/${id}/${a}`, { method: 'POST', idempotencyKey: idem.current, body: base });
    },
    onSuccess: (data, a) => {
      qc.setQueryData(['offer', id], data); qc.invalidateQueries({ queryKey: ['offers'] }); qc.invalidateQueries({ queryKey: ['deals'] }); qc.invalidateQueries({ queryKey: ['conversations'] });
      setAction(null);
      toast.success({ accept: 'Offer accepted — a deal has been created', counter: 'Counteroffer sent', reject: 'Offer declined', withdraw: 'Offer withdrawn' }[a]);
    },
    onError: (e, a) => {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
      if (e instanceof ApiError && ['STALE_OFFER', 'REVISION_CHANGED', 'OFFER_CLOSED', 'OFFER_EXPIRED', 'ITEM_UNAVAILABLE'].includes(e.code)) { qc.invalidateQueries({ queryKey: ['offer', id] }); setAction(null); }
      if (a === 'counter' && !(e instanceof ApiError && ['STALE_OFFER', 'ITEM_UNAVAILABLE'].includes(e.code))) setCounterError(msg); else toast.error(msg);
      idem.current = newIdempotencyKey();
    },
  });

  if (status !== 'authed' || q.isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div>;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState title="Offer not found" body="It may not exist, or it isn't yours to see." action={<Button asChild><Link href="/offers">Back to offers</Link></Button>} />;
  if (q.isError || !o || !latest) return <ErrorState onRetry={() => q.refetch()} />;

  const waitingOn = o.awaitingUserId && o.awaitingUserId !== me ? nameOf(o.awaitingUserId) : null;
  const summary = (r: Revision) => <TermsSummary senderName={nameOf(o.sender.id)} recipientName={nameOf(o.recipient.id)} offered={r.offered} requested={r.requested} cashAmount={r.cashAmount} cashPayerName={r.cashPayerId ? nameOf(r.cashPayerId).toLowerCase() : null} message={r.message} />;
  const counterValid = !!terms && terms.get.length > 0 && (terms.give.length > 0 || terms.cash > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><div className="flex flex-wrap items-center gap-2"><OfferStatusBadge status={o.status} />{o.yourTurn && <Badge tone="coral">Your turn</Badge>}</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{o.targetListing.title}</h1>
        <p className="mt-1 text-muted">{o.sender.id === me ? `Your offer to ${o.recipient.displayName}` : `${o.sender.displayName} made you an offer`}{open && <span className="ml-2 inline-flex items-center gap-1 text-sm"><Clock className="size-3.5" aria-hidden />{timeLeft(o.expiresAt)}</span>}</p></div>

      {o.status === 'ACCEPTED' && o.deal && <Card className="flex flex-wrap items-center justify-between gap-3 border-mint bg-mint p-5 text-mint-ink"><p className="flex items-center gap-2 font-bold"><PartyPopper className="size-5" aria-hidden />Accepted — you&apos;re in a deal!</p><Button asChild variant="ink"><Link href={`/deals/${o.deal.id}`}>Open deal</Link></Button></Card>}
      {['REJECTED', 'WITHDRAWN', 'EXPIRED'].includes(o.status) && <Card className="p-4 text-sm text-muted">This offer is closed ({o.status.toLowerCase()}). You can start a new one from the item page.</Card>}

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Current terms <span className="text-sm font-semibold text-muted">· version {latest.number}</span></h2>{o.conversationId && <Button asChild variant="soft" size="sm"><Link href={`/messages/${o.conversationId}`}><MessageCircle className="size-4" aria-hidden />Chat</Link></Button>}</div>
        {summary(latest)}
        <p className="mt-4 text-xs text-muted">Proposed by {nameOf(latest.authorId)} {timeAgo(latest.createdAt)}.</p>
        {open && (
          <div className="mt-5 border-t border-line pt-5">
            {o.yourTurn ? (<div className="flex flex-wrap gap-3"><Button onClick={() => openAction('accept')}><Check className="size-4" aria-hidden />Accept these terms</Button><Button variant="soft" onClick={() => openAction('counter')}><Repeat className="size-4" aria-hidden />Counter</Button><Button variant="outline" onClick={() => openAction('reject')}><X className="size-4" aria-hidden />Decline</Button></div>)
              : (<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">Waiting for <b className="text-ink">{waitingOn}</b> to respond.</p><Button variant="outline" onClick={() => openAction('withdraw')}>Withdraw offer</Button></div>)}
          </div>
        )}
      </Card>

      <section aria-labelledby="hist"><h2 id="hist" className="mb-3 text-lg font-black">Negotiation history</h2>
        <ol className="space-y-3 border-l-2 border-line pl-5">
          {[...o.revisions].reverse().map((r) => (
            <li key={r.id} className="relative"><span aria-hidden className={`absolute -left-[1.65rem] top-2 size-3 rounded-full ${r.id === o.acceptedRevisionId ? 'bg-mint-ink' : r.number === latest.number ? 'bg-coral' : 'bg-line'}`} />
              <details open={r.number === latest.number && false} className="rounded-2xl border border-line bg-surface p-4"><summary className="cursor-pointer text-sm font-semibold">Version {r.number} · {nameOf(r.authorId)} · {timeAgo(r.createdAt)}{r.id === o.acceptedRevisionId && <Badge tone="mint" className="ml-2">Accepted</Badge>}{r.number === latest.number && r.id !== o.acceptedRevisionId && <Badge tone="coral" className="ml-2">Latest</Badge>}</summary><div className="mt-3">{summary(r)}</div></details></li>
          ))}
        </ol>
      </section>

      <Dialog open={action === 'accept'} onOpenChange={(v) => !v && setAction(null)} title="Accept these exact terms?" description={`You're accepting version ${latest.number}. If ${nameOf(latest.authorId)} changes anything, you'll be asked again.`}>
        {summary(latest)}<div className="mt-4"><CashNote /></div>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAction(null)}>Not yet</Button><Button loading={run.isPending} onClick={() => run.mutate('accept')}>Accept &amp; create deal</Button></div>
      </Dialog>
      <Dialog open={action === 'reject' || action === 'withdraw'} onOpenChange={(v) => !v && setAction(null)} title={action === 'reject' ? 'Decline this offer?' : 'Withdraw your offer?'} description={action === 'reject' ? 'The other person will be notified. This closes the offer.' : 'This closes the offer. You can always make a new one.'}>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button><Button variant="danger" loading={run.isPending} onClick={() => run.mutate(action as 'reject' | 'withdraw')}>{action === 'reject' ? 'Decline offer' : 'Withdraw offer'}</Button></div>
      </Dialog>
      <Dialog open={action === 'counter'} onOpenChange={(v) => !v && setAction(null)} title="Counter with new terms" description="This creates a new version. Nothing is agreed until the other person accepts it." className="md:max-w-2xl">
        {pools.isError ? <ErrorState onRetry={() => pools.refetch()} /> : !pools.data || !terms ? <div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-32" /></div> : (<>
          <TermsEditor state={terms} onChange={setTerms} getTitle={`What you get (${iAmSender ? o.recipient.displayName : o.sender.displayName}'s items)`} giveTitle="What you give (your items)" getPool={iAmSender ? pools.data.recipient : pools.data.sender} givePool={iAmSender ? pools.data.sender : pools.data.recipient} error={counterError} />
          <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setAction(null)}>Cancel</Button><Button disabled={!counterValid} loading={run.isPending} onClick={() => run.mutate('counter')}>Send counteroffer</Button></div>
        </>)}
      </Dialog>
    </div>
  );
}
