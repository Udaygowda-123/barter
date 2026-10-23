'use client';
import { CASH_DISCLAIMER } from '@/shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Check, CircleDashed, MessageCircle, Star } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Badge, Card, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { DEAL_TONE } from '@/lib/deal';
import { formatINR } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Deal, ListingBrief } from '@/lib/types';
import { cn } from '@/lib/utils';

const Items = ({ items, empty }: { items: ListingBrief[]; empty: string }) => items.length ? <ul className="space-y-2">{items.map((i) => <li key={i.id} className="flex items-center gap-3 rounded-2xl bg-paper p-2.5"><span className="size-14 shrink-0 overflow-hidden rounded-xl bg-ink/5">{i.thumbUrl && <img src={i.thumbUrl} alt="" className="size-full object-cover" />}</span><span><span className="block text-sm font-bold">{i.title}</span><span className="text-xs text-muted">~{formatINR(i.estimatedValue)}</span></span></li>)}</ul> : <p className="rounded-2xl bg-paper p-3 text-sm text-muted">{empty}</p>;
const Step = ({ done, label }: { done: boolean; label: string }) => <li className="flex items-center gap-2 text-sm">{done ? <Check className="size-4 text-mint-ink" aria-hidden /> : <CircleDashed className="size-4 text-muted" aria-hidden />}<span className={done ? 'font-semibold' : 'text-muted'}>{label}</span></li>;

export default function DealPage() {
  const { id } = useParams<{ id: string }>(); const { user, status } = useRequireAuth(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ['deal', id], queryFn: () => api<Deal>(`/deals/${id}`), enabled: status === 'authed', retry: false, refetchOnWindowFocus: true });
  const [dlg, setDlg] = useState<'cancel' | 'dispute' | 'completion' | null>(null); const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'LOCAL_HANDOVER' | 'SHIPPING'>('LOCAL_HANDOVER'); const [notes, setNotes] = useState(''); const [editPlan, setEditPlan] = useState(false);
  const [rating, setRating] = useState(0); const [review, setReview] = useState('');
  const d = q.data;

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) => api<Deal>(`/deals/${id}/${path}`, { method: 'POST', body: body ?? {}, idempotencyKey: newIdempotencyKey() }),
    onSuccess: (data, v) => { qc.setQueryData(['deal', id], data); qc.invalidateQueries({ queryKey: ['deals'] }); qc.invalidateQueries({ queryKey: ['conversations'] }); setDlg(null); setEditPlan(false); setReason('');
      toast.success({ handover: 'Handover plan saved', 'confirm-handover': 'You agreed to the plan', 'confirm-completion': data.status === 'COMPLETED' ? 'Swap complete! 🎉' : 'Confirmed — waiting for the other person', cancel: 'Deal cancelled', dispute: 'Dispute opened — moderators will review' }[v.path] ?? 'Done'); },
    onError: (e) => { toast.error(e instanceof ApiError ? e.message : 'Something went wrong'); qc.invalidateQueries({ queryKey: ['deal', id] }); },
  });
  const submitReview = useMutation({
    mutationFn: () => api(`/deals/${id}/reviews`, { method: 'POST', body: { rating, body: review || undefined } }),
    onSuccess: () => { toast.success('Review posted'); qc.invalidateQueries({ queryKey: ['deal', id] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not post review'),
  });

  if (status !== 'authed' || q.isLoading) return <div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-12 w-1/2" /><Skeleton className="h-64" /></div>;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState title="Deal not found" action={<Button asChild><Link href="/deals">Back to deals</Link></Button>} />;
  if (q.isError || !d) return <ErrorState onRetry={() => q.refetch()} />;
  const active = d.status === 'ACTIVE'; const live = active || d.status === 'DISPUTED'; const t = d.terms; const cashFrom = t.cashPayerId ? (t.cashPayerId === user?.id ? 'you' : d.counterpart.displayName) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div><Badge tone={DEAL_TONE[d.status]}>{d.status.toLowerCase()}</Badge><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Swap with {d.counterpart.displayName}</h1></div>
      {d.status === 'DISPUTED' && <Card className="flex gap-3 border-danger/30 bg-danger-soft p-4 text-sm text-danger"><AlertOctagon className="size-5 shrink-0" aria-hidden /><p><b>Dispute open.</b> {d.dispute?.byMe ? 'You reported:' : 'The other person reported:'} “{d.dispute?.reason}”. A moderator will review. You can still confirm completion if you resolve it between yourselves.</p></Card>}
      {d.status === 'CANCELLED' && <Card className="p-4 text-sm text-muted">Cancelled {d.cancellation?.byMe ? 'by you' : 'by the other person'}: “{d.cancellation?.reason}”. The items are available again.</Card>}

      <Card className="p-5 md:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-black">Agreed terms <span className="text-sm font-semibold text-muted">· version {t.revisionNumber}</span></h2>{d.conversationId && <Button asChild variant="soft" size="sm"><Link href={`/messages/${d.conversationId}`}><MessageCircle className="size-4" aria-hidden />Chat</Link></Button>}</div>
        <div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">You give</p><Items items={t.giving} empty="No items" /></div><div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">You get</p><Items items={t.receiving} empty="No items" /></div></div>
        {t.cashAmount > 0 && <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-bold text-mint-ink">{formatINR(t.cashAmount)} agreed, from {cashFrom}</p>}
        <p className="mt-3 text-xs text-muted">{CASH_DISCLAIMER}</p></Card>

      {live && (<>
        <Card className="p-5 md:p-6"><h2 className="text-lg font-black">1 · Handover plan</h2>
          {d.handover.method && !editPlan ? (<div className="mt-3 space-y-3"><p className="text-sm"><b>{d.handover.method === 'SHIPPING' ? 'Shipping' : 'Local meet-up'}</b>{d.handover.notes && <> — {d.handover.notes}</>}</p>
            <ul className="space-y-1.5"><Step done={d.handover.confirmedByMe} label="You agreed to this plan" /><Step done={d.handover.confirmedByOther} label={`${d.counterpart.displayName} agreed`} /></ul>
            <div className="flex flex-wrap gap-2">{!d.handover.confirmedByMe && <Button size="sm" loading={act.isPending && act.variables?.path === 'confirm-handover'} onClick={() => act.mutate({ path: 'confirm-handover' })}>I agree to this plan</Button>}<Button size="sm" variant="outline" onClick={() => { setMethod(d.handover.method!); setNotes(d.handover.notes ?? ''); setEditPlan(true); }}>Change plan</Button></div></div>
          ) : (<form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: 'handover', body: { method, notes: notes || undefined } }); }}>
            <Field label="How will you exchange?">{(p) => <Select {...p} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}><option value="LOCAL_HANDOVER">Local meet-up</option><option value="SHIPPING">Shipping</option></Select>}</Field>
            <Field label="Details (where / when)" hint="Meet somewhere public and well-lit. Don't share your exact home address.">{(p) => <Textarea {...p} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />}</Field>
            <div className="flex gap-2"><Button type="submit" loading={act.isPending && act.variables?.path === 'handover'}>Save plan</Button>{editPlan && <Button type="button" variant="ghost" onClick={() => setEditPlan(false)}>Cancel</Button>}</div></form>)}
        </Card>

        <Card className="p-5 md:p-6"><h2 className="text-lg font-black">2 · Confirm completion</h2>
          <p className="mt-1 text-sm text-muted">After you&apos;ve handed over your item and received yours, confirm below. The swap is only <b>complete when both of you confirm</b>.</p>
          <ul className="mt-3 space-y-1.5"><Step done={d.completion.confirmedByMe} label="You confirmed" /><Step done={d.completion.confirmedByOther} label={`${d.counterpart.displayName} confirmed`} /></ul>
          {!d.completion.confirmedByMe && <Button className="mt-4" disabled={!d.handover.method} onClick={() => setDlg('completion')}>{d.handover.method ? 'Confirm swap complete' : 'Set a handover plan first'}</Button>}
          {d.completion.confirmedByMe && !d.completion.confirmedByOther && <p className="mt-4 rounded-2xl bg-butter px-4 py-3 text-sm text-butter-ink" role="status">Waiting for {d.counterpart.displayName} to confirm.</p>}
        </Card>

        <div className="flex flex-wrap gap-3 text-sm"><Button variant="outline" size="sm" onClick={() => { setReason(''); setDlg('cancel'); }}>Cancel deal</Button>{active && <Button variant="ghost" size="sm" className="text-danger" onClick={() => { setReason(''); setDlg('dispute'); }}>Something&apos;s wrong — open a dispute</Button>}</div>
      </>)}

      {d.status === 'COMPLETED' && (
        <Card className="p-5 md:p-6"><h2 className="text-lg font-black">Reviews</h2>
          {d.reviews.mine ? <p className="mt-2 text-sm">You rated {d.counterpart.displayName} <b>{d.reviews.mine.rating}/5</b>{d.reviews.mine.body && <> — “{d.reviews.mine.body}”</>}</p> : (
            <form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); if (rating) submitReview.mutate(); }}>
              <div role="radiogroup" aria-label="Rating" className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)} className="flex size-11 items-center justify-center rounded-full hover:bg-ink/5"><Star className={cn('size-7', n <= rating ? 'fill-coral text-coral' : 'text-line')} aria-hidden /></button>)}</div>
              <Field label="How did it go? (optional)">{(p) => <Textarea {...p} value={review} maxLength={500} onChange={(e) => setReview(e.target.value)} className="min-h-20" />}</Field>
              <Button type="submit" disabled={!rating} loading={submitReview.isPending}>Post review</Button></form>)}
          {d.reviews.theirs && <p className="mt-4 border-t border-line pt-4 text-sm">{d.counterpart.displayName} rated you <b>{d.reviews.theirs.rating}/5</b>{d.reviews.theirs.body && <> — “{d.reviews.theirs.body}”</>}</p>}
        </Card>)}

      <Dialog open={dlg === 'completion'} onOpenChange={(o) => !o && setDlg(null)} title="Confirm the swap is complete?" description="Only confirm once you've received your item and you're happy with it. This can't be undone."><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setDlg(null)}>Not yet</Button><Button loading={act.isPending} onClick={() => act.mutate({ path: 'confirm-completion' })}>Yes, it&apos;s complete</Button></div></Dialog>
      <Dialog open={dlg === 'cancel' || dlg === 'dispute'} onOpenChange={(o) => !o && setDlg(null)} title={dlg === 'cancel' ? 'Cancel this deal?' : 'Open a dispute'} description={dlg === 'cancel' ? 'Items go back on the marketplace. The other person is notified.' : 'A moderator will review. Describe what happened.'}>
        <Field label="Reason">{(p) => <Textarea {...p} value={reason} maxLength={dlg === 'cancel' ? 300 : 500} onChange={(e) => setReason(e.target.value)} className="min-h-24" />}</Field>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDlg(null)}>Back</Button><Button variant="danger" disabled={reason.trim().length < (dlg === 'cancel' ? 3 : 10)} loading={act.isPending} onClick={() => act.mutate({ path: dlg!, body: { reason: reason.trim() } })}>{dlg === 'cancel' ? 'Cancel deal' : 'Open dispute'}</Button></div>
      </Dialog>
    </div>
  );
}
