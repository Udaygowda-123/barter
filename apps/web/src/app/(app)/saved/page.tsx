'use client';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import { GridSkeleton, ListingCard, ListingGrid } from '@/components/listing/listing-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Listing } from '@/lib/types';

export default function Saved() {
  const { status } = useRequireAuth();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api<Listing[]>('/favorites'), enabled: status === 'authed' });
  return (
    <div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Saved</h1><p className="mt-1 text-muted">Items you&apos;ve hearted.</p>
      <div className="mt-8">{q.isLoading || status === 'loading' ? <GridSkeleton n={4} /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data!.length === 0 ? <EmptyState icon={<Heart className="size-7" aria-hidden />} title="Nothing saved yet" body="Tap the heart on anything you like and it'll wait for you here." action={<Button asChild><Link href="/discover">Discover items</Link></Button>} /> : <ListingGrid>{q.data!.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>}</div>
    </div>
  );
}
