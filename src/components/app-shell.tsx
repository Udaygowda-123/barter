'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Bell, Compass, Heart, Inbox, LogOut, MailCheck, MessageCircle, Plus, Shield, User, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { usePulse } from '@/lib/pulse';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

function useCounts() {
  const { data } = usePulse();
  return { messages: data?.unreadConversations ?? 0, notifications: data?.unreadNotifications ?? 0 };
}

const Count = ({ n }: { n: number }) => n > 0 ? <span className="absolute -right-1.5 -top-1 flex min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold leading-5 text-ink" aria-label={`${n} unread`}>{n > 99 ? '99+' : n}</span> : null;

function VerifyBanner() {
  const { user } = useAuth(); const toast = useToast(); const [hidden, setHidden] = useState(true); const [busy, setBusy] = useState(false);
  useEffect(() => { try { setHidden(sessionStorage.getItem('swapd:verify-dismissed') === '1'); } catch { setHidden(false); } }, []);
  if (!user || user.emailVerifiedAt || hidden) return null;
  async function resend() { setBusy(true); try { await api('/auth/resend-verification', { method: 'POST', body: {} }); toast.success(`Verification link sent to ${user!.email}`); } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not send the email'); } finally { setBusy(false); } }
  return (
    <div role="region" aria-label="Verify your email" className="border-b border-butter-ink/15 bg-butter">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm text-butter-ink md:px-8">
        <MailCheck className="size-4 shrink-0" aria-hidden /><p className="min-w-0 flex-1">Verify your email to build trust — we sent a link to <b className="break-all">{user.email}</b>.</p>
        <button onClick={resend} disabled={busy} className="shrink-0 rounded-full px-3 py-2 font-bold underline disabled:opacity-50">{busy ? 'Sending…' : 'Resend'}</button>
        <button onClick={() => { try { sessionStorage.setItem('swapd:verify-dismissed', '1'); } catch { /* ignore */ } setHidden(true); }} aria-label="Dismiss" className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-butter-ink/10"><X className="size-4" aria-hidden /></button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, status, logout } = useAuth(); const path = usePathname(); const router = useRouter(); const counts = useCounts();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  const links = [
    { href: '/discover', label: 'Discover', icon: Compass },
    { href: '/offers', label: 'Offers', icon: Inbox },
    { href: '/messages', label: 'Messages', icon: MessageCircle, count: counts.messages },
  ];

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? 'page' : undefined} className={cn('relative rounded-full px-4 py-2 text-sm font-semibold transition-colors', active(l.href) ? 'bg-ink text-paper' : 'hover:bg-ink/5')}>
                {l.label}{l.count ? <Count n={l.count} /> : null}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {status === 'authed' && user ? (
              <>
                <Button asChild size="sm" className="hidden md:inline-flex"><Link href="/listing/new"><Plus className="size-4" aria-hidden /> List an item</Link></Button>
                <Link href="/notifications" aria-label="Notifications" className="relative flex size-11 items-center justify-center rounded-full hover:bg-ink/5"><Bell className="size-5" aria-hidden /><Count n={counts.notifications} /></Link>
                <Menu.Root>
                  <Menu.Trigger aria-label="Account menu" className="rounded-full"><Avatar name={user.displayName} src={user.avatarUrl} size={40} /></Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="end" sideOffset={8} className="z-50 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
                      <div className="px-3 py-2"><p className="truncate text-sm font-bold">{user.displayName}</p><p className="truncate text-xs text-muted">{user.email}</p></div>
                      {[{ href: '/profile', label: 'My profile', icon: User }, { href: '/saved', label: 'Saved items', icon: Heart }, { href: '/deals', label: 'My deals', icon: Inbox }, ...(user.role !== 'USER' ? [{ href: '/admin', label: 'Moderation', icon: Shield }] : [])].map((i) => (
                        <Menu.Item key={i.href} onSelect={() => router.push(i.href)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none data-[highlighted]:bg-ink/5"><i.icon className="size-4" aria-hidden />{i.label}</Menu.Item>
                      ))}
                      <Menu.Separator className="my-1 h-px bg-line" />
                      <Menu.Item onSelect={async () => { await logout(); router.push('/'); }} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none data-[highlighted]:bg-ink/5"><LogOut className="size-4" aria-hidden />Sign out</Menu.Item>
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
              </>
            ) : status === 'anon' ? (
              <><Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button><Button asChild size="sm"><Link href="/register">Join free</Link></Button></>
            ) : null}
          </div>
        </div>
      </header>

      <OfflineBanner />
      <VerifyBanner />
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-10">{children}</main>

      {/* Mobile bottom navigation: touch-friendly targets */}
      <nav aria-label="Main mobile" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5">
          {[links[0], links[1]].map((l) => <NavItem key={l.href} {...l} active={active(l.href)} />)}
          <li><Link href="/listing/new" aria-label="List an item" className="-mt-5 flex size-14 items-center justify-center rounded-full bg-coral text-ink shadow-[var(--shadow-pop)]"><Plus className="size-7" aria-hidden /></Link></li>
          <NavItem {...links[2]} active={active('/messages')} />
          <NavItem href="/profile" label="Me" icon={User} active={active('/profile')} />
        </ul>
      </nav>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active, count }: { href: string; label: string; icon: React.ElementType; active: boolean; count?: number }) {
  return (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined} className={cn('relative flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[11px] font-semibold', active ? 'text-ink' : 'text-muted')}>
        <span className={cn('relative flex h-7 w-12 items-center justify-center rounded-full transition-colors', active && 'bg-coral-soft')}><Icon className="size-5" aria-hidden />{count ? <Count n={count} /> : null}</span>{label}
      </Link>
    </li>
  );
}

/** Shown only while the browser reports no connection; polling resumes on its own when it returns. */
function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine); sync();
    window.addEventListener('online', sync); window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  if (!offline) return null;
  return <div role="status" className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-medium text-paper"><WifiOff className="size-4" aria-hidden />You&apos;re offline — we&apos;ll reconnect automatically.</div>;
}
