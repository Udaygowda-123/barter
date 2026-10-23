'use client';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeftRight, BadgeCheck, EyeOff, Handshake, MessageSquareText, Search, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const P = (n: string) => `/demo/${n}.webp`;
type Photo = { src: string; label: string; value: string };
const PHOTOS: Photo[] = [
  { src: P('sneakers'), label: 'Retro sneakers', value: '₹4,000' }, { src: P('camera'), label: 'Film camera', value: '₹6,500' },
  { src: P('headphones'), label: 'Headphones', value: '₹3,000' }, { src: P('jacket'), label: 'Denim jacket', value: '₹1,800' },
  { src: P('console'), label: 'Handheld console', value: '₹7,000' }, { src: P('vinyl'), label: 'Sealed vinyl', value: '₹2,500' },
  { src: P('keyboard'), label: 'Mechanical keyboard', value: '₹3,500' }, { src: P('tee'), label: 'Band tee', value: '₹800' },
  { src: P('lamp'), label: 'Desk lamp', value: '₹1,200' }, { src: P('books'), label: 'Paperback set', value: '₹900' },
  { src: P('cards'), label: 'Trading cards', value: '₹5,000' }, { src: P('trail'), label: 'Trail shoes', value: '₹2,200' },
];
const rise = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} className={className}>{children}</motion.div>;
}

function PhotoCard({ p, className }: { p: Photo; className?: string }) {
  return (
    <figure className={cn('relative shrink-0 overflow-hidden rounded-3xl bg-ink/5 shadow-[var(--shadow-card)]', className)}>
      <img src={p.src} alt={p.label} loading="lazy" className="size-full object-cover" />
      <figcaption className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-2xl bg-paper/90 px-3 py-2 text-xs font-bold backdrop-blur"><span className="truncate">{p.label}</span><span className="text-coral-ink">~{p.value}</span></figcaption>
    </figure>
  );
}

function Marquee({ items, reverse }: { items: Photo[]; reverse?: boolean }) {
  const loop = [...items, ...items]; // duplicated so -50% translate loops seamlessly
  return (
    <div className="marquee overflow-hidden py-2" role="group" aria-label="Examples of items people swap">
      <div className={cn('marquee-track', reverse && 'reverse')}>
        {loop.map((p, i) => <PhotoCard key={i} p={p} className={cn('h-64 w-48 md:h-80 md:w-60', i % 2 ? 'mt-6' : '')} />)}
      </div>
    </div>
  );
}

const float = (d: number, y = 10) => ({ animate: { y: [0, -y, 0] }, transition: { duration: 5 + d, repeat: Infinity, ease: 'easeInOut' as const, delay: d } });

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const yA = useTransform(scrollYProgress, [0, 1], [0, -60]); const yB = useTransform(scrollYProgress, [0, 1], [0, 50]);
  return (
    <section ref={ref} className="mesh relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-6 md:grid-cols-[1.05fr_1fr] md:px-8 md:pb-24 md:pt-14">
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.p variants={rise} className="mb-5 inline-flex items-center gap-2 rounded-full bg-surface/80 px-4 py-1.5 text-sm font-semibold text-lavender-ink shadow-sm ring-1 ring-lavender"><Sparkles className="size-4" aria-hidden />Swap, don&apos;t shop</motion.p>
          <motion.h1 variants={rise} className="text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">Your next favorite thing is <span className="relative whitespace-nowrap"><span className="relative z-10">already out there.</span><motion.span aria-hidden initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8, duration: 0.7 }} style={{ originX: 0 }} className="absolute inset-x-0 bottom-1 h-4 rounded-full bg-coral/70 md:bottom-2 md:h-5" /></span></motion.h1>
          <motion.p variants={rise} className="mt-6 max-w-xl text-lg text-muted">Trade item for item, bundle a few together, or even things out with a negotiated cash difference. Real photos, clear terms, both-sides confirmation.</motion.p>
          <motion.div variants={rise} className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg"><Link href="/register">Start swapping</Link></Button><Button asChild size="lg" variant="outline"><Link href="/discover">Browse the feed</Link></Button></motion.div>
          <motion.ul variants={rise} className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted">{['Free to use', 'No payments handled', 'Originals always kept'].map((t) => <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-mint-ink" aria-hidden />{t}</li>)}</motion.ul>
        </motion.div>

        {/* Floating photo collage */}
        <div className="relative mx-auto h-[26rem] w-full max-w-md md:h-[34rem]" aria-hidden>
          <motion.div style={{ y: yA }} className="absolute left-0 top-4 w-[52%]"><motion.div initial={{ opacity: 0, scale: 0.9, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ duration: 0.7 }}><motion.div {...float(0, 10)}><PhotoCard p={PHOTOS[0]} className="aspect-[4/5] w-full ring-4 ring-white" /></motion.div></motion.div></motion.div>
          <motion.div style={{ y: yB }} className="absolute right-0 top-0 w-[46%]"><motion.div initial={{ opacity: 0, scale: 0.9, rotate: 10 }} animate={{ opacity: 1, scale: 1, rotate: 5 }} transition={{ delay: 0.15 }}><motion.div {...float(1.2, 14)}><PhotoCard p={PHOTOS[2]} className="aspect-[4/5] w-full ring-4 ring-white" /></motion.div></motion.div></motion.div>
          <motion.div style={{ y: yB }} className="absolute bottom-0 left-[6%] w-[44%]"><motion.div initial={{ opacity: 0, scale: 0.9, rotate: 8 }} animate={{ opacity: 1, scale: 1, rotate: 4 }} transition={{ delay: 0.3 }}><motion.div {...float(0.6, 12)}><PhotoCard p={PHOTOS[1]} className="aspect-[4/5] w-full ring-4 ring-white" /></motion.div></motion.div></motion.div>
          <motion.div style={{ y: yA }} className="absolute bottom-6 right-[2%] w-[42%]"><motion.div initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: -4 }} transition={{ delay: 0.45 }}><motion.div {...float(1.8, 9)}><PhotoCard p={PHOTOS[3]} className="aspect-[4/5] w-full ring-4 ring-white" /></motion.div></motion.div></motion.div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ delay: 0.9, duration: 1, type: 'spring', bounce: 0.4 }} className="absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-paper shadow-[var(--shadow-pop)]"><ArrowLeftRight className="size-7" /></motion.div>
          <motion.span {...float(0.3, 6)} className="absolute left-[44%] top-[58%] z-10 rounded-full bg-mint px-4 py-1.5 text-sm font-black text-mint-ink shadow-lg">+ ₹1,000</motion.span>
          <motion.span {...float(1, 8)} className="absolute right-[6%] top-[46%] z-10 rounded-full bg-lavender px-4 py-1.5 text-sm font-black text-lavender-ink shadow-lg">Offer accepted ✓</motion.span>
        </div>
      </div>
      <div className="pb-12"><Marquee items={PHOTOS} /><Marquee items={[...PHOTOS].reverse()} reverse /><p className="mt-3 text-center text-xs text-muted">Demo photos from Wikimedia Commons (open licences) — not real listings.</p></div>
    </section>
  );
}

const STEPS = [
  { icon: Search, title: 'Discover', body: 'Browse an image-first feed ranked by what you want and what you have.', tone: 'bg-coral-soft text-coral-ink' },
  { icon: ArrowLeftRight, title: 'Propose', body: 'Offer one item, several, or items plus a negotiated cash difference.', tone: 'bg-lavender text-lavender-ink' },
  { icon: MessageSquareText, title: 'Negotiate', body: 'Counter with clear versions. Nothing is agreed until someone accepts exact terms.', tone: 'bg-butter text-butter-ink' },
  { icon: Handshake, title: 'Swap', body: 'Arrange a handover. A swap completes only when both of you confirm.', tone: 'bg-mint text-mint-ink' },
];
export function HowItWorks() {
  return (
    <section aria-labelledby="how" className="mx-auto max-w-7xl px-5 py-20 md:px-8">
      <Reveal><p className="text-sm font-bold uppercase tracking-widest text-coral-ink">How it works</p><h2 id="how" className="mt-2 max-w-2xl text-4xl font-black tracking-tight md:text-5xl">Four steps from “I don&apos;t use this” to “I love this”.</h2></Reveal>
      <motion.ol variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} className="mt-12 grid gap-5 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.li key={s.title} variants={rise} whileHover={{ y: -6 }} className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <span className={cn('flex size-14 items-center justify-center rounded-2xl', s.tone)}><s.icon className="size-7" aria-hidden /></span>
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted">Step {i + 1}</p><h3 className="mt-1 text-xl font-bold">{s.title}</h3><p className="mt-2 text-sm text-muted">{s.body}</p>
          </motion.li>))}
      </motion.ol>
    </section>
  );
}

export function SwapShowcase() {
  return (
    <section aria-labelledby="show" className="bg-ink py-20 text-paper">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 md:grid-cols-2 md:px-8">
        <Reveal>
          <p className="text-sm font-bold uppercase tracking-widest text-coral">Negotiate with confidence</p>
          <h2 id="show" className="mt-2 text-4xl font-black tracking-tight md:text-5xl">Every counter is a version. Accept the exact one.</h2>
          <p className="mt-4 max-w-md text-paper/75">No more “wait, I thought we agreed…”. Terms are locked to the revision both of you saw, with a full history and a deal that needs both confirmations.</p>
          <ul className="mt-6 space-y-2 text-sm text-paper/85">{['Item-for-item, bundles, or item + cash', 'Offers expire if nobody responds', 'Dispute and moderation paths built in'].map((t) => <li key={t} className="flex items-center gap-2"><BadgeCheck className="size-4 text-mint" aria-hidden />{t}</li>)}</ul>
        </Reveal>
        <Reveal>
          <div className="relative rounded-[2rem] bg-white/5 p-5 ring-1 ring-white/10" role="img" aria-label="Illustration of an offer with a counteroffer: sneakers for headphones plus 500 rupees">
            {[{ v: 'Version 1', a: PHOTOS[0], b: PHOTOS[2], c: null, t: 'Offered by Bilal' }, { v: 'Version 2', a: PHOTOS[0], b: PHOTOS[2], c: '+ ₹500 from Bilal', t: 'Countered by Asha' }].map((r, i) => (
              <motion.div key={r.v} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.25 }} className={cn('flex items-center gap-3 rounded-2xl p-3', i ? 'mt-3 bg-coral text-ink' : 'bg-white/10')}>
                <img src={r.a.src} alt="" className="size-16 rounded-xl object-cover" /><ArrowLeftRight className="size-5 shrink-0" aria-hidden /><img src={r.b.src} alt="" className="size-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1"><p className="text-sm font-black">{r.v}</p><p className="truncate text-xs opacity-80">{r.t}</p></div>{r.c && <span className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-paper">{r.c}</span>}
              </motion.div>))}
            <motion.p initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.7 }} className="mt-3 rounded-2xl bg-mint px-4 py-3 text-center text-sm font-black text-mint-ink">Accepted: version 2 → deal created ✓</motion.p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const CATS = [{ n: 'Sneakers', c: 'SNEAKERS', p: 'sneakers' }, { n: 'Fashion', c: 'FASHION', p: 'jacket' }, { n: 'Tech', c: 'ELECTRONICS', p: 'headphones' }, { n: 'Gaming', c: 'GAMING', p: 'console' }, { n: 'Collectibles', c: 'COLLECTIBLES', p: 'vinyl' }, { n: 'Hobbies', c: 'HOBBIES', p: 'camera' }];
export function Categories() {
  return (
    <section aria-labelledby="cats" className="mx-auto max-w-7xl px-5 py-20 md:px-8">
      <Reveal><h2 id="cats" className="text-4xl font-black tracking-tight md:text-5xl">Find your corner</h2><p className="mt-2 text-muted">Pick a category and dive in.</p></Reveal>
      <motion.ul variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {CATS.map((c) => (
          <motion.li key={c.c} variants={rise}><Link href={`/discover?category=${c.c}`} className="group relative block aspect-[3/4] overflow-hidden rounded-3xl">
            <img src={P(c.p)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-110" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" /><span className="absolute inset-x-4 bottom-4 flex items-center justify-between text-lg font-black text-paper">{c.n}<ArrowLeftRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></span>
          </Link></motion.li>))}
      </motion.ul>
    </section>
  );
}

const TRUST = [
  { icon: BadgeCheck, title: 'Explicit deal states', body: 'Accepted terms are locked to the exact version both sides saw.', tone: 'bg-mint text-mint-ink' },
  { icon: EyeOff, title: 'Privacy by default', body: 'Only your city is shown — never your address. Location is opt-in.', tone: 'bg-lavender text-lavender-ink' },
  { icon: ShieldCheck, title: 'Reports, blocks & mods', body: 'Report anything, block anyone, with an audited moderation trail.', tone: 'bg-coral-soft text-coral-ink' },
  { icon: Sparkles, title: 'Honest photos', body: 'Enhancement fixes light and framing, never hides damage. Originals are kept.', tone: 'bg-butter text-butter-ink' },
];
export function Trust() {
  return (
    <section aria-labelledby="trust" className="bg-surface py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <Reveal><h2 id="trust" className="max-w-2xl text-4xl font-black tracking-tight md:text-5xl">Built for trust, not just trading</h2></Reveal>
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (<motion.div key={t.title} variants={rise} whileHover={{ y: -6 }} className="rounded-[var(--radius-card)] border border-line bg-paper p-6"><span className={cn('flex size-12 items-center justify-center rounded-2xl', t.tone)}><t.icon className="size-6" aria-hidden /></span><h3 className="mt-4 text-lg font-bold">{t.title}</h3><p className="mt-2 text-sm text-muted">{t.body}</p></motion.div>))}
        </motion.div>
        <Reveal className="mt-14">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-coral via-[#ff9a7e] to-[#ffc2a8] p-8 text-ink md:p-14">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-6"><div><h2 className="max-w-xl text-3xl font-black tracking-tight md:text-5xl">Got something sitting around? Trade it for something you&apos;ll love.</h2><p className="mt-2 font-medium">Takes two minutes to list. Free while we grow.</p></div><Button asChild variant="ink" size="lg"><Link href="/register">Create free account</Link></Button></div>
            <img src={P('camera')} alt="" aria-hidden className="absolute -right-6 -top-10 hidden w-52 rotate-12 rounded-3xl opacity-90 shadow-2xl ring-4 ring-white/70 md:block" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
