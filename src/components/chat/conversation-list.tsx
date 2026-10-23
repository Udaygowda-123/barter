'use client';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import type { ConversationSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function ConversationList() {
  const path = usePathname();
  const q = useQuery({ queryKey: ['conversations'], queryFn: () => api<ConversationSummary[]>('/conversations'), refetchInterval: 15_000 });
  if (q.isLoading) return <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>;
  if (q.isError) return <div className="p-3"><ErrorState onRetry={() => q.refetch()} /></div>;
  if (!q.data!.length) return <div className="p-3"><EmptyState icon={<MessageCircle className="size-7" aria-hidden />} title="No conversations yet" body="A chat opens automatically when you make or receive an offer." action={<Button asChild size="sm"><Link href="/discover">Discover items</Link></Button>} /></div>;
  return (
    <ul className="divide-y divide-line" aria-label="Conversations">
      {q.data!.map((c) => {
        const other = c.participants[0]; const active = path === `/messages/${c.id}`;
        return (
          <li key={c.id}><Link href={`/messages/${c.id}`} aria-current={active ? 'page' : undefined} className={cn('flex gap-3 p-4 transition-colors hover:bg-ink/[0.03]', active && 'bg-lavender/50')}>
            <Avatar name={other?.displayName ?? '?'} src={other?.avatarUrl} size={48} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2"><span className={cn('truncate', c.unreadCount ? 'font-black' : 'font-bold')}>{other?.displayName ?? 'Unknown'}</span><span className="shrink-0 text-xs text-muted">{c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}</span></span>
              <span className="block truncate text-xs text-muted">re: {c.listing?.title ?? 'offer'}</span>
              <span className="flex items-center justify-between gap-2"><span className={cn('truncate text-sm', c.unreadCount ? 'font-semibold text-ink' : 'text-muted')}>{c.lastMessage?.type === 'OFFER_CARD' ? '📦 Offer' : c.lastMessage?.content ?? 'No messages yet'}</span>{c.unreadCount > 0 && <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-xs font-bold leading-5 text-ink"><span className="sr-only">Unread: </span>{c.unreadCount}</span>}</span>
            </span>
          </Link></li>
        );
      })}
    </ul>
  );
}
