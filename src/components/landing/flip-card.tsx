import { ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SwapPair = { a: { src: string; label: string }; b: { src: string; label: string } };

/** Real demo items, each paired with what it's being swapped for (shown on the card's back face). */
export const SWAP_PAIRS: SwapPair[] = [
  { a: { src: '/demo/thumb/sneakers-1.webp', label: 'Sneakers' }, b: { src: '/demo/thumb/headphones-1.webp', label: 'Headphones' } },
  { a: { src: '/demo/thumb/camera-0.webp', label: 'Film camera' }, b: { src: '/demo/thumb/vinyl-0.webp', label: 'Sealed vinyl' } },
  { a: { src: '/demo/thumb/console-1.webp', label: 'Console' }, b: { src: '/demo/thumb/jacket-1.webp', label: 'Denim jacket' } },
];

/**
 * Two-sided item card: front = the item, back = what it's swapped for. The 3D flip is self-contained inside the
 * card (its own perspective), so neighbouring cards are never depth-sorted against each other.
 * `auto` runs the CSS flip loop (mobile deck); otherwise a parent drives `.flip-inner` (desktop orbit).
 */
export function FlipCard({ pair, auto, delay, rotate, className }: { pair: SwapPair; auto?: boolean; delay?: string; rotate?: number; className?: string }) {
  return (
    <div className={cn('flip', auto && 'flip-auto', className)} style={delay ? ({ '--fd': delay } as React.CSSProperties) : undefined}>
      <div className="flip-inner" style={rotate != null ? { transform: `rotateY(${rotate.toFixed(1)}deg)` } : undefined}>
        <figure className="flip-face rounded-2xl bg-white p-1.5 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/40">
          <img src={pair.a.src} alt="" width={480} height={600} decoding="async" className="aspect-[4/5] w-full rounded-xl object-cover" />
          <figcaption className="orbit-caption h-[22px] truncate px-1 pt-1.5 text-[11px] font-bold leading-none text-ink sm:text-xs">{pair.a.label}</figcaption>
        </figure>
        <figure className="flip-face flip-back rounded-2xl bg-coral p-1.5 shadow-[0_24px_50px_-20px_rgb(255_118_94/0.7)]">
          <img src={pair.b.src} alt="" width={480} height={600} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded-xl object-cover" />
          <figcaption className="orbit-caption flex h-[22px] items-center gap-1 px-1 pt-1.5 text-[11px] font-bold leading-none text-ink sm:text-xs"><ArrowLeftRight className="size-3 shrink-0" strokeWidth={3} aria-hidden /><span className="truncate">{pair.b.label}</span></figcaption>
        </figure>
      </div>
    </div>
  );
}

/** Mobile/tablet hero visual: three cards flipping in turn to reveal their swap. Pure CSS — visible in the first paint. */
export function FlipDeck() {
  return (
    <div aria-hidden className="mx-auto flex max-w-md items-start justify-center gap-3 pt-3 sm:mx-0 sm:justify-start sm:gap-5">
      {SWAP_PAIRS.map((p, i) => (
        <FlipCard key={p.a.label} pair={p} auto delay={`${i * 1.1}s`} className={cn('w-[30%] max-w-[9.5rem]', i === 1 ? '-translate-y-3' : i === 0 ? 'rotate-[-4deg]' : 'rotate-[4deg]')} />
      ))}
    </div>
  );
}
