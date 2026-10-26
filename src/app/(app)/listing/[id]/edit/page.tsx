'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ListingForm } from '@/components/listing/listing-form';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Listing } from '@/lib/types';
import { BackButton } from '@/components/ui/back-button';

export default function EditListing() {
  const { id } = useParams<{ id: string }>(); const { status } = useRequireAuth();
  const q = useQuery({ queryKey: ['listing-edit', id], queryFn: () => api<Listing>(`/listings/${id}`), enabled: status === 'authed' });
  if (status !== 'authed' || q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const l = q.data!;
  if (!l.isOwner) return <EmptyState title="You can only edit your own listings" action={<Button asChild><Link href={`/listing/${id}`}>Back to listing</Link></Button>} />;
  if (l.status !== 'ACTIVE') return <EmptyState title="This listing can't be edited right now" body="Listings that are part of a deal, swapped or removed are locked." action={<Button asChild><Link href={`/listing/${id}`}>Back to listing</Link></Button>} />;
  return <div className="mx-auto max-w-3xl"><BackButton fallback={`/listing/${id}`} label="Back to listing" className="mb-3" /><h1 className="mb-10 text-3xl font-black tracking-tight md:text-5xl">Edit listing</h1><ListingForm listing={l} /></div>;
}
