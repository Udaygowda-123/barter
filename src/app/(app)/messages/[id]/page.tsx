'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, Flag, ImagePlus, MoreVertical, Send, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ReportDialog } from '@/components/listing/report-dialog';
import { OfferStatusBadge } from '@/components/offers/terms';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Avatar, Skeleton } from '@/components/ui/primitives';
import { ErrorState } from '@/components/ui/states';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clockTime, formatINR } from '@/lib/format';
import { prepareImage } from '@/lib/image';
import { useToast } from '@/lib/toast';
import type { ConversationSummary, ImageDto, Message } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Thread() {
  const { id } = useParams<{ id: string }>(); const { user } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const router = useRouter();
  const msgs = useQuery({ queryKey: ['messages', id], queryFn: () => api<{ items: Message[]; hasMore: boolean }>(`/conversations/${id}/messages?limit=100`), retry: false, refetchInterval: 4000 });
  const convs = qc.getQueryData<ConversationSummary[]>(['conversations']);
  const conv = convs?.find((c) => c.id === id); const other = conv?.participants[0];
  const [text, setText] = useState(''); const [sending, setSending] = useState(false); const [attach, setAttach] = useState<ImageDto[]>([]);
  const [report, setReport] = useState(false); const [blocking, setBlocking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null); const file = useRef<HTMLInputElement>(null); const lastId = msgs.data?.items.at(-1)?.id;

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [lastId]);
  useEffect(() => { // mark as read whenever the latest message changes while this thread is open
    if (!msgs.data) return;
    api(`/conversations/${id}/read`, { method: 'POST' }).then(() => { qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); }).catch(() => undefined);
  }, [id, lastId, msgs.data, qc]);

  async function send() {
    const content = text.trim(); if (!content || sending) return; setSending(true);
    try {
      await api(`/conversations/${id}/messages`, { method: 'POST', body: { content, clientId: newIdempotencyKey(), attachmentKeys: attach.map((a) => a.id) } });
      setText(''); setAttach([]); await qc.invalidateQueries({ queryKey: ['messages', id] }); qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Message not sent. Try again.'); } finally { setSending(false); }
  }
  async function pickFile(f?: File) {
    if (!f) return; const fd = new FormData(); fd.append('file', await prepareImage(f));
    try { setAttach([...attach, await api<ImageDto>('/media/images', { method: 'POST', body: fd })].slice(-4)); } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not attach image'); }
    if (file.current) file.current.value = '';
  }
  async function block() {
    if (!other) return; try { await api(`/users/${other.id}/block`, { method: 'POST' }); toast.success(`${other.displayName} is blocked`); setBlocking(false); router.push('/messages'); } catch { toast.error('Could not block this user'); }
  }

  if (msgs.isError) return <div className="p-6"><ErrorState message={msgs.error instanceof ApiError && msgs.error.status === 404 ? 'This conversation does not exist.' : 'We could not load this conversation.'} onRetry={() => msgs.refetch()} /></div>;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 md:px-5">
        <Link href="/messages" aria-label="Back to conversations" className="flex size-10 items-center justify-center rounded-full hover:bg-ink/5 md:hidden"><ArrowLeft aria-hidden /></Link>
        {other && <Avatar name={other.displayName} src={other.avatarUrl} size={40} />}
        <div className="min-w-0 flex-1"><Link href={other ? `/u/${other.id}` : '#'} className="block truncate font-bold hover:underline">{other?.displayName ?? '…'}</Link>{conv?.offer && <Link href={`/offers/${conv.offer.id}`} className="flex items-center gap-2 text-xs text-muted hover:underline"><span className="truncate">{conv.listing?.title}</span><OfferStatusBadge status={conv.offer.status} /></Link>}</div>
        <Menu.Root><Menu.Trigger aria-label="Conversation options" className="flex size-10 items-center justify-center rounded-full hover:bg-ink/5"><MoreVertical className="size-5" aria-hidden /></Menu.Trigger>
          <Menu.Portal><Menu.Content align="end" sideOffset={6} className="z-50 w-48 rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]">
            <Menu.Item onSelect={() => setReport(true)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium outline-none data-[highlighted]:bg-ink/5"><Flag className="size-4" aria-hidden />Report</Menu.Item>
            <Menu.Item onSelect={() => setBlocking(true)} className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-danger outline-none data-[highlighted]:bg-danger-soft"><Ban className="size-4" aria-hidden />Block user</Menu.Item>
          </Menu.Content></Menu.Portal></Menu.Root>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto bg-paper px-3 py-4 md:px-6" role="log" aria-live="polite" aria-label="Messages">
        {msgs.isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className={cn('h-14 w-2/3', i % 2 && 'ml-auto')} />) : msgs.data!.items.map((m) => <Bubble key={m.id} m={m} mine={m.sender?.id === user?.id} meId={user?.id} />)}
        <div ref={bottom} />
      </div>

      <form className="border-t border-line bg-surface p-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
        {attach.length > 0 && <ul className="mb-2 flex gap-2">{attach.map((a) => <li key={a.id} className="relative"><img src={a.thumbUrl ?? a.url} alt="Attachment preview" className="size-14 rounded-xl object-cover" /><button type="button" onClick={() => setAttach(attach.filter((x) => x.id !== a.id))} aria-label="Remove attachment" className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-paper"><X className="size-3" aria-hidden /></button></li>)}</ul>}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => file.current?.click()} aria-label="Attach an image" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"><ImagePlus className="size-5" aria-hidden /></button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Attach image file" onChange={(e) => pickFile(e.target.files?.[0])} />
          <label className="flex-1"><span className="sr-only">Message</span><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} maxLength={2000} placeholder="Write a message…" className="max-h-32 min-h-11 w-full resize-none rounded-3xl border border-line bg-paper px-4 py-2.5 text-[15px] focus-visible:border-ink" /></label>
          <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim()} loading={sending}>{!sending && <Send className="size-5" aria-hidden />}</Button>
        </div>
        <p className="mt-1.5 px-2 text-[11px] text-muted">Chat doesn&apos;t change an offer or deal — use the offer page to accept terms.</p>
      </form>

      {other && <ReportDialog open={report} onOpenChange={setReport} targetType="USER" targetId={other.id} subject={other.displayName} />}
      <Dialog open={blocking} onOpenChange={setBlocking} title={`Block ${other?.displayName ?? 'this user'}?`} description="You won't see each other's listings, and neither of you can message or make offers to the other."><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBlocking(false)}>Cancel</Button><Button variant="danger" onClick={block}>Block</Button></div></Dialog>
    </div>
  );
}

function Bubble({ m, mine, meId }: { m: Message; mine: boolean; meId?: string }) {
  if (m.type === 'SYSTEM') return <p className="mx-auto w-fit max-w-[90%] rounded-full bg-ink/5 px-4 py-1.5 text-center text-xs font-medium text-muted">{m.content} · {clockTime(m.createdAt)}</p>;
  if (m.type === 'OFFER_CARD' && m.offerRevision) {
    const r = m.offerRevision; const offered = r.items.filter((i) => i.role === 'OFFERED'); const requested = r.items.filter((i) => i.role === 'REQUESTED');
    return (
      <div className={cn('max-w-[88%] rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] md:max-w-sm', mine ? 'ml-auto' : '')}>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">{r.number === 1 ? 'Offer' : `Counteroffer · v${r.number}`} {r.authorId === meId ? 'from you' : `from ${m.sender?.displayName ?? 'them'}`}</p>
        <div className="mt-2 flex items-center gap-2 text-sm"><div className="flex-1"><p className="font-semibold">{offered.length ? offered.map((i) => i.listing.title).join(', ') : 'Cash only'}</p></div><span aria-hidden>⇄</span><div className="flex-1 text-right"><p className="font-semibold">{requested.map((i) => i.listing.title).join(', ')}</p></div></div>
        {r.cashAmount > 0 && <p className="mt-2 rounded-xl bg-mint px-3 py-1.5 text-sm font-bold text-mint-ink">+ {formatINR(r.cashAmount)} proposed</p>}
        {r.message && <p className="mt-2 text-sm italic text-muted">“{r.message}”</p>}
        <Link href={`/offers/${r.offerId}`} className="mt-3 inline-block text-sm font-bold underline">View offer & respond</Link>
        <p className="mt-1 text-[11px] text-muted">{clockTime(m.createdAt)}</p>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] md:max-w-md', mine ? 'rounded-br-lg bg-coral-soft' : 'rounded-bl-lg bg-surface ring-1 ring-line')}>
        {m.attachments.map((a) => <img key={a.id} src={a.url} alt="Attached photo" className="mb-2 max-h-60 rounded-2xl object-cover" />)}{m.content}
      </div>
      <span className="px-2 text-[11px] text-muted">{clockTime(m.createdAt)}</span>
    </div>
  );
}
