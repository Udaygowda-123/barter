'use client';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CATEGORIES, CATEGORY_LABELS, CONDITIONS, CONDITION_LABELS } from '@swapd/shared-types';
import { Compass, LayoutGrid, Layers, Plus, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { GridSkeleton, ListingCard, ListingGrid } from '@/components/listing/listing-card';
import { SwipeDeck } from '@/components/listing/swipe-deck';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/form';
import { Chip } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { Listing, Page } from '@/lib/types';

function Discover() {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname(); const { status } = useAuth(); const qc = useQueryClient(); const toast = useToast();
  const params = { q: sp.get('q') ?? '', category: sp.get('category') ?? '', condition: sp.get('condition') ?? '', minValue: sp.get('minValue') ?? '', maxValue: sp.get('maxValue') ?? '', city: sp.get('city') ?? '' };
  const mode = sp.get('view') === 'swipe' ? 'swipe' : 'grid';
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
    queryKey: ['discover', qs, status === 'authed'],
    enabled: status !== 'loading',
    initialPageParam: '',
    queryFn: ({ pageParam }) => api<Page<Listing>>(`/discover?${qs}${qs ? '&' : ''}limit=${mode === 'swipe' ? 12 : 20}${pageParam ? `&cursor=${pageParam}` : ''}`),
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
  });
  const items = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter((l) => !hidden.has(l.id));
  const activeFilters = ['condition', 'minValue', 'maxValue', 'city'].filter((k) => params[k as keyof typeof params]).length;
  const fetchMore = useCallback(() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }, [feed]);

  async function dismiss(id: string) {
    setHidden((h) => new Set(h).add(id));
    try { await api(`/listings/${id}/dismiss`, { method: 'POST' }); } catch { setHidden((h) => { const n = new Set(h); n.delete(id); return n; }); toast.error('Could not hide that item'); }
    qc.invalidateQueries({ queryKey: ['discover'] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Discover</h1><p className="mt-1 text-muted">{status === 'authed' ? 'Picked for what you want and what you have.' : 'Browse what people are swapping. Sign in for a feed tuned to you.'}</p></div>
        <div className="flex gap-1 rounded-full bg-ink/5 p-1" role="group" aria-label="View mode">
          <button onClick={() => setParam({ view: '' })} aria-pressed={mode === 'grid'} className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${mode === 'grid' ? 'bg-surface shadow' : ''}`}><LayoutGrid className="size-4" aria-hidden />Grid</button>
          <button onClick={() => setParam({ view: 'swipe' })} aria-pressed={mode === 'swipe'} className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${mode === 'swipe' ? 'bg-surface shadow' : ''}`}><Layers className="size-4" aria-hidden />Swipe</button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex gap-3">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden /><Input type="search" aria-label="Search items" placeholder="Search sneakers, cameras, vinyl…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-13 rounded-full pl-12" /></div>
          <Button variant="outline" onClick={() => setFiltersOpen(true)} className="h-[3.25rem]"><SlidersHorizontal className="size-4" aria-hidden />Filters{activeFilters > 0 && <span className="rounded-full bg-coral px-2 text-xs font-bold text-ink">{activeFilters}</span>}</Button>
        </div>
        <div role="group" aria-label="Categories" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip active={!params.category} onClick={() => setParam({ category: '' })}>All</Chip>
          {CATEGORIES.map((c) => <Chip key={c} active={params.category === c} onClick={() => setParam({ category: c })}>{CATEGORY_LABELS[c]}</Chip>)}
        </div>
      </div>

      <div className="mt-8" aria-live="polite" aria-busy={feed.isFetching}>
        {feed.isLoading || status === 'loading' ? <GridSkeleton /> : feed.isError ? <ErrorState message="We couldn't load the feed." onRetry={() => feed.refetch()} /> : items.length === 0 ? (
          <EmptyState icon={<Compass className="size-7" aria-hidden />} title={qs ? 'Nothing matches those filters' : 'No items yet'} body={qs ? 'Try a different search, or clear your filters.' : 'Be the first to list something — others will find it here.'} action={qs ? <Button variant="outline" onClick={() => router.replace(path)}>Clear filters</Button> : <Button asChild><Link href="/listing/new"><Plus className="size-4" aria-hidden />List an item</Link></Button>} />
        ) : mode === 'swipe' ? (
          <SwipeDeck items={items} hasMore={!!feed.hasNextPage} onNeedMore={fetchMore} />
        ) : (<>
          <ListingGrid>{items.map((l, i) => <ListingCard key={l.id} listing={l} priority={i < 4} onDismiss={status === 'authed' ? dismiss : undefined} />)}</ListingGrid>
          {feed.hasNextPage && <div className="mt-10 flex justify-center"><Button variant="outline" size="lg" onClick={fetchMore} loading={feed.isFetchingNextPage}>Load more</Button></div>}
        </>)}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen} title="Filters" description="Estimated values are set by owners and aren't appraisals.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setParam({ condition: String(f.get('condition') ?? ''), minValue: String(f.get('minValue') ?? ''), maxValue: String(f.get('maxValue') ?? ''), city: String(f.get('city') ?? '') }); setFiltersOpen(false); }}>
          <Field label="Condition">{(p) => <Select {...p} name="condition" defaultValue={params.condition}><option value="">Any</option>{CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}</Select>}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Min value (₹)">{(p) => <Input {...p} name="minValue" type="number" min={0} inputMode="numeric" defaultValue={params.minValue} />}</Field><Field label="Max value (₹)">{(p) => <Input {...p} name="maxValue" type="number" min={0} inputMode="numeric" defaultValue={params.maxValue} />}</Field></div>
          <Field label="City">{(p) => <Input {...p} name="city" defaultValue={params.city} placeholder="e.g. Pune" />}</Field>
          <div className="flex justify-between pt-2"><Button type="button" variant="ghost" onClick={() => { setParam({ condition: '', minValue: '', maxValue: '', city: '' }); setFiltersOpen(false); }}>Clear</Button><Button type="submit">Show results</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<GridSkeleton />}><Discover /></Suspense>; }
