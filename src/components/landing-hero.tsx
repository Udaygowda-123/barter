import { BadgeCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PHOTOS, type Photo } from './landing-data';
import { HeroVideo } from './landing/hero-video';
import { FlipDeck } from './landing/flip-card';
import { SwapOrbit } from './landing/swap-orbit';

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


export function Hero() {
  return (
    <>
      {/* Immersive hero: poster image is the first paint (and the fallback); the video island fades in on top when ready. */}
      <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-night text-paper">
        <img src="/video/hero-poster.webp" alt="" width={1280} height={720} fetchPriority="high" decoding="async" className="pointer-events-none absolute inset-0 -z-20 size-full object-cover opacity-80" />
        <div className="absolute inset-0 -z-20"><HeroVideo /></div>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgb(16_14_22/.95)_0%,rgb(16_14_22/.86)_45%,rgb(16_14_22/.6)_75%,rgb(16_14_22/.72)_100%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-night to-transparent" />

        <div className="mx-auto grid min-h-[min(100svh,58rem)] max-w-7xl items-center gap-8 px-5 pb-14 pt-24 md:px-8 md:pt-28 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-32">
          <div className="on-ink">
            <p className="rise inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-violet ring-1 ring-white/15 backdrop-blur"><Sparkles className="size-4" aria-hidden />Free peer-to-peer swapping</p>
            <h1 id="hero-title" className="rise mt-6 max-w-[13ch] text-[2.75rem] font-extrabold leading-[0.98] [--d:.06s] sm:text-6xl lg:text-[4.4rem] xl:text-[5rem]">
              Your next <em className="accent font-normal text-violet">favourite</em> thing is already <span className="relative inline-block whitespace-nowrap"><span className="relative z-10">out there.</span><span aria-hidden className="underline-draw absolute inset-x-0 bottom-1 -z-0 h-3 rounded-full bg-coral/80 sm:h-4" /></span>
            </h1>
            <p className="rise mt-6 max-w-xl text-lg leading-relaxed text-paper/80 [--d:.14s] sm:text-xl">Discover things you love. Trade things you don&apos;t. Make every swap count.</p>
            <div className="rise mt-9 flex flex-wrap gap-3 [--d:.22s]">
              <Button asChild size="lg"><Link href="/discover">Explore the marketplace</Link></Button>
              <Button asChild size="lg" variant="light"><Link href="/listing/new">List your first item</Link></Button>
            </div>
            <div className="rise mt-10 [--d:.26s] lg:hidden"><FlipDeck /></div>
            <ul className="rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-paper/75 [--d:.3s]">{['Free to use', 'No payments handled by SWAPD', 'Originals always kept'].map((t) => <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-mint" aria-hidden />{t}</li>)}</ul>
          </div>
          <div className="rise hidden [--d:.2s] lg:block"><SwapOrbit /></div>
        </div>
      </section>

      <section aria-label="Examples of items people swap" className="mesh overflow-x-clip pb-14 pt-12">
        <Marquee items={PHOTOS} /><Marquee items={[...PHOTOS].reverse()} reverse />
        <p className="mt-3 text-center text-xs text-muted">Demo photos from Wikimedia Commons (open licences) — not real listings.</p>
      </section>
    </>
  );
}
