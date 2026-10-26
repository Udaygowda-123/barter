'use client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { usePulse } from '@/lib/pulse';

/** Landing header actions: signed-out → Browse / Sign in / Join; signed-in → Discover, notifications (with count) and your profile. */
export function LandingNav() {
  const { user, status } = useAuth(); const pulse = usePulse(); const n = pulse.data?.unreadNotifications ?? 0;
  if (status === 'authed' && user) return (
    <nav aria-label="Account" className="on-ink flex items-center gap-1 sm:gap-2">
      <Button asChild size="sm"><Link href="/discover">Discover</Link></Button>
      <Link href="/notifications" aria-label={n ? `Notifications, ${n} unread` : 'Notifications'} className="relative flex size-11 items-center justify-center rounded-full text-paper hover:bg-white/10">
        <Bell className="size-5" aria-hidden />
        {n > 0 && <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-ink">{n > 9 ? '9+' : n}</span>}
      </Link>
      <Link href="/profile" aria-label="Your profile" className="rounded-full"><Avatar name={user.displayName} src={user.avatarUrl} size={36} /></Link>
    </nav>
  );
  return (
    <nav aria-label="Account" className="on-ink flex items-center gap-1 sm:gap-2">
      <Button asChild variant="ghost" size="sm" className="hidden text-paper hover:bg-white/10 sm:inline-flex"><Link href="/discover">Browse</Link></Button>
      <Button asChild variant="ghost" size="sm" className="text-paper hover:bg-white/10"><Link href="/login">Sign in</Link></Button>
      <Button asChild size="sm"><Link href="/register">Join free</Link></Button>
    </nav>
  );
}
