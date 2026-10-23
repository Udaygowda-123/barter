import type { Metadata } from 'next';
import { cache } from 'react';
import { ListingClient } from './client';
import { connectDb } from '@/server/db';
import { getListing } from '@/server/listings';
import type { Listing } from '@/lib/types';

/** ISR: the anonymous version of each item page is cached for 60 s; viewer-specific bits load client-side. */
export const revalidate = 60;

const load = cache(async (id: string): Promise<Listing | null> => {
  try { await connectDb(); return JSON.parse(JSON.stringify(await getListing(id))) as Listing; } catch { return null; }
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const l = await load((await params).id);
  if (!l) return { title: 'Item' };
  const img = l.images[0]?.url;
  const desc = `${l.title} — swap it for ${l.wantedText || 'something you love'}.`;
  return { title: l.title, description: desc, openGraph: { title: l.title, description: desc, images: img ? [{ url: img }] : undefined }, twitter: { card: 'summary_large_image' } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ListingClient id={id} initial={await load(id)} />;
}
