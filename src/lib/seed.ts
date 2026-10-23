import type { QueryClient } from '@tanstack/react-query';
import type { Listing, Page } from './types';

/** Reuse the card the user just clicked (from any cached feed/list) so the detail page paints instantly while the full record loads. */
export function cardSeed(qc: QueryClient, id: string): Listing | undefined {
  for (const [, data] of qc.getQueriesData<unknown>({ queryKey: ['discover'] })) {
    const pages = (data as { pages?: Page<Listing>[] } | undefined)?.pages ?? [];
    for (const p of pages) { const hit = p.items.find((l) => l.id === id); if (hit) return hit; }
  }
  return undefined;
}
