'use client';
import { ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

// Counts client-side route changes in this tab. If the user arrived here from inside the app we go back through real
// history (keeps Discover filters & scroll); a deep link (shared URL, email) goes to a sensible parent instead.
let inAppNavigations = 0; let lastPath: string | null = null;

/** Mount once (in the app shells) to track in-app navigation for <BackButton>. */
export function NavTracker() {
  const path = usePathname();
  useEffect(() => { if (lastPath !== null && lastPath !== path) inAppNavigations++; lastPath = path; }, [path]);
  return null;
}

export function BackButton({ fallback, label = 'Back', tone = 'default', className }: { fallback: string; label?: string; tone?: 'default' | 'ink'; className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (inAppNavigations > 0 ? router.back() : router.push(fallback))}
      className={cn('group -ml-1 inline-flex h-10 items-center gap-2 rounded-full pl-1 pr-4 text-sm font-semibold transition-colors', tone === 'ink' ? 'text-paper hover:bg-white/10' : 'text-ink hover:bg-ink/5', className)}
    >
      <span className={cn('grid size-8 place-items-center rounded-full transition-transform duration-200 group-hover:-translate-x-0.5', tone === 'ink' ? 'bg-white/15' : 'bg-ink/[0.06]')}><ArrowLeft className="size-4" aria-hidden /></span>
      {label}
    </button>
  );
}
