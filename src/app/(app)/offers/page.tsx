'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Inbox } from 'lucide-react';
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
  const { user, status } = useRequireAuth(); const [box, setBox] = useState<(typeof TABS)[number]['id']>('all');
  const q = useQuery({ queryKey: ['offers', box], queryFn: () => api<Page<Offer>>(`/offers?box=${box}&limit=50`), enabled: status === 'authed', refetchOnWindowFocus: true });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-black tracking-tight md:text-5xl">Offers</h1><p className="mt-1 text-muted">Everything you&apos;re negotiating, in one place.</p>
      <div role="tablist" aria-label="Offer filter" className="mt-6 flex gap-2">{TABS.map((t) => <Chip key={t.id} role="tab" aria-selected={box === t.id} active={box === t.id} onClick={() => setBox(t.id)}>{t.label}</Chip>)}</div>
      <div className="mt-6 space-y-3" aria-live="polite">
        {q.isLoading || status !== 'authed' ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />) : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data!.items.length === 0 ? (
          <EmptyState icon={<Inbox className="size-7" aria-hidden />} title="No offers yet" body="Find something you love and propose a swap — your offers and the ones you receive show up here." action={<Button asChild><Link href="/discover">Discover items</Link></Button>} />
        ) : q.data!.items.map((o) => {
          const other = o.sender.id === user?.id ? o.recipient : o.sender; const latest = o.revisions[o.revisions.length - 1]; const open = o.status === 'PENDING' || o.status === 'COUNTERED';
          return (
            <Link key={o.id} href={`/offers/${o.id}`} className="flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-colors hover:border-ink">
              <span className="size-20 shrink-0 overflow-hidden rounded-2xl bg-ink/5">{o.targetListing.thumbUrl && <img src={o.targetListing.thumbUrl} alt="" className="size-full object-cover" />}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2"><OfferStatusBadge status={o.status} />{o.yourTurn && <Badge tone="coral">Your turn</Badge>}{o.deal && <Badge tone="mint">Deal</Badge>}</span>
                <span className="mt-1.5 block truncate font-bold">{o.targetListing.title}</span>
                <span className="flex items-center gap-2 text-sm text-muted"><Avatar name={other.displayName} src={other.avatarUrl} size={20} />{o.sender.id === user?.id ? 'You offered to' : ''} {other.displayName}{o.sender.id !== user?.id && ' offered'}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted"><span className="inline-flex items-center gap-1"><ArrowLeftRight className="size-3" aria-hidden />v{latest.number} · {latest.offered.length} for {latest.requested.length}{latest.cashAmount > 0 && ` + ${formatINR(latest.cashAmount)}`}</span><span>{open ? timeLeft(o.expiresAt) : timeAgo(o.updatedAt)}</span></span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
