import { ArrowLeftRight, BadgeCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PHOTOS, type Photo } from './landing-data';

/**
 * Server-rendered hero: all motion is CSS (see globals.css), so photos and headline are visible in the first HTML
 * paint — no JavaScript has to run before the largest content appears.
 */
function PhotoCard({ p, className, decorative, priority }: { p: Photo; className?: string; decorative?: boolean; priority?: boolean }) {
  return (
    <figure aria-hidden={decorative || undefined} className={cn('relative shrink-0 overflow-hidden rounded-3xl bg-ink/5 shadow-[var(--shadow-card)]', className)}>
      <img src={p.src} alt={decorative ? '' : p.label} width={640} height={800} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" className="size-full object-cover" />
      <figcaption className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-2xl bg-paper/90 px-3 py-2 text-xs font-bold backdrop-blur"><span className="truncate">{p.label}</span><span className="text-coral-ink">~{p.value}</span></figcaption>
    </figure>
  );
}

function Marquee({ items, reverse }: { items: Photo[]; reverse?: boolean }) {
  const loop = [...items, ...items]; // duplicated so a -50% translate loops seamlessly
  return (
    <div className="marquee overflow-hidden py-2" role="group" aria-label="Examples of items people swap">
      <div className={cn('marquee-track', reverse && 'reverse')}>
        {loop.map((p, i) => <PhotoCard key={i} p={p} decorative={i >= items.length} className={cn('h-52 w-40 sm:h-64 sm:w-48 md:h-80 md:w-60', i % 2 ? 'mt-6' : '')} />)}
      </div>
    </div>
  );
}

const slots = [
  { i: 0, cls: 'left-0 top-4 w-[52%]', r: '-6deg', d: '0s', f: '0s', priority: true },
  { i: 2, cls: 'right-0 top-0 w-[46%]', r: '5deg', d: '.12s', f: '1.2s', priority: true },
  { i: 1, cls: 'bottom-0 left-[6%] w-[44%]', r: '4deg', d: '.24s', f: '.6s' },
  { i: 3, cls: 'bottom-6 right-[2%] w-[42%]', r: '-4deg', d: '.36s', f: '1.8s' },
];

export function Hero() {
  return (
    <section className="mesh relative overflow-x-clip">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.05fr_1fr] md:px-8 md:pb-24 md:pt-14">
        <div>
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full bg-surface/80 px-4 py-1.5 text-sm font-semibold text-lavender-ink shadow-sm ring-1 ring-lavender"><Sparkles className="size-4" aria-hidden />Swap, don&apos;t shop</p>
          <h1 className="rise text-[2.6rem] font-black leading-[1.04] tracking-tight [--d:.08s] sm:text-5xl md:text-7xl">Your next favorite thing is <span className="relative md:whitespace-nowrap"><span className="relative z-10">already out there.</span><span aria-hidden className="underline-draw absolute inset-x-0 bottom-1 h-4 rounded-full bg-coral/70 md:bottom-2 md:h-5" /></span></h1>
          <p className="rise mt-6 max-w-xl text-lg text-muted [--d:.16s]">Trade item for item, bundle a few together, or even things out with a negotiated cash difference. Real photos, clear terms, both-sides confirmation.</p>
          <div className="rise mt-9 flex flex-wrap gap-3 [--d:.24s]"><Button asChild size="lg"><Link href="/register">Start swapping</Link></Button><Button asChild size="lg" variant="outline"><Link href="/discover">Browse the feed</Link></Button></div>
          <ul className="rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted [--d:.32s]">{['Free to use', 'No payments handled', 'Originals always kept'].map((t) => <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-mint-ink" aria-hidden />{t}</li>)}</ul>
        </div>

        <div className="relative mx-auto h-[26rem] w-full max-w-md md:h-[34rem]" aria-hidden>
          {slots.map((s) => (
            <div key={s.i} className={cn('collage-in absolute', s.cls)} style={{ ['--r' as string]: s.r, ['--d' as string]: s.d }}>
              <div className="float" style={{ ['--f' as string]: s.f }}><PhotoCard p={PHOTOS[s.i]} priority={s.priority} className="aspect-[4/5] w-full ring-4 ring-white" /></div>
            </div>
          ))}
          <div className="spin-in absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-paper shadow-[var(--shadow-pop)]"><ArrowLeftRight className="size-7" /></div>
          <span className="float absolute left-[44%] top-[58%] z-10 rounded-full bg-mint px-4 py-1.5 text-sm font-black text-mint-ink shadow-lg" style={{ ['--f' as string]: '.3s' }}>+ ₹1,000</span>
          <span className="float absolute right-[6%] top-[46%] z-10 rounded-full bg-lavender px-4 py-1.5 text-sm font-black text-lavender-ink shadow-lg" style={{ ['--f' as string]: '1s' }}>Offer accepted ✓</span>
        </div>
      </div>
      <div className="pb-12"><Marquee items={PHOTOS} /><Marquee items={[...PHOTOS].reverse()} reverse /><p className="mt-3 text-center text-xs text-muted">Demo photos from Wikimedia Commons (open licences) — not real listings.</p></div>
    </section>
  );
}
