import { DiscoverClient } from './client';
import { connectDb } from '@/server/db';
import { discover } from '@/server/discovery';
import type { Listing, Page } from '@/lib/types';

/** ISR: the anonymous first page of the feed is rendered on the server and refreshed at most every 30 s. */
export const revalidate = 30;

async function firstPage(): Promise<Page<Listing> | null> {
  try { await connectDb(); return JSON.parse(JSON.stringify(await discover({ limit: 20 } as never, undefined))) as Page<Listing>; } catch { return null; }
}

export default async function Page() { return <DiscoverClient initialFeed={await firstPage()} />; }
