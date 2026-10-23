'use client';
import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, MapPin, Star } from 'lucide-react';
import { GridSkeleton, ListingCard, ListingGrid } from '@/components/listing/listing-card';
import { Avatar, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { Listing, Page, PublicProfile, Review } from '@/lib/types';

export function ProfileHeader({ p, actions }: { p: PublicProfile; actions?: React.ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      {/* Cover accent: decorative gradient band in the brand palette */}
      <div aria-hidden className="profile-cover h-24 md:h-32" />
      <div className="flex flex-col gap-5 px-6 pb-6 md:flex-row md:items-end md:px-8 md:pb-8">
      <span className="-mt-12 w-fit rounded-full ring-4 ring-surface md:-mt-14"><Avatar name={p.displayName} src={p.avatarUrl} size={96} /></span>
      <div className="min-w-0 flex-1"><h1 className="flex flex-wrap items-center gap-2 text-3xl font-extrabold">{p.displayName}{p.verified && <Badge tone="mint"><BadgeCheck className="size-3" aria-hidden />Email verified</Badge>}</h1>
        {p.bio && <p className="mt-1 max-w-xl text-muted">{p.bio}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">{(p.locationCity || p.locationRegion) && <span className="flex items-center gap-1"><MapPin className="size-4" aria-hidden />{[p.locationCity, p.locationRegion].filter(Boolean).join(', ')}</span>}<span>Joined {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span></p></div>
      <dl className="grid grid-cols-3 gap-4 text-center"><div><dd className="text-2xl font-black">{p.stats.completedSwaps}</dd><dt className="text-xs text-muted">Swaps</dt></div><div><dd className="text-2xl font-black">{p.stats.averageRating ? p.stats.averageRating.toFixed(1) : '—'}</dd><dt className="text-xs text-muted">Rating</dt></div><div><dd className="text-2xl font-black">{p.stats.reviewCount}</dd><dt className="text-xs text-muted">Reviews</dt></div></dl>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </Card>
  );
}

export function UserListings({ userId, own }: { userId: string; own?: boolean }) {
  const q = useQuery({ queryKey: ['user-listings', userId], queryFn: () => api<Page<Listing>>(`/listings?ownerId=${userId}&limit=50`) });
  if (q.isLoading) return <GridSkeleton n={4} />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data!.items.length) return <EmptyState art="box" title={own ? "You haven't listed anything yet" : 'Nothing listed right now'} body={own ? 'List something you no longer use — someone out there wants it.' : undefined} />;
  if (!own) return <ListingGrid>{q.data!.items.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid>;
  // My items: grouped so unavailable listings are clearly separate from ones people can still offer on.
  const groups: [string, string, Listing['status']][] = [['Active', 'People can make offers on these.', 'ACTIVE'], ['In a deal', 'Reserved until the swap is completed or cancelled.', 'RESERVED'], ['Swapped', 'Completed swaps.', 'EXCHANGED'], ['Under review', 'Hidden while moderators check them.', 'UNDER_REVIEW']];
  return <div className="space-y-10">{groups.map(([title, hint, st]) => { const items = q.data!.items.filter((l) => l.status === st); if (!items.length) return null; return <section key={st} aria-label={title}><h3 className="text-lg font-black">{title} <span className="text-sm font-semibold text-muted">· {items.length}</span></h3><p className="mb-4 text-sm text-muted">{hint}</p><ListingGrid>{items.map((l) => <ListingCard key={l.id} listing={l} />)}</ListingGrid></section>; })}</div>;
}

export function UserReviews({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ['user-reviews', userId], queryFn: () => api<(Review & { author: { id: string; displayName: string } })[]>(`/users/${userId}/reviews`) });
  if (q.isLoading) return <Skeleton className="h-24" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data!.length) return <EmptyState art="heart" title="No reviews yet" body="Reviews appear after a swap is completed by both people." />;
  return <ul className="space-y-3">{q.data!.map((r) => <li key={r.id} className="rounded-2xl border border-line bg-surface p-4"><p className="flex items-center gap-2 text-sm font-bold"><span className="flex" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-4 ${n <= r.rating ? 'fill-coral text-coral' : 'text-line'}`} aria-hidden />)}</span>{r.author.displayName}<span className="font-normal text-muted">· verified swap · {timeAgo(r.createdAt)}</span></p>{r.body && <p className="mt-1.5 text-sm">{r.body}</p>}</li>)}</ul>;
}
