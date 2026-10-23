'use client';
import { CASH_DISCLAIMER, VALUE_DISCLAIMER } from '@/shared/types';
import { Check, Plus } from 'lucide-react';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Badge } from '@/components/ui/primitives';
import { formatINR } from '@/lib/format';
import type { OfferStatus } from '@/shared/types';
import type { Listing, ListingBrief } from '@/lib/types';
import { cn } from '@/lib/utils';

export const toBrief = (l: Listing): ListingBrief => ({ id: l.id, title: l.title, status: l.status, ownerId: l.ownerId, category: l.category, estimatedValue: l.estimatedValue, thumbUrl: l.images.find((i) => i.isCover)?.thumbUrl ?? l.images[0]?.thumbUrl ?? null });
export const sum = (items: { estimatedValue: number | null }[]) => items.reduce((n, i) => n + (i.estimatedValue ?? 0), 0);

export const STATUS_TEXT: Record<string, { label: string; tone: 'coral' | 'lavender' | 'mint' | 'butter' | 'danger' | 'neutral' }> = {
  PENDING: { label: 'Pending', tone: 'butter' }, COUNTERED: { label: 'Countered', tone: 'lavender' }, ACCEPTED: { label: 'Accepted', tone: 'mint' },
  REJECTED: { label: 'Declined', tone: 'danger' }, WITHDRAWN: { label: 'Withdrawn', tone: 'neutral' }, EXPIRED: { label: 'Expired', tone: 'neutral' }, CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
export const OfferStatusBadge = ({ status }: { status: OfferStatus }) => <Badge tone={STATUS_TEXT[status].tone}>{STATUS_TEXT[status].label}</Badge>;

function ItemRow({ item }: { item: ListingBrief }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-paper p-2.5">
      <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-ink/5">{item.thumbUrl && <img src={item.thumbUrl} alt="" className="size-full object-cover" />}</span>
      <span className="min-w-0"><span className="line-clamp-1 text-sm font-bold">{item.title}</span><span className="text-xs text-muted">~{formatINR(item.estimatedValue)}</span></span>
    </li>
  );
}

/** Read-only view of one revision's terms. `gives` is relative to who owns the items. */
export function TermsSummary({ senderName, recipientName, offered, requested, cashAmount, cashPayerName, message, labels }: { labels?: { left: string; right: string }; senderName: string; recipientName: string; offered: ListingBrief[]; requested: ListingBrief[]; cashAmount: number; cashPayerName?: string | null; message?: string | null }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{labels?.left ?? `${senderName} gives`}</p>{offered.length ? <ul className="space-y-2">{offered.map((i) => <ItemRow key={i.id} item={i} />)}</ul> : <p className="rounded-2xl bg-paper p-3 text-sm text-muted">No items — cash only</p>}</div>
        <div><p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{labels?.right ?? `${recipientName} gives`}</p><ul className="space-y-2">{requested.map((i) => <ItemRow key={i.id} item={i} />)}</ul></div>
      </div>
      {cashAmount > 0 && <p className="flex items-center gap-2 rounded-2xl bg-mint px-4 py-3 text-sm font-bold text-mint-ink"><Plus className="size-4" aria-hidden />{formatINR(cashAmount)} proposed{cashPayerName ? ` from ${cashPayerName}` : ''}</p>}
      {message && <p className="rounded-2xl bg-lavender/60 px-4 py-3 text-sm italic text-lavender-ink">“{message}”</p>}
    </div>
  );
}

export function ItemPicker({ title, hint, items, selected, onChange, max = 5, empty, locked }: { title: string; hint?: string; items: ListingBrief[]; selected: string[]; onChange: (ids: string[]) => void; max?: number; empty?: React.ReactNode; locked?: string[] }) {
  return (
    <fieldset>
      <legend className="text-base font-bold">{title}</legend>{hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      {items.length === 0 ? <div className="mt-3">{empty}</div> : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((i) => {
            const on = selected.includes(i.id); const isLocked = locked?.includes(i.id);
            return (
              <li key={i.id}>
                <label className={cn('relative block cursor-pointer overflow-hidden rounded-2xl border-2 bg-surface transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink', on ? 'border-ink' : 'border-line hover:border-ink/40', isLocked && 'cursor-default')}>
                  <input type="checkbox" className="sr-only" checked={on} disabled={isLocked || (!on && selected.length >= max)} onChange={() => onChange(on ? selected.filter((x) => x !== i.id) : [...selected, i.id])} />
                  <span className="block aspect-square bg-ink/5">{i.thumbUrl && <img src={i.thumbUrl} alt="" className="size-full object-cover" />}</span>
                  <span className="block p-2.5"><span className="line-clamp-1 text-sm font-bold">{i.title}</span><span className="text-xs text-muted">~{formatINR(i.estimatedValue)}</span></span>
                  {on && <span className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-ink text-paper"><Check className="size-4" aria-hidden /><span className="sr-only">Selected</span></span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}

export interface TermsState { give: string[]; get: string[]; cash: number; payer: 'ME' | 'THEM'; message: string }

/** `give` = items I hand over, `get` = items I receive. Callers translate to the API's offered/requested fields. */
export function TermsEditor({ state, onChange, givePool, getPool, giveTitle = 'You give', getTitle = 'You get', lockedGet, giveEmpty, error }: { state: TermsState; onChange: (s: TermsState) => void; givePool: ListingBrief[]; getPool: ListingBrief[]; giveTitle?: string; getTitle?: string; lockedGet?: string[]; giveEmpty?: React.ReactNode; error?: string }) {
  const giveTotal = sum(givePool.filter((i) => state.give.includes(i.id))); const getTotal = sum(getPool.filter((i) => state.get.includes(i.id)));
  const gap = getTotal - giveTotal;
  return (
    <div className="space-y-8">
      <ItemPicker title={getTitle} hint="Pick one or more of their items." items={getPool} selected={state.get} onChange={(get) => onChange({ ...state, get })} locked={lockedGet} />
      <ItemPicker title={giveTitle} hint="Pick items you'd offer. Leave empty to propose cash only." items={givePool} selected={state.give} onChange={(give) => onChange({ ...state, give })} empty={giveEmpty} />
      <fieldset className="space-y-3"><legend className="text-base font-bold">Cash difference (optional)</legend>
        <p className="text-sm text-muted">Even things out with a proposed amount. It&apos;s a negotiated proposal only — SWAPD doesn&apos;t move money.</p>
        <div className="grid items-end gap-3 sm:grid-cols-2">
          <Field label="Amount (₹)">{(p) => <Input {...p} type="number" min={0} max={10000000} inputMode="numeric" value={state.cash || ''} placeholder="0" onChange={(e) => onChange({ ...state, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />}</Field>
          <div role="radiogroup" aria-label="Who pays the difference" className="grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-1 text-sm font-semibold">
            {(['ME', 'THEM'] as const).map((w) => <button key={w} type="button" role="radio" aria-checked={state.payer === w} disabled={!state.cash} onClick={() => onChange({ ...state, payer: w })} className={cn('h-10 rounded-full disabled:opacity-50', state.payer === w && 'bg-surface shadow')}>{w === 'ME' ? 'I add cash' : 'They add cash'}</button>)}
          </div>
        </div>
        {state.cash > 0 && <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-mint-ink" aria-live="polite">{state.payer === 'ME' ? 'You propose to add' : 'You ask them to add'} <b>{formatINR(state.cash)}</b> (INR). This is an agreed term only — SWAPD doesn&apos;t take or hold payments.</p>}
        {(giveTotal > 0 || getTotal > 0) && <p className="rounded-2xl bg-butter px-4 py-3 text-sm text-butter-ink" aria-live="polite">Owner estimates: you give ~{formatINR(giveTotal)} · you get ~{formatINR(getTotal)}{gap !== 0 && <> · gap ~{formatINR(Math.abs(gap))} ({gap > 0 ? 'you may add' : 'they may add'})</>}. {VALUE_DISCLAIMER}</p>}
      </fieldset>
      <Field label="Message (optional)">{(p) => <Textarea {...p} maxLength={500} value={state.message} onChange={(e) => onChange({ ...state, message: e.target.value })} className="min-h-20" placeholder="Say hi, suggest a meet-up spot…" />}</Field>
      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
export const CashNote = () => <p className="text-xs text-muted">{CASH_DISCLAIMER}</p>;
