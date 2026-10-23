'use client';
import { domAnimation, LazyMotion, m as motion, MotionConfig } from 'framer-motion';
import { ArrowLeftRight, BadgeCheck, EyeOff, Handshake, MessageSquareText, Search, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { PHOTOS, P } from './landing-data';
const rise = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return <motion.div variants={rise} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} className={className}>{children}</motion.div>;
}

/** Wraps the below-the-fold sections: lazy animation features + reduced-motion support, scoped to this page only. */
export function MotionRoot({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user"><LazyMotion features={domAnimation} strict>{children}</LazyMotion></MotionConfig>;
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
