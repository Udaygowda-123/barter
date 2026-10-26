'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OfferStatusBadge } from '@/components/offers/terms';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Chip, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { formatINR, timeAgo, timeLeft } from '@/lib/format';
import type { Offer, Page } from '@/lib/types';

const TABS = [{ id: 'all', label: 'All' }, { id: 'received', label: 'Received' }, { id: 'sent', label: 'Sent' }] as const;

export default function Offers() {
  const { user, status } = useRequireAuth(); const [box, setBox] = useState<(typeof TABS)[number]['id']>('all'); const [state, setState] = useState<'' | 'open' | 'closed'>('');
  const q = useQuery({ queryKey: ['offers', box, state], queryFn: () => api<Page<Offer>>(`/offers?box=${box}&limit=50${state ? `&state=${state}` : ''}`), enabled: status === 'authed', refetchOnWindowFocus: true, placeholderData: keepPreviousData });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-extrabold md:text-5xl">Your <em className="accent font-normal text-cobalt-ink">offers</em></h1><p className="mt-1 text-muted">Everything you&apos;re negotiating, in one place.</p>
      <div role="tablist" aria-label="Offer filter" className="mt-6 flex gap-2">{TABS.map((t) => <Chip key={t.id} role="tab" aria-selected={box === t.id} active={box === t.id} onClick={() => setBox(t.id)}>{t.label}</Chip>)}</div>
      <div role="tablist" aria-label="Offer state" className="mt-2 flex gap-2">{([['', 'Any status'], ['open', 'Needs action / open'], ['closed', 'Closed']] as const).map(([v, l]) => <Chip key={v} role="tab" aria-selected={state === v} active={state === v} className="h-9 text-xs" onClick={() => setState(v)}>{l}</Chip>)}</div>
      <div className="mt-6 space-y-6" aria-live="polite">
        {q.isLoading || status !== 'authed' ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />) : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data!.items.length === 0 ? (
          <EmptyState art="swap" title="No offers yet" body="Find something you love and propose a swap — your offers and the ones you receive show up here." action={<Button asChild><Link href="/discover">Discover items</Link></Button>} />
        ) : GROUPS.map((g) => {
          const items = q.data!.items.filter((o) => group(o) === g.id);
          if (!items.length) return null;
          return (
            <section key={g.id} aria-labelledby={`g-${g.id}`} className="space-y-3">
              <h2 id={`g-${g.id}`} className="flex items-center gap-2 pt-2 text-lg font-bold">{g.label}<span className="rounded-full bg-ink/5 px-2 text-xs font-semibold text-muted">{items.length}</span></h2>
              {items.map((o) => <OfferRow key={o.id} o={o} me={user?.id} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Grouped by what needs attention; derived only from the server's offer state (no client-side rules).
const GROUPS = [{ id: 'yours', label: 'Needs your response' }, { id: 'theirs', label: 'Waiting for them' }, { id: 'deals', label: 'Deals' }, { id: 'closed', label: 'Closed' }] as const;
function group(o: Offer): (typeof GROUPS)[number]['id'] {
  if (o.deal) return 'deals';
  if (o.status === 'PENDING' || o.status === 'COUNTERED') return o.yourTurn ? 'yours' : 'theirs';
  return 'closed';
}

function Thumbs({ items }: { items: { id: string; thumbUrl: string | null }[] }) {
  return (
    <span className="flex -space-x-3">
      {items.slice(0, 2).map((l) => <span key={l.id} className="size-14 overflow-hidden rounded-2xl bg-ink/5 ring-2 ring-surface">{l.thumbUrl && <img src={l.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />}</span>)}
      {items.length > 2 && <span className="grid size-14 place-items-center rounded-2xl bg-ink/5 text-xs font-bold ring-2 ring-surface">+{items.length - 2}</span>}
    </span>
  );
}

function OfferRow({ o, me }: { o: Offer; me?: string }) {
  const mine = o.sender.id === me; const other = mine ? o.recipient : o.sender; const latest = o.revisions[o.revisions.length - 1]; const open = o.status === 'PENDING' || o.status === 'COUNTERED';
  // "You give" is always shown on the left from the viewer's perspective.
  const give = mine ? latest.offered : latest.requested; const get = mine ? latest.requested : latest.offered;
  return (
    <Link href={`/offers/${o.id}`} className={`block rounded-[var(--radius-card)] border bg-surface p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-ink ${o.yourTurn ? 'border-cobalt/50' : 'border-line'}`}>
      <span className="flex flex-wrap items-center gap-2"><OfferStatusBadge status={o.status} />{o.yourTurn && <Badge tone="cobalt">Your turn</Badge>}{o.deal && <Badge tone="mint">Deal</Badge>}<span className="ml-auto text-xs text-muted">{open ? timeLeft(o.expiresAt) : timeAgo(o.updatedAt)}</span></span>
      <span className="mt-3 flex items-center gap-3">
        <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-wider text-muted">You give</span><span className="mt-1 flex items-center gap-2"><Thumbs items={give} /></span></span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-coral text-ink"><ArrowLeftRight className="size-4" aria-hidden /></span>
        <span className="min-w-0 flex-1 text-right"><span className="block text-[11px] font-bold uppercase tracking-wider text-muted">You get</span><span className="mt-1 flex justify-end"><Thumbs items={get} /></span></span>
      </span>
      <span className="mt-3 block truncate font-bold">{o.targetListing.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted"><Avatar name={other.displayName} src={other.avatarUrl} size={20} />{mine ? `You offered to ${other.displayName}` : `${other.displayName} offered`}<span aria-hidden>·</span><span>v{latest.number}{latest.cashAmount > 0 && ` + ${formatINR(latest.cashAmount)} cash`}</span></span>
    </Link>
  );
}
