'use client';
import { CONDITION_LABELS } from '@/shared/types';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ArrowLeftRight, Eye, Heart, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { Listing } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { coverOf } from './listing-card';

/**
 * Optional swipe mode. Dragging is a shortcut only: every gesture has a labelled button
 * (Skip / Save / View / Make offer) and Arrow-key equivalents, announced via a live region.
 */
export function SwipeDeck({ items, onNeedMore, hasMore }: { items: Listing[]; onNeedMore: () => void; hasMore: boolean }) {
  const [index, setIndex] = useState(0); const [pi, setPi] = useState(0); const [announce, setAnnounce] = useState(''); const { status } = useAuth(); const router = useRouter(); const toast = useToast();
  const x = useMotionValue(0); const rotate = useTransform(x, [-200, 200], [-12, 12]);
  const saveOpacity = useTransform(x, [20, 120], [0, 1]); const skipOpacity = useTransform(x, [-120, -20], [1, 0]);
  const current = items[index]; const next = items[index + 1];

  useEffect(() => { if (hasMore && items.length - index <= 3) onNeedMore(); }, [index, items.length, hasMore, onNeedMore]);

  async function decide(kind: 'save' | 'skip') {
    if (!current) return;
    if (status !== 'authed') { router.push('/login?next=/discover'); return; }
    const l = current;
    await animate(x, kind === 'save' ? 600 : -600, { duration: 0.22 });
    try {
      await api(`/listings/${l.id}/${kind === 'save' ? 'favorite' : 'dismiss'}`, { method: 'POST' });
      setAnnounce(kind === 'save' ? `Saved ${l.title}` : `Skipped ${l.title}`);
    } catch { toast.error('Could not record that — try again'); }
    x.set(0); setPi(0); setIndex((i) => i + 1);
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]')) return; if (e.key === 'ArrowRight') decide('save'); if (e.key === 'ArrowLeft') decide('skip'); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });

  if (!current) return (<div className="py-20 text-center"><p className="text-xl font-bold">{hasMore ? 'Loading more…' : "You're all caught up"}</p><p className="mt-1 text-muted">{hasMore ? '' : 'Switch to grid view or adjust your filters to see more.'}</p></div>);
  const cover = current.images[pi] ?? coverOf(current); const nPhotos = current.images.length;
  return (
    <div className="mx-auto max-w-sm">
      <p className="sr-only" aria-live="polite">{announce}</p>
      <div className="relative aspect-[4/5]">
        {next && <div aria-hidden className="absolute inset-0 scale-[0.95] overflow-hidden rounded-[var(--radius-card)] bg-ink/10"><img src={coverOf(next)?.thumbUrl ?? ''} alt="" className="size-full object-cover opacity-70" /></div>}
        <motion.div key={current.id} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9} style={{ x, rotate }} onDragEnd={(_, i) => { if (i.offset.x > 110) decide('save'); else if (i.offset.x < -110) decide('skip'); }} className="absolute inset-0 cursor-grab touch-pan-y overflow-hidden rounded-[var(--radius-card)] bg-ink/5 shadow-[var(--shadow-pop)] active:cursor-grabbing">
          {cover && <img src={cover.url} alt={cover.altText ?? current.title} draggable={false} className="size-full object-cover" />}
          {nPhotos > 1 && (<>
            <div aria-hidden className="absolute inset-x-3 top-3 flex gap-1">{current.images.map((im, i) => <span key={im.id} className={`h-1 flex-1 rounded-full ${i <= pi ? 'bg-paper' : 'bg-paper/40'}`} />)}</div>
            <button type="button" onClick={() => setPi((v) => Math.max(0, v - 1))} aria-label="Previous photo" className="absolute inset-y-16 left-0 w-1/3 cursor-w-resize" />
            <button type="button" onClick={() => setPi((v) => Math.min(nPhotos - 1, v + 1))} aria-label="Next photo" className="absolute inset-y-16 right-0 w-1/3 cursor-e-resize" />
          </>)}
          <motion.span style={{ opacity: saveOpacity }} className="absolute left-5 top-5 rotate-[-8deg] rounded-xl border-4 border-mint bg-mint/90 px-3 py-1 text-xl font-black text-mint-ink">SAVE</motion.span>
          <motion.span style={{ opacity: skipOpacity }} className="absolute right-5 top-5 rotate-[8deg] rounded-xl border-4 border-coral bg-coral-soft/90 px-3 py-1 text-xl font-black text-coral-ink">SKIP</motion.span>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-24 text-paper">
            <h3 className="text-2xl font-black leading-tight">{current.title}</h3>
            <p className="mt-1 text-sm text-paper/85">{CONDITION_LABELS[current.condition]} · ~{formatINR(current.estimatedValue)} · {current.locationCity ?? 'Location not shared'}</p>
            <p className="mt-1 text-sm text-paper/70">by {current.owner.displayName}</p>
            {current.match?.reasons[0] && <p className="mt-2 inline-block rounded-full bg-lavender px-3 py-1 text-xs font-bold text-lavender-ink">✦ {current.match.reasons[0]}</p>}
          </div>
        </motion.div>
      </div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" className="size-14" onClick={() => decide('skip')} aria-label="Skip (left arrow)"><X aria-hidden /></Button>
        <Button asChild variant="soft" size="icon" className="size-12"><Link href={`/listing/${current.id}`} aria-label="View details"><Eye aria-hidden /></Link></Button>
        <Button asChild variant="ink" size="icon" className="size-12"><Link href={`/swap/${current.id}`} aria-label="Make an offer"><ArrowLeftRight aria-hidden /></Link></Button>
        <Button size="icon" className="size-14" onClick={() => decide('save')} aria-label="Save (right arrow)"><Heart aria-hidden /></Button>
      </div>
      <p className="mt-4 text-center text-xs text-muted">Drag the card, use the buttons, or press ← / →</p>
    </div>
  );
}
