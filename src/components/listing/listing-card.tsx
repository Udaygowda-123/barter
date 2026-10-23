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
import { useRouter } from 'next/navigation';

export const coverOf = (l: Pick<Listing, 'images'>) => l.images.find((i) => i.isCover) ?? l.images[0];

export function StatusBadge({ status }: { status: Listing['status'] }) {
  if (status === 'ACTIVE') return null;
  const map = { RESERVED: ['butter', 'In a deal'], EXCHANGED: ['mint', 'Swapped'], REMOVED: ['danger', 'Removed'], UNDER_REVIEW: ['danger', 'Under review'] } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function ListingCard({ listing, onDismiss, priority }: { listing: Listing; onDismiss?: (id: string) => void; priority?: boolean }) {
  const { status } = useAuth(); const router = useRouter(); const toast = useToast();
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
      <Link href={`/listing/${listing.id}`} className="block rounded-[var(--radius-card)]" aria-label={`${listing.title}, ${formatINR(listing.estimatedValue)}`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-card)] bg-ink/5">
          {cover ? <img src={cover.thumbUrl ?? cover.url} alt={cover.altText ?? listing.title} loading={priority ? 'eager' : 'lazy'} className={cn('size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]', listing.status !== 'ACTIVE' && 'opacity-60 saturate-50')} /> : <div className="flex size-full items-center justify-center text-muted">No photo</div>}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <StatusBadge status={listing.status} />
            {listing.isSeedData && <Badge tone="ink">Demo</Badge>}
            {cover?.aiEdited && <Badge tone="lavender"><Sparkles className="size-3" aria-hidden />AI-enhanced</Badge>}
            {listing.images.length > 1 && <Badge tone="ink" className="absolute bottom-[4.6rem] right-3"><Images className="size-3" aria-hidden />{listing.images.length}</Badge>}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/75 via-ink/30 to-transparent p-4 pt-16 text-paper">
            <h3 className="line-clamp-2 text-lg font-bold leading-tight">{listing.title}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-paper/85"><span>{CONDITION_LABELS[listing.condition]}</span><span aria-hidden>·</span><span>{listing.estimatedValue != null ? `~${formatINR(listing.estimatedValue)}` : 'Value not set'}</span></p>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 px-1 text-sm">
          <span className="flex min-w-0 items-center gap-1 text-muted"><MapPin className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{listing.locationCity ?? 'Location not shared'}</span></span>
          <span className="truncate font-medium">{listing.owner.displayName}</span>
        </div>
        {listing.match && listing.match.reasons.length > 0 && <p className="mt-1.5 line-clamp-1 rounded-full bg-lavender px-3 py-1 text-xs font-semibold text-lavender-ink">✦ {listing.match.reasons[0]}</p>}
      </Link>
      {!listing.isOwner && (
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <button onClick={toggleFav} disabled={busy} aria-pressed={fav} aria-label={fav ? `Remove ${listing.title} from saved` : `Save ${listing.title}`} className="flex size-11 items-center justify-center rounded-full bg-paper/95 shadow-md transition-transform hover:scale-105 active:scale-95">
            <Heart className={cn('size-5', fav && 'fill-coral text-coral')} aria-hidden />
          </button>
          {onDismiss && <button onClick={(e) => { e.preventDefault(); onDismiss(listing.id); }} aria-label={`Not interested in ${listing.title}`} className="flex size-11 items-center justify-center rounded-full bg-paper/95 shadow-md transition-transform hover:scale-105 active:scale-95"><X className="size-5" aria-hidden /></button>}
        </div>
      )}
    </article>
  );
}

export const CardSkeleton = () => (<div aria-hidden><Skeleton className="aspect-[4/5] rounded-[var(--radius-card)]" /><Skeleton className="mt-3 h-4 w-2/3" /></div>);
export const GridSkeleton = ({ n = 8 }: { n?: number }) => (<div role="status" aria-label="Loading listings" className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: n }, (_, i) => <CardSkeleton key={i} />)}</div>);
export const ListingGrid = ({ children }: { children: React.ReactNode }) => (<div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">{children}</div>);
