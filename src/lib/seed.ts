import type { QueryClient } from '@tanstack/react-query';
import type { Listing, Page } from './types';

/** Feed cards are slimmed down (no wanted categories, exchange methods…); fill the gaps so the detail page can render them safely. */
const DEFAULTS = { description: '', currency: 'INR', wantedText: null, wantedCategories: [], cashFlexibility: 'NONE', exchangeMethods: [], locationCity: null, locationRegion: null, createdAt: '' };
const withDefaults = (l: Listing): Listing => Object.assign({}, DEFAULTS, l, { images: l.images ?? [] }) as unknown as Listing;

/** Reuse the card the user just clicked (from any cached feed/list) so the detail page paints instantly while the full record loads. */
export function cardSeed(qc: QueryClient, id: string): Listing | undefined {
  for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ['discover'] })) {
    const pages = (data as { pages?: Page<Listing>[] } | undefined)?.pages ?? [];
    for (const p of pages) { const hit = p.items.find((l) => l.id === id); if (hit) return withDefaults(hit); }
  }
  return undefined;
}
