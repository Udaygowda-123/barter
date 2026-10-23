import { Skeleton } from '@/components/ui/primitives';

/** Instant feedback on navigation while the next page's data/JS arrives. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-6">
      <Skeleton className="h-10 w-1/2 max-w-xs" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-[var(--radius-card)]" />)}</div>
    </div>
  );
}
