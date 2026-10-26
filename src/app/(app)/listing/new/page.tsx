'use client';
import { ListingForm } from '@/components/listing/listing-form';
import { Spinner } from '@/components/ui/states';
import { useRequireAuth } from '@/lib/auth';
import { BackButton } from '@/components/ui/back-button';

export default function NewListing() {
  const { status } = useRequireAuth();
  if (status !== 'authed') return <Spinner />;
  return <div className="mx-auto max-w-3xl"><BackButton fallback="/discover" className="mb-3" /><h1 className="text-3xl font-black tracking-tight md:text-5xl">List an item</h1><p className="mb-10 mt-1 text-muted">Add photos, tell people what it is and what you&apos;d love in return.</p><ListingForm /></div>;
}
