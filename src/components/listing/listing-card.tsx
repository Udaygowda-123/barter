'use client';
import { CONDITION_LABELS } from '@/shared/types';
import { Heart, Images, MapPin, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Listing } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export const coverOf = (l: Pick<Listing, 'images'>) => l.images.find((i) => i.isCover) ?? l.images[0];

export function StatusBadge({ status }: { status: Listing['status'] }) {
  if (status === 'ACTIVE') return null;
  const map = { RESERVED: ['butter', 'In a deal'], EXCHANGED: ['mint', 'Swapped'], REMOVED: ['danger', 'Removed'], UNDER_REVIEW: ['danger', 'Under review'] } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ListingCard({ listing, onDismiss, priority }: { listing: Listing; onDismiss?: (id: string) => void; priority?: boolean }) {
  const { status } = useAuth(); const router = useRouter(); const toast = useToast(); const qc = useQueryClient();
  const prefetch = () => { void qc.prefetchQuery({ queryKey: ['listing', listing.id, status === 'authed'], queryFn: () => api<Listing>(`/listings/${listing.id}`), staleTime: 30_000 }); };
  const [fav, setFav] = useState(!!listing.favorited); const [busy, setBusy] = useState(false);
  const cover = coverOf(listing);

  async function toggleFav(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (status !== 'authed') return router.push(`/login?next=${encodeURIComponent(`/listing/${listing.id}`)}`);
    setBusy(true); const next = !fav; setFav(next);
    try { await api(`/listings/${listing.id}/favorite`, { method: next ? 'POST' : 'DELETE' }); toast.success(next ? 'Saved' : 'Removed from saved'); }
    catch (err) { setFav(!next); toast.error(err instanceof ApiError ? err.message : 'Could not update saved items'); } finally { setBusy(false); }
  }

  return (
    <article className="group relative">
      <Link href={`/listing/${listing.id}`} onPointerEnter={prefetch} onTouchStart={prefetch} onFocus={prefetch} className="block rounded-[var(--radius-card)]" aria-label={`${listing.title}, ${formatINR(listing.estimatedValue)}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-ink/5">
          {cover ? <img src={cover.thumbUrl ?? cover.url} alt={cover.altText ?? listing.title} width={480} height={600} decoding="async" fetchPriority={priority ? 'high' : 'auto'} loading={priority ? 'eager' : 'lazy'} className={cn('size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]', listing.status !== 'ACTIVE' && 'opacity-60 saturate-50')} /> : <div className="flex size-full items-center justify-center text-muted">No photo</div>}
          <div className="absolute left-2 top-2 flex max-w-[65%] flex-wrap gap-1 md:left-3 md:top-3 md:gap-1.5">
            <StatusBadge status={listing.status} />
            {listing.isSeedData && <Badge tone="ink">Demo</Badge>}
            {cover?.aiEdited && <Badge tone="lavender"><Sparkles className="size-3" aria-hidden />AI-enhanced</Badge>}
            {listing.images.length > 1 && <Badge tone="ink" className="absolute bottom-[4.2rem] right-2 md:bottom-[4.6rem] md:right-3"><Images className="size-3" aria-hidden />{listing.images.length}</Badge>}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/35 to-transparent p-3 pt-14 text-paper md:p-4 md:pt-16">
            <h3 className="line-clamp-2 text-[15px] font-bold leading-tight md:text-lg">{listing.title}</h3>
            <p className="mt-0.5 truncate text-xs text-paper/90 md:mt-1 md:text-sm">{listing.estimatedValue != null ? `~${formatINR(listing.estimatedValue)}` : 'No value'} · {CONDITION_LABELS[listing.condition]}</p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-sm">
          <span className="flex min-w-0 items-center gap-1 text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{listing.locationCity ?? 'Location not shared'}</span></span>
          <span className="hidden truncate font-medium sm:inline">{listing.owner.displayName}</span>
        </div>
        {listing.match && listing.match.reasons.length > 0 && <p className="mt-1.5 line-clamp-1 rounded-full bg-lavender px-3 py-1 text-xs font-semibold text-lavender-ink">✦ {listing.match.reasons[0]}</p>}
      </Link>
      {!listing.isOwner && (
        <div className="absolute right-2 top-2 flex flex-col gap-2 md:right-3 md:top-3">
          <button onClick={toggleFav} disabled={busy} aria-pressed={fav} aria-label={fav ? `Remove ${listing.title} from saved` : `Save ${listing.title}`} className="flex size-10 items-center justify-center rounded-full bg-paper/95 shadow-md transition-transform hover:scale-105 active:scale-95 md:size-11">
            <Heart className={cn('size-5', fav && 'fill-coral text-coral')} aria-hidden />
          </button>
          {onDismiss && <button onClick={(e) => { e.preventDefault(); onDismiss(listing.id); }} aria-label={`Not interested in ${listing.title}`} className="hidden size-11 items-center justify-center rounded-full bg-paper/95 shadow-md transition-transform hover:scale-105 active:scale-95 md:flex"><X className="size-5" aria-hidden /></button>}
        </div>
      )}
    </article>
  );
}

export const CardSkeleton = () => (<div aria-hidden><Skeleton className="aspect-[4/5] rounded-[var(--radius-card)]" /><Skeleton className="mt-3 h-4 w-2/3" /></div>);
export const GridSkeleton = ({ n = 8 }: { n?: number }) => (<div role="status" aria-label="Loading listings" className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-4 md:gap-y-8 lg:grid-cols-4">{Array.from({ length: n }, (_, i) => <CardSkeleton key={i} />)}</div>);
export const ListingGrid = ({ children }: { children: React.ReactNode }) => (<div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-4 md:gap-y-8 lg:grid-cols-4">{children}</div>);
