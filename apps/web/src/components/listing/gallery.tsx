'use client';
import * as D from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Grid2x2, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageDto } from '@/lib/types';
import { cn } from '@/lib/utils';

const AiTag = () => <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-lavender px-3 py-1 text-xs font-bold text-lavender-ink"><Sparkles className="size-3" aria-hidden />AI-enhanced · original kept</span>;

/** Full-screen viewer: swipe (scroll-snap), arrows, keyboard, thumbnails. Radix handles focus trap and Escape. */
function Lightbox({ images, title, index, onIndex, onClose }: { images: ImageDto[]; title: string; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const track = useRef<HTMLDivElement>(null); const settled = useRef(false);
  const go = useCallback((i: number) => { const c = Math.max(0, Math.min(images.length - 1, i)); track.current?.children[c]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); onIndex(c); }, [images.length, onIndex]);
  useEffect(() => { const el = track.current; if (el && !settled.current) { el.scrollLeft = index * el.clientWidth; settled.current = true; } }, [index]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(index + 1); if (e.key === 'ArrowLeft') go(index - 1); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [go, index]);
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[70] bg-ink" />
      <D.Content aria-describedby={undefined} className="fixed inset-0 z-[71] flex flex-col text-paper outline-none on-ink">
        <D.Title className="sr-only">{title} — photos</D.Title>
        <div className="flex items-center justify-between p-4">
          <D.Close aria-label="Close photos" className="flex size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><X aria-hidden /></D.Close>
          <p className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold" aria-live="polite">{index + 1} / {images.length}</p><span className="size-11" />
        </div>
        <div className="relative min-h-0 flex-1">
          <div ref={track} onScroll={(e) => { const el = e.currentTarget; const i = Math.round(el.scrollLeft / el.clientWidth); if (i !== index) onIndex(i); }} className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto" role="group" aria-roledescription="carousel" aria-label={`Photos of ${title}`}>
            {images.map((img, n) => (
              <div key={img.id} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${images.length}`} className="relative flex size-full shrink-0 snap-center items-center justify-center p-2 md:p-8"><img src={img.url} alt={img.altText ?? `${title} photo ${n + 1}`} className="max-h-full max-w-full rounded-2xl object-contain" /></div>
            ))}
          </div>
          {images.length > 1 && (<>
            <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo" className="absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-20 md:flex"><ChevronLeft aria-hidden /></button>
            <button onClick={() => go(index + 1)} disabled={index === images.length - 1} aria-label="Next photo" className="absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 disabled:opacity-20 md:flex"><ChevronRight aria-hidden /></button>
          </>)}
        </div>
        {images.length > 1 && <div className="flex justify-center gap-2 p-4" role="group" aria-label="Choose photo">{images.map((img, n) => <button key={img.id} onClick={() => go(n)} aria-label={`Show photo ${n + 1}`} aria-current={n === index} className={cn('size-14 overflow-hidden rounded-xl border-2 transition-opacity', n === index ? 'border-paper' : 'border-transparent opacity-50 hover:opacity-100')}><img src={img.thumbUrl ?? img.url} alt="" className="size-full object-cover" /></button>)}</div>}
      </D.Content>
    </D.Portal>
  );
}

export function Gallery({ images, title, className }: { images: ImageDto[]; title: string; className?: string }) {
  const [open, setOpen] = useState(false); const [index, setIndex] = useState(0); const mobile = useRef<HTMLDivElement>(null); const [mi, setMi] = useState(0);
  const show = (i: number) => { setIndex(i); setOpen(true); };
  if (!images.length) return <div className="flex aspect-[4/5] items-center justify-center rounded-[var(--radius-card)] bg-ink/5 text-muted">No photos</div>;
  const [a, b, c] = images; const n = images.length;
  const Tile = ({ img, i, cls }: { img: ImageDto; i: number; cls?: string }) => (
    <button type="button" onClick={() => show(i)} aria-label={`Open photo ${i + 1} of ${n} full screen`} className={cn('group relative overflow-hidden bg-ink/5', cls)}>
      <img src={img.url} alt={img.altText ?? `${title} photo ${i + 1}`} loading={i ? 'lazy' : 'eager'} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      {img.aiEdited && i === 0 && <AiTag />}
    </button>
  );
  return (
    <div className={className}>
      {/* Desktop: hotel-style bento grid */}
      <div className="relative hidden h-[34rem] gap-2 overflow-hidden rounded-[var(--radius-card)] md:grid md:grid-cols-4 md:grid-rows-2">
        <Tile img={a} i={0} cls={cn('row-span-2', n === 1 ? 'col-span-4' : n === 2 ? 'col-span-2' : 'col-span-2')} />
        {b && <Tile img={b} i={1} cls={cn(n === 2 ? 'col-span-2 row-span-2' : 'col-span-2', n >= 3 ? '' : '')} />}
        {c && <Tile img={c} i={2} cls="col-span-2" />}
        {n > 1 && <button onClick={() => show(0)} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-bold shadow-lg hover:scale-105"><Grid2x2 className="size-4" aria-hidden />Show all {n} photos</button>}
      </div>
      {/* Mobile: full-width swipe carousel with dots */}
      <div className="relative -mx-4 md:hidden" role="region" aria-roledescription="carousel" aria-label={`Photos of ${title}`}>
        <div ref={mobile} onScroll={(e) => setMi(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))} className="no-scrollbar flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto bg-ink/5">
          {images.map((img, i) => <button key={img.id} type="button" onClick={() => show(i)} aria-label={`Open photo ${i + 1} of ${n} full screen`} className="relative size-full shrink-0 snap-center"><img src={img.url} alt={img.altText ?? `${title} photo ${i + 1}`} loading={i ? 'lazy' : 'eager'} className="size-full object-cover" />{img.aiEdited && i === 0 && <AiTag />}</button>)}
        </div>
        {n > 1 && <>
          <span className="absolute right-4 top-4 rounded-full bg-ink/70 px-3 py-1 text-xs font-bold text-paper">{mi + 1}/{n}</span>
          <div aria-hidden className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">{images.map((_, i) => <span key={i} className={cn('h-1.5 rounded-full bg-paper transition-all', i === mi ? 'w-6' : 'w-1.5 opacity-60')} />)}</div>
        </>}
      </div>
      <D.Root open={open} onOpenChange={setOpen}><Lightbox images={images} title={title} index={index} onIndex={setIndex} onClose={() => setOpen(false)} /></D.Root>
    </div>
  );
}
