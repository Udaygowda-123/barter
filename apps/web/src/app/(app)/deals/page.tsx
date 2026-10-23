'use client';
import { useQuery } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { DEAL_TONE } from '@/lib/deal';
import { timeAgo } from '@/lib/format';
import type { Deal } from '@/lib/types';

export default function Deals() {
  const { status } = useRequireAuth();
  const q = useQuery({ queryKey: ['deals'], queryFn: () => api<Deal[]>('/deals'), enabled: status === 'authed' });
  return (
    <div className="mx-auto max-w-3xl"><h1 className="text-3xl font-black tracking-tight md:text-5xl">Deals</h1><p className="mt-1 text-muted">Accepted swaps and where they stand.</p>
      <div className="mt-6 space-y-3">{q.isLoading || status !== 'authed' ? [0, 1].map((i) => <Skeleton key={i} className="h-24" />) : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data!.length === 0 ? <EmptyState icon={<Handshake className="size-7" aria-hidden />} title="No deals yet" body="When an offer is accepted, the deal appears here with handover and completion steps." action={<Button asChild><Link href="/offers">View offers</Link></Button>} /> :
        q.data!.map((d) => (
          <Link key={d.id} href={`/deals/${d.id}`} className="block rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-ink">
            <div className="flex items-center justify-between gap-3"><Badge tone={DEAL_TONE[d.status]}>{d.status.toLowerCase()}</Badge><span className="text-xs text-muted">{timeAgo(d.createdAt)}</span></div>
            <p className="mt-2 font-bold">{d.terms.giving.map((i) => i.title).join(', ') || 'Cash'} ⇄ {d.terms.receiving.map((i) => i.title).join(', ')}</p><p className="text-sm text-muted">with {d.counterpart.displayName}</p>
          </Link>))}</div></div>
  );
}
