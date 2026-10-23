'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { CashNote, TermsEditor, TermsState, TermsSummary, toBrief } from '@/components/offers/terms';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Listing, ListingBrief, Offer, Page } from '@/lib/types';
import { formatINR } from '@/lib/format';

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
      <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">{step === 'build' ? <>Build your <em className="accent font-normal text-cobalt-ink">swap</em></> : <>Review your <em className="accent font-normal text-cobalt-ink">offer</em></>}</h1>
      <p className="mb-6 mt-1 text-muted">with {t.owner.displayName} · step {step === 'build' ? 1 : 2} of 2</p>
      {step === 'build' ? (<>
        <ProposalStrip give={offered} get={requested} cash={terms.cash} cashFromYou={terms.payer === 'ME'} owner={t.owner.displayName} />
        <TermsEditor state={terms} onChange={setTerms} getPool={getPool} givePool={givePool} getTitle={`You want — from ${t.owner.displayName}`} giveTitle="You're offering" error={error}
          giveEmpty={<div className="rounded-2xl border border-dashed border-line p-5 text-sm"><p className="font-semibold">You have no active listings.</p><p className="text-muted">You can still propose a cash-only offer, or <Link href="/listing/new" className="font-semibold text-ink underline">list an item</Link> to swap.</p></div>} />
        <div className="fixed inset-x-0 bottom-[4.6rem] z-30 border-t border-line bg-paper/95 p-3 backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"><div className="mx-auto flex max-w-3xl flex-col items-stretch gap-1 md:items-end"><Button size="lg" className="w-full md:w-auto" disabled={!valid} onClick={() => setStep('review')}>Review offer<ArrowRight className="size-5" aria-hidden /></Button>{!valid && <p className="text-center text-xs text-muted md:text-right">Pick an item you want, plus something to offer or a cash amount.</p>}</div></div>
      </>) : (<div className="space-y-6">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <TermsSummary labels={{ left: "You're offering", right: 'You want' }} senderName="You" recipientName={t.owner.displayName} offered={offered} requested={requested} cashAmount={terms.cash} cashPayerName={terms.payer === 'ME' ? 'you' : t.owner.displayName} message={terms.message} />
        </div>
        <div className="space-y-2 rounded-2xl bg-butter p-4 text-sm text-butter-ink"><p className="font-semibold">Before you send</p><ul className="list-disc space-y-1 pl-5"><li>{t.owner.displayName} can accept, counter, or decline. Nothing is agreed until someone accepts the exact terms.</li><li>The offer expires in 72 hours if nobody responds.</li></ul><CashNote /></div>
        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
        <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('build')}>Edit</Button><Button size="lg" onClick={send} loading={busy}><Send className="size-5" aria-hidden />Send offer</Button></div>
      </div>)}
    </div>
  );
}

/** Live preview of the proposal as it is being built (display only; the terms state remains the source). */
function ProposalStrip({ give, get, cash, cashFromYou, owner }: { give: ListingBrief[]; get: ListingBrief[]; cash: number; cashFromYou: boolean; owner: string }) {
  const side = (label: string, items: ListingBrief[], extra: string | null, align: 'left' | 'right') => (
    <div className={align === 'right' ? 'min-w-0 flex-1 text-right' : 'min-w-0 flex-1'}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-paper/60">{label}</p>
      <div className={`mt-2 flex gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {items.length ? items.slice(0, 3).map((i) => <span key={i.id} className="size-12 overflow-hidden rounded-xl bg-white/10 sm:size-14">{i.thumbUrl && <img src={i.thumbUrl} alt={i.title} className="size-full object-cover" />}</span>) : <span className="grid h-12 place-items-center rounded-xl border border-dashed border-white/30 px-3 text-xs text-paper/70 sm:h-14">Nothing yet</span>}
        {items.length > 3 && <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-xs font-bold sm:size-14">+{items.length - 3}</span>}
      </div>
      {extra && <p className="mt-1.5 text-xs font-semibold text-violet">{extra}</p>}
    </div>
  );
  const cashText = cash > 0 ? `+ ${formatINR(cash)} cash` : null;
  return (
    <div aria-live="polite" className="on-ink mb-8 flex items-center gap-3 rounded-[var(--radius-card)] bg-ink p-4 text-paper shadow-[var(--shadow-pop)] sm:p-5">
      {side("You're offering", give, cashFromYou ? cashText : null, 'left')}
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-coral text-ink"><ArrowLeftRight className="size-5" aria-hidden /></span>
      {side(`From ${owner}`, get, !cashFromYou ? cashText : null, 'right')}
    </div>
  );
}
