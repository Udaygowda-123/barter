'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CASH_FLEXIBILITY, CATEGORY_LABELS, CONDITION_LABELS, VALUE_DISCLAIMER } from '@/shared/types';
import { ArrowLeftRight, BadgeCheck, Flag, Heart, MapPin, Pencil, ShieldAlert, Trash2, Truck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Gallery } from '@/components/listing/gallery';
import { ListingCard, ListingGrid, StatusBadge } from '@/components/listing/listing-card';
import { ReportDialog } from '@/components/listing/report-dialog';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cardSeed } from '@/lib/seed';
import { formatINR, timeAgo } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Listing } from '@/lib/types';

const CASH_TEXT: Record<(typeof CASH_FLEXIBILITY)[number], string> = { NONE: 'Prefers a straight swap', WILL_ADD: 'Happy to add cash', WILL_ACCEPT: 'Happy to take cash on top', EITHER: 'Open to cash either way' };

export default function ListingClient({ id, initial }: { id: string; initial: Listing | null }) { const { user, status } = useAuth(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [reporting, setReporting] = useState(false); const [removing, setRemoving] = useState(false);
  const q = useQuery({ queryKey: ['listing', id, status === 'authed'], queryFn: () => api<Listing>(`/listings/${id}`), enabled: status !== 'loading', retry: false, placeholderData: (prev) => prev ?? initial ?? cardSeed(qc, id) });
  const [fav, setFav] = useState<boolean | null>(null);
  const l = q.data; const isFav = fav ?? !!l?.favorited;

  const remove = useMutation({
    mutationFn: () => api(`/listings/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Listing removed'); qc.invalidateQueries(); router.replace('/profile'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not remove listing'),
  });
  async function toggleFav() {
    if (status !== 'authed') return router.push(`/login?next=/listing/${id}`);
    const next = !isFav; setFav(next);
    try { await api(`/listings/${id}/favorite`, { method: next ? 'POST' : 'DELETE' }); toast.success(next ? 'Saved' : 'Removed from saved'); } catch { setFav(!next); toast.error('Could not update saved items'); }
  }

  if (!q.data && (q.isLoading || status === 'loading')) return <div className="grid gap-10 md:grid-cols-2"><Skeleton className="aspect-[4/5]" /><div className="space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-40" /></div></div>;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState title="This listing isn't available" body="It may have been removed, or the owner has restricted who can see it." action={<Button asChild><Link href="/discover">Back to discover</Link></Button>} />;
  if (q.isError || !l) return <ErrorState onRetry={() => q.refetch()} />;

  const available = l.status === 'ACTIVE';
  const pending = q.isPlaceholderData && status === 'authed'; // viewer-specific flags (isOwner, favorited) not loaded yet
  const place = [l.locationCity, l.locationRegion].filter(Boolean).join(', ');
  const actions = pending ? (
    <div className="h-14 skeleton rounded-full" aria-hidden />
  ) : l.isOwner ? (
    <div className="flex gap-3"><Button asChild variant="outline" className="flex-1"><Link href={`/listing/${l.id}/edit`}><Pencil className="size-4" aria-hidden />Edit</Link></Button><Button variant="outline" className="flex-1" onClick={() => setRemoving(true)} disabled={l.status === 'RESERVED' || l.status === 'EXCHANGED'}><Trash2 className="size-4" aria-hidden />Remove</Button></div>
  ) : (
    <div className="flex gap-3">
      <Button asChild size="lg" className={cn('min-w-0 flex-1 px-4', !available && 'pointer-events-none opacity-50')} aria-disabled={!available}><Link href={`/swap/${l.id}`}><ArrowLeftRight className="size-5" aria-hidden />{available ? 'Make an offer' : 'Not available'}</Link></Button>
      <Button variant="outline" size="icon" className="size-14 shrink-0" onClick={toggleFav} aria-pressed={isFav} aria-label={isFav ? 'Remove from saved' : 'Save item'}><Heart className={cn('size-6', isFav && 'fill-coral text-coral')} aria-hidden /></Button>
    </div>
  );
  return (
    <div className="pb-24 lg:pb-0">
      <Gallery images={l.images} title={l.title} />

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_24rem] lg:gap-14">
        <div className="space-y-6">
          <header>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="lavender">{CATEGORY_LABELS[l.category]}</Badge><Badge>{CONDITION_LABELS[l.condition]}</Badge><StatusBadge status={l.status} />{l.isSeedData && <Badge tone="ink">Demo listing</Badge>}</div>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">{l.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted"><span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{place || 'Location not shared'}</span><span>Listed {timeAgo(l.createdAt)}</span><span>{l.images.length} photo{l.images.length === 1 ? '' : 's'}</span></p>
          </header>

          {/* Hinge-style prompt cards */}
          <section aria-label="Item details" className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[2rem] bg-coral-soft p-7 sm:col-span-2"><h2 className="text-xs font-bold uppercase tracking-widest text-coral-ink">I&apos;d swap this for</h2><p className="mt-3 text-3xl font-black leading-tight tracking-tight md:text-4xl">{l.wantedText || 'Open to offers'}</p>{l.wantedCategories.length > 0 && <p className="mt-4 flex flex-wrap gap-2">{l.wantedCategories.map((c) => <Badge key={c} tone="coral">{CATEGORY_LABELS[c]}</Badge>)}</p>}</article>
            <article className="rounded-[2rem] bg-lavender p-7 sm:col-span-2"><h2 className="text-xs font-bold uppercase tracking-widest text-lavender-ink">The story</h2><p className="mt-3 whitespace-pre-line text-lg leading-relaxed">{l.description}</p></article>
            {l.images[3] && <img src={l.images[3].url} alt={l.images[3].altText ?? l.title} loading="lazy" className="aspect-[4/3] w-full rounded-[2rem] object-cover sm:col-span-2" />}
            <article className="rounded-[2rem] bg-mint p-7"><h2 className="text-xs font-bold uppercase tracking-widest text-mint-ink">Cash difference</h2><p className="mt-3 text-2xl font-black leading-tight">{CASH_TEXT[l.cashFlexibility]}</p><p className="mt-2 text-sm text-mint-ink">Cash is only ever a proposal between you two.</p></article>
            <article className="rounded-[2rem] bg-butter p-7"><h2 className="text-xs font-bold uppercase tracking-widest text-butter-ink">How to exchange</h2><ul className="mt-3 space-y-2 text-xl font-black">{l.exchangeMethods.map((m) => <li key={m} className="flex items-center gap-2">{m === 'SHIPPING' ? <Truck className="size-5" aria-hidden /> : <Users className="size-5" aria-hidden />}{m === 'SHIPPING' ? 'Shipping' : 'Local meet-up'}</li>)}</ul></article>
          </section>

          <Card className="flex items-center gap-4 p-5">
            <Avatar name={l.owner.displayName} src={l.owner.avatarUrl} size={56} />
            <div className="min-w-0 flex-1"><p className="flex items-center gap-1.5 text-lg font-bold"><Link href={`/u/${l.owner.id}`} className="truncate hover:underline">{l.owner.displayName}</Link>{l.owner.verified && <BadgeCheck className="size-4 text-mint-ink" aria-label="Verified email" />}</p><p className="text-sm text-muted">{l.owner.locationCity ?? 'Location not shared'} · approximate area only</p></div>
            <Button asChild variant="soft" size="sm"><Link href={`/u/${l.owner.id}`}>View profile</Link></Button>
          </Card>
        </div>

        {/* Sticky decision card (desktop) */}
        <aside className="hidden lg:block"><div className="sticky top-24 space-y-4">
          <Card className="space-y-5 p-6">
            <div><p className="text-xs font-bold uppercase tracking-widest text-muted">Owner&apos;s estimate</p><p className="mt-1 text-4xl font-black">{l.estimatedValue != null ? `~${formatINR(l.estimatedValue)}` : '—'}</p><p className="mt-1 text-xs text-muted">{VALUE_DISCLAIMER}</p></div>
            {actions}
            {!l.isOwner && <p className="text-center text-xs text-muted">Nothing is agreed until someone accepts exact terms.</p>}
          </Card>
          <p className="flex gap-2 rounded-2xl bg-butter p-4 text-sm text-butter-ink"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><span>Inspect items before confirming and meet somewhere public. SWAPD doesn&apos;t move money or hold funds.</span></p>
          {!l.isOwner && <button onClick={() => (status === 'authed' ? setReporting(true) : router.push(`/login?next=/listing/${id}`))} className="mx-auto flex items-center gap-2 text-sm font-medium text-muted hover:underline"><Flag className="size-4" aria-hidden />Report this listing</button>}
        </div></aside>
      </div>

      {/* Mobile: sticky action bar above the bottom nav */}
      <div className="fixed inset-x-0 bottom-[4.6rem] z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3"><div className="shrink-0"><p className="text-[10px] font-bold uppercase tracking-widest text-muted">Estimate</p><p className="text-lg font-black leading-tight">{l.estimatedValue != null ? `~${formatINR(l.estimatedValue)}` : '—'}</p></div><div className="min-w-0 flex-1">{actions}</div></div>
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:hidden"><p className="flex gap-2 rounded-2xl bg-butter p-4 text-sm text-butter-ink"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /><span>Inspect items before confirming and meet somewhere public. {VALUE_DISCLAIMER}</span></p>{!l.isOwner && <button onClick={() => (status === 'authed' ? setReporting(true) : router.push(`/login?next=/listing/${id}`))} className="flex items-center gap-2 text-sm font-medium text-muted underline-offset-2 hover:underline"><Flag className="size-4" aria-hidden />Report this listing</button>}</div>

      {l.related && l.related.length > 0 && <section className="mt-16"><h2 className="mb-6 text-3xl font-black tracking-tight">More in {CATEGORY_LABELS[l.category]}</h2><ListingGrid>{l.related.slice(0, 4).map((r) => <ListingCard key={r.id} listing={r} />)}</ListingGrid></section>}

      <ReportDialog open={reporting} onOpenChange={setReporting} targetType="LISTING" targetId={l.id} subject="this listing" />
      <Dialog open={removing} onOpenChange={setRemoving} title="Remove this listing?" description="Open offers involving it will be closed. This can't be undone from your side.">
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setRemoving(false)}>Keep it</Button><Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Remove listing</Button></div>
      </Dialog>
      {void user}
    </div>
  );
}
