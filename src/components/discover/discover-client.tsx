'use client';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORIES, CATEGORY_LABELS, CONDITIONS, CONDITION_LABELS } from '@/shared/types';
import { LayoutGrid, Layers, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { GridSkeleton, ListingCard, ListingGrid } from '@/components/listing/listing-card';
import { CATEGORY_ICON } from './category-icons';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Chip } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Listing, Page } from '@/lib/types';

const SwipeDeck = dynamic(() => import('@/components/listing/swipe-deck').then((m) => m.SwipeDeck), { ssr: false, loading: () => <div className="mx-auto aspect-[4/5] max-w-sm skeleton" aria-hidden /> });

function Discover({ initialFeed }: { initialFeed: Page<Listing> | null }) {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname(); const { status } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const params = { q: sp.get('q') ?? '', category: sp.get('category') ?? '', condition: sp.get('condition') ?? '', minValue: sp.get('minValue') ?? '', maxValue: sp.get('maxValue') ?? '', city: sp.get('city') ?? '' };
  const mode = sp.get('view') === 'swipe' ? 'swipe' : 'grid';
  const sort = sp.get('sort') === 'new' ? 'new' : 'best'; // 'best' = ranked /discover feed, 'new' = newest active listings
  const [search, setSearch] = useState(params.q); const [filtersOpen, setFiltersOpen] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const setParam = useCallback((patch: Record<string, string>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  }, [sp, router, path]);

  useEffect(() => { const t = setTimeout(() => { if (search !== params.q) setParam({ q: search }); }, 350); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const feed = useInfiniteQuery({
    queryKey: ['discover', qs, status === 'authed', sort],
    enabled: status !== 'loading',
    initialPageParam: '',
    queryFn: async ({ pageParam }) => {
      const limit = `limit=${mode === 'swipe' ? 12 : 20}${pageParam ? `&cursor=${pageParam}` : ''}`;
      if (sort === 'best') return api<Page<Listing>>(`/discover?${qs}${qs ? '&' : ''}${limit}`);
      // Newest uses the existing listings endpoint (same filters); hide your own items like the ranked feed does.
      const r = await api<Page<Listing>>(`/listings?${qs}${qs ? '&' : ''}status=ACTIVE&${limit}`);
      return { ...r, items: r.items.filter((l) => !l.isOwner) };
    },
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
    placeholderData: keepPreviousData, // keep showing current results while a new filter/sort loads — no flash to skeletons
    // Server-rendered first screen for anonymous visitors on the default feed; personalised feeds load after sign-in.
    ...(initialFeed && !qs && sort === 'best' && status !== 'authed' && mode === 'grid' ? { initialData: { pages: [initialFeed], pageParams: [''] } } : {}),
  });
  const items = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((l) => !hidden.has(l.id));
  const activeFilters = ['condition', 'minValue', 'maxValue', 'city'].filter((k) => params[k as keyof typeof params]).length;
  const fetchMore = useCallback(() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }, [feed]);

  async function dismiss(id: string) {
    setHidden((h) => new Set(h).add(id));
    try { await api(`/listings/${id}/dismiss`, { method: 'POST' }); } catch { setHidden((h) => { const n = new Set(h); n.delete(id); return n; }); toast.error('Could not hide that item'); }
    qc.invalidateQueries({ queryKey: ['discover'] });
  }

  /** Sort + view toggles: labelled on desktop; one compact row with icon-only Grid/Swipe on phones (like the app). */
  const toggles = (compact: boolean) => (
    <div className={compact ? 'flex items-center justify-between gap-2' : 'flex flex-wrap gap-2'}>
      <div className="flex gap-1 rounded-full bg-ink/5 p-1" role="group" aria-label="Sort">
        <button onClick={() => setParam({ sort: '' })} aria-pressed={sort === 'best'} className={`rounded-full px-4 text-sm font-semibold ${compact ? 'h-9' : 'h-10'} ${sort === 'best' ? 'bg-surface shadow' : ''}`}>Best match</button>
        <button onClick={() => setParam({ sort: 'new' })} aria-pressed={sort === 'new'} className={`rounded-full px-4 text-sm font-semibold ${compact ? 'h-9' : 'h-10'} ${sort === 'new' ? 'bg-surface shadow' : ''}`}>Newest</button>
      </div>
      <div className="flex gap-1 rounded-full bg-ink/5 p-1" role="group" aria-label="View mode">
        <button onClick={() => setParam({ view: '' })} aria-pressed={mode === 'grid'} aria-label="Grid view" className={`flex items-center justify-center gap-2 rounded-full text-sm font-semibold ${compact ? 'size-9' : 'h-10 px-4'} ${mode === 'grid' ? 'bg-surface shadow' : ''}`}><LayoutGrid className="size-4" aria-hidden />{!compact && 'Grid'}</button>
        <button onClick={() => setParam({ view: 'swipe' })} aria-pressed={mode === 'swipe'} aria-label="Swipe view" className={`flex items-center justify-center gap-2 rounded-full text-sm font-semibold ${compact ? 'size-9' : 'h-10 px-4'} ${mode === 'swipe' ? 'bg-surface shadow' : ''}`}><Layers className="size-4" aria-hidden />{!compact && 'Swipe'}</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-coral-ink">Discover</p><h1 className="mt-1 text-4xl font-extrabold leading-[1.02] md:text-6xl">Find your next <em className="accent font-normal text-cobalt-ink">favourite</em></h1><p className="mt-2 text-muted">{status === 'authed' ? 'Picked for what you want and what you have.' : 'Browse what people are swapping. Sign in for a feed tuned to you.'}</p></div>
        <div className="hidden md:block">{toggles(false)}</div>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:mt-6 md:gap-4">
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden /><Input type="search" aria-label="Search items" placeholder="Search sneakers, cameras, vinyl…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-13 rounded-full pl-12" /></div>
          <Button variant="outline" onClick={() => setFiltersOpen(true)} aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ''}`} className="relative h-[3.25rem] w-[3.25rem] shrink-0 px-0 sm:w-auto sm:px-5"><SlidersHorizontal className="size-4" aria-hidden /><span className="hidden sm:inline">Filters</span>{activeFilters > 0 && <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-bold text-ink ring-2 ring-paper sm:static sm:ring-0">{activeFilters}</span>}</Button>
        </div>
        <div role="group" aria-label="Categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip active={!params.category} onClick={() => setParam({ category: '' })}>All</Chip>
          {CATEGORIES.map((c) => { const I = CATEGORY_ICON[c]; return <Chip key={c} active={params.category === c} onClick={() => setParam({ category: c })} className="inline-flex items-center gap-1.5"><I className="size-4" aria-hidden />{CATEGORY_LABELS[c]}</Chip>; })}
        </div>
        <div className="md:hidden">{toggles(true)}</div>
      </div>

      <div className="mt-8" aria-live="polite" aria-busy={feed.isFetching}>
        {feed.isLoading || status === 'loading' ? <GridSkeleton /> : feed.isError ? <ErrorState message="We couldn't load the feed." onRetry={() => feed.refetch()} /> : items.length === 0 ? (
          <EmptyState art={qs ? 'search' : 'box'} title={qs ? 'Nothing matches those filters' : 'No items yet'} body={qs ? 'Try a different search, or clear your filters.' : 'Be the first to list something — others will find it here.'} action={qs ? <Button variant="outline" onClick={() => router.replace(path)}>Clear filters</Button> : <Button asChild><Link href="/listing/new"><Plus className="size-4" aria-hidden />List an item</Link></Button>} />
        ) : mode === 'swipe' ? (
          <SwipeDeck items={items} hasMore={!!feed.hasNextPage} onNeedMore={fetchMore} />
        ) : (<>
          <ListingGrid>{items.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 4} onDismiss={status === 'authed' ? dismiss : undefined} />)}</ListingGrid>
          {feed.hasNextPage && <div className="mt-10 flex justify-center"><Button variant="outline" size="lg" onClick={fetchMore} loading={feed.isFetchingNextPage}>Load more</Button></div>}
        </>)}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters" description="Estimated values are set by owners and aren't appraisals.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const lo = Number(f.get('minValue') || 0), hi = Number(f.get('maxValue') || 0); if (lo && hi && lo > hi) { toast.error('Min value must be less than max value'); return; } setParam({ condition: String(f.get('condition') ?? ''), minValue: String(f.get('minValue') ?? ''), maxValue: String(f.get('maxValue') ?? ''), city: String(f.get('city') ?? '') }); setFiltersOpen(false); }}>
          <Field label="Condition">{(p) => <Select {...p} name="condition" defaultValue={params.condition}><option value="">Any</option>{CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Min value (₹)">{(p) => <Input {...p} name="minValue" type="number" min={0} inputMode="numeric" defaultValue={params.minValue} />}</Field><Field label="Max value (₹)">{(p) => <Input {...p} name="maxValue" type="number" min={0} inputMode="numeric" defaultValue={params.maxValue} />}</Field></div>
          <Field label="City">{(p) => <Input {...p} name="city" defaultValue={params.city} placeholder="e.g. Pune" />}</Field>
          <div className="flex justify-between pt-2"><Button type="button" variant="ghost" onClick={() => { setParam({ condition: '', minValue: '', maxValue: '', city: '' }); setFiltersOpen(false); }}>Clear</Button><Button type="submit">Show results</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
export default function DiscoverClient({ initialFeed }: { initialFeed: Page<Listing> | null }) { return <Suspense fallback={<GridSkeleton />}><Discover initialFeed={initialFeed} /></Suspense>; }
