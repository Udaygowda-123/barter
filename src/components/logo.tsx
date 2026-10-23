import { ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="SWAPD home" className={cn('inline-flex min-h-11 items-center gap-2 text-xl font-black tracking-tight', className)}>
      <span className="flex size-8 items-center justify-center rounded-xl bg-coral text-ink"><ArrowLeftRight className="size-4" strokeWidth={3} aria-hidden /></span>
      swapd
    </Link>
  );
}
