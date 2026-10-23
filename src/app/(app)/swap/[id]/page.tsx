'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { CashNote, TermsEditor, TermsState, TermsSummary, toBrief } from '@/components/offers/terms';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Listing, Offer, Page } from '@/lib/types';

export default function SwapBuilder() {
  const { id } = useParams<{ id: string }>(); const { user, status } = useRequireAuth(); const router = useRouter(); const toast = useToast();
  const enabled = status === 'authed' && !!user;
  const target = useQuery({ queryKey: ['listing', id, true], queryFn: () => api<Listing>(`/listings/${id}`), enabled });
  const ownerId = target.data?.ownerId;
  const theirs = useQuery({ queryKey: ['pool', ownerId], queryFn: () => api<Page<Listing>>(`/listings?ownerId=${ownerId}&status=ACTIVE&limit=50`), enabled: !!ownerId });
  const mine = useQuery({ queryKey: ['pool', user?.id], queryFn: () => api<Page<Listing>>(`/listings?ownerId=${user!.id}&status=ACTIVE&limit=50`), enabled });

  const [terms, setTerms] = useState<TermsState>({ give: [], get: [id], cash: 0, payer: 'ME', message: '' });
  const [step, setStep] = useState<'build' | 'review'>('build'); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  const key = useRef(newIdempotencyKey());
  const getPool = useMemo(() => (theirs.data?.items ?? []).map(toBrief), [theirs.data]); const givePool = useMemo(() => (mine.data?.items ?? []).map(toBrief), [mine.data]);

  if (target.isError || theirs.isError || mine.isError) return <ErrorState onRetry={() => { target.refetch(); theirs.refetch(); mine.refetch(); }} />;
  if (status !== 'authed' || target.isPending || theirs.isPending || mine.isPending) return <Spinner />;
  const t = target.data!;
  if (t.isOwner) return <EmptyState title="That's your own item" body="You can't make an offer on something you listed." action={<Button asChild><Link href="/discover">Back to discover</Link></Button>} />;
  if (t.status !== 'ACTIVE') return <EmptyState title="This item isn't available" body="It's already in a deal or has been swapped." action={<Button asChild><Link href="/discover">Find something else</Link></Button>} />;

  const valid = terms.get.length > 0 && (terms.give.length > 0 || terms.cash > 0);
  const offered = givePool.filter((i) => terms.give.includes(i.id)); const requested = getPool.filter((i) => terms.get.includes(i.id));

  async function send() {
    setBusy(true); setError(undefined);
    try {
      const o = await api<Offer>('/offers', { method: 'POST', idempotencyKey: key.current, body: { offeredListingIds: terms.give, requestedListingIds: terms.get, cashAmount: terms.cash, cashPayer: terms.payer, message: terms.message || undefined } });
      toast.success('Offer sent!'); router.replace(`/offers/${o.id}`);
    } catch (e) {
      if (e instanceof ApiError) { setError(e.code === 'OFFER_EXISTS' ? 'You already have an open offer on this item. Find it under Offers.' : e.message); setStep('build'); } else setError('Could not send your offer. Check your connection and try again.');
      key.current = newIdempotencyKey();
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl pb-32 md:pb-0">
      <Button asChild variant="ghost" size="sm" className="-ml-3"><Link href={`/listing/${id}`}><ArrowLeft className="size-4" aria-hidden />Back to item</Link></Button>
      <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{step === 'build' ? 'Build your swap' : 'Review your offer'}</h1>
      <p className="mb-8 mt-1 text-muted">with {t.owner.displayName} · step {step === 'build' ? 1 : 2} of 2</p>
      {step === 'build' ? (<>
        <TermsEditor state={terms} onChange={setTerms} getPool={getPool} givePool={givePool} getTitle={`What you'd like from ${t.owner.displayName}`} giveTitle="What you'd offer" error={error}
          giveEmpty={<div className="rounded-2xl border border-dashed border-line p-5 text-sm"><p className="font-semibold">You have no active listings.</p><p className="text-muted">You can still propose a cash-only offer, or <Link href="/listing/new" className="font-semibold text-ink underline">list an item</Link> to swap.</p></div>} />
        <div className="fixed inset-x-0 bottom-[4.6rem] z-30 border-t border-line bg-paper/95 p-3 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"><div className="mx-auto flex max-w-3xl flex-col items-stretch gap-1 md:items-end"><Button size="lg" className="w-full md:w-auto" disabled={!valid} onClick={() => setStep('review')}>Review offer<ArrowRight className="size-5" aria-hidden /></Button>{!valid && <p className="text-center text-xs text-muted md:text-right">Pick an item you want, plus something to offer or a cash amount.</p>}</div></div>
      </>) : (<div className="space-y-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <TermsSummary senderName="You" recipientName={t.owner.displayName} offered={offered} requested={requested} cashAmount={terms.cash} cashPayerName={terms.payer === 'ME' ? 'you' : t.owner.displayName} message={terms.message} />
        </div>
        <div className="space-y-2 rounded-2xl bg-butter p-4 text-sm text-butter-ink"><p className="font-semibold">Before you send</p><ul className="list-disc space-y-1 pl-5"><li>{t.owner.displayName} can accept, counter, or decline. Nothing is agreed until someone accepts the exact terms.</li><li>The offer expires in 72 hours if nobody responds.</li></ul><CashNote /></div>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('build')}>Edit</Button><Button size="lg" onClick={send} loading={busy}><Send className="size-5" aria-hidden />Send offer</Button></div>
      </div>)}
    </div>
  );
}
