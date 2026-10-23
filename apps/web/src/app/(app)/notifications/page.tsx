'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import type { NotificationDto, Page } from '@/lib/types';
import { cn } from '@/lib/utils';

type P = Record<string, string | number | null | undefined>;
function describe(n: NotificationDto): { text: string; href: string } {
  const p = n.payload as P;
  const offer = p.offerId ? `/offers/${p.offerId}` : '/offers'; const deal = p.dealId ? `/deals/${p.dealId}` : '/deals';
  switch (n.type) {
    case 'MESSAGE': return { text: `${p.from ?? 'Someone'}: ${p.preview ?? 'sent a message'}`, href: `/messages/${p.conversationId}` };
    case 'OFFER_RECEIVED': return { text: 'You received a new offer', href: offer };
    case 'OFFER_COUNTERED': return { text: `You received a counteroffer (version ${p.revision})`, href: offer };
    case 'OFFER_ACCEPTED': return { text: 'Your offer was accepted — a deal was created', href: deal };
    case 'OFFER_REJECTED': return { text: p.reason ? 'An offer was closed because an item is no longer available' : 'An offer was declined', href: offer };
    case 'OFFER_WITHDRAWN': return { text: p.reason ? 'An offer was closed because an item is no longer available' : 'An offer was withdrawn', href: offer };
    case 'OFFER_EXPIRED': return { text: 'An offer expired without a response', href: offer };
    case 'DEAL_UPDATED': return { text: ({ handover_confirmed: 'Your swap partner agreed to the handover plan', completion_requested: 'Your swap partner confirmed completion — your turn', completed: 'Swap complete! Leave a review', cancelled: 'A deal was cancelled', disputed: 'A dispute was opened on your deal' } as Record<string, string>)[String(p.event)] ?? 'A deal was updated', href: deal };
    case 'REVIEW_RECEIVED': return { text: `You received a ${p.rating}★ review`, href: '/profile' };
    case 'MODERATION': return { text: ({ listing_removed: `Your listing “${p.title}” was removed by moderators`, listing_held: `Your listing “${p.title}” is under review`, listing_restored: `Your listing “${p.title}” was restored`, account_restricted: 'Your account was restricted', account_active: 'Your account restrictions were lifted', account_suspended: 'Your account was suspended', deal_resolved: 'Moderators resolved your disputed deal' } as Record<string, string>)[String(p.event)] ?? 'Moderation update', href: p.dealId ? deal : '/profile' };
    default: return { text: 'Update', href: '/' };
  }
}

export default function Notifications() {
  const { status } = useRequireAuth(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<Page<NotificationDto> & { unreadCount: number }>('/notifications'), enabled: status === 'authed' });
  const readOne = useMutation({ mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  return (
    <div className="mx-auto max-w-2xl"><div className="flex items-end justify-between gap-3"><div><h1 className="text-3xl font-black tracking-tight md:text-5xl">Notifications</h1><p className="mt-1 text-muted">{q.data ? `${q.data.unreadCount} unread` : ' '}</p></div>{!!q.data?.unreadCount && <Button variant="outline" size="sm" onClick={() => readAll.mutate()} loading={readAll.isPending}><CheckCheck className="size-4" aria-hidden />Mark all read</Button>}</div>
      <div className="mt-6 space-y-2">{q.isLoading || status !== 'authed' ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />) : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data!.items.length === 0 ? <EmptyState icon={<Bell className="size-7" aria-hidden />} title="You're all caught up" body="Offers, messages and deal updates will show up here." /> :
        q.data!.items.map((n) => { const d = describe(n); return (
          <Link key={n.id} href={d.href} onClick={() => !n.readAt && readOne.mutate(n.id)} className={cn('flex items-start gap-3 rounded-2xl border p-4 transition-colors hover:border-ink', n.readAt ? 'border-line bg-surface' : 'border-coral/40 bg-coral-soft/50')}>
            <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-coral')} /><span className="min-w-0 flex-1"><span className={cn('block text-sm', !n.readAt && 'font-bold')}>{!n.readAt && <span className="sr-only">Unread: </span>}{d.text}</span><span className="text-xs text-muted">{timeAgo(n.createdAt)}</span></span>
          </Link>); })}</div></div>
  );
}
