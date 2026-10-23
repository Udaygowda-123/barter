'use client';
import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

const ITEMS = [
  { src: '/demo/thumb/sneakers-1.webp', label: 'Sneakers' },
  { src: '/demo/thumb/headphones-1.webp', label: 'Headphones' },
  { src: '/demo/thumb/camera-0.webp', label: 'Film camera' },
];
const TURN_MS = 26_000;   // one full revolution
const RATIO = 0.78;       // ellipse height / width — reads as an orbit seen from slightly above
const BACK_SCALE = 0.8;   // card scale at the far side of the orbit
const GAP = 12;           // minimum clearance (px) between any card and the swap token / other cards
const PAD = 6;            // card padding (matches p-1.5)
const CAPTION = 22;       // caption row height when shown

type Geo = { rx: number; ry: number; cw: number; ch: number; cr: number; caption: boolean };

const cardHeight = (cw: number, caption: boolean) => PAD * 2 + (cw - PAD * 2) * 1.25 + (caption ? CAPTION : 0);

/** Smallest clearance over a full revolution: card↔token and card↔card (sampled every 3°). */
function clearance(g: Geo) {
  let token = Infinity; let pair = Infinity;
  for (let k = 0; k < 360; k += 3) {
    const r = [0, 1, 2].map((i) => place(g, k, i));
    for (const c of r) token = Math.min(token, Math.hypot(Math.max(Math.abs(c.x) - c.w, 0), Math.max(Math.abs(c.y) - c.h, 0)) - g.cr);
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) pair = Math.min(pair, Math.max(Math.abs(r[i].x - r[j].x) - r[i].w - r[j].w, Math.abs(r[i].y - r[j].y) - r[i].h - r[j].h));
  }
  return Math.min(token, pair);
}

function place(g: Geo, deg: number, i: number) {
  const th = ((deg + 90 + i * 120) * Math.PI) / 180;
  const d = Math.sin(th); // -1 = far side, 1 = nearest the viewer
  const s = BACK_SCALE + (1 - BACK_SCALE) * ((d + 1) / 2);
  return { x: g.rx * Math.cos(th), y: g.ry * Math.sin(th), d, s, w: (g.cw * s) / 2, h: (g.ch * s) / 2 };
}

/** Largest card size whose whole orbit keeps GAP clearance inside a container of width `w`. */
function solve(w: number): Geo {
  let g: Geo = { rx: 0, ry: 0, cw: 0, ch: 0, cr: 0, caption: false };
  for (let cw = 132; cw >= 52; cw -= 2) {
    const caption = cw >= 96; const rx = Math.min(w / 2 - cw / 2 - 4, 230);
    g = { cw, caption, ch: cardHeight(cw, caption), cr: cw * 0.33, rx, ry: rx * RATIO };
    if (clearance(g) >= GAP) break;
  }
  return g;
}

/**
 * The hero's "3D" moment: three real demo items orbit a swap token. Positions are computed every frame on an
 * ellipse (2.5D: scale + explicit stacking), so cards pass cleanly in front of / behind the token — never through it —
 * and the geometry is solved per container width so nothing ever overlaps. Reduced motion → static composition;
 * paused while off-screen or in a background tab.
 */
export function SwapOrbit() {
  const root = useRef<HTMLDivElement>(null); const ring = useRef<HTMLDivElement>(null); const core = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let g = solve(el.clientWidth); let angle = 0; let last = 0; let raf = 0; let onScreen = true;

    const layout = () => {
      g = solve(el.clientWidth);
      el.style.height = `${Math.ceil(2 * g.ry + g.ch + 8)}px`;
      Object.assign(ring.current!.style, { width: `${2 * g.rx}px`, height: `${2 * g.ry}px` });
      Object.assign(core.current!.style, { width: `${2 * g.cr}px`, height: `${2 * g.cr}px` });
      for (const c of cards.current) if (c) { c.style.width = `${g.cw}px`; c.dataset.caption = String(g.caption); }
      draw();
    };
    const draw = () => cards.current.forEach((c, i) => {
      if (!c) return; const p = place(g, angle, i);
      c.style.transform = `translate(-50%, -50%) translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) scale(${p.s.toFixed(3)})`;
      // Token sits at z 100: near half of the orbit stacks above it, far half below; ties never overlap (see solve()).
      c.style.zIndex = String(Math.round(100 + p.d * 99 + (p.d >= 0 ? 1 : -1)));
      c.style.filter = `brightness(${(0.72 + 0.28 * ((p.d + 1) / 2)).toFixed(3)})`;
    });
    const tick = (t: number) => {
      if (last) angle = (angle + (Math.min(t - last, 50) / TURN_MS) * 360) % 360; // cap dt so a stalled frame doesn't jump
      last = t; draw(); raf = requestAnimationFrame(tick);
    };
    const run = () => { cancelAnimationFrame(raf); last = 0; if (!reduce && onScreen && !document.hidden) raf = requestAnimationFrame(tick); };

    layout(); el.dataset.ready = 'true';
    const ro = new ResizeObserver(layout); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; run(); }); io.observe(el);
    document.addEventListener('visibilitychange', run);
    run();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', run); };
  }, []);

  return (
    <div ref={root} className="orbit-scene" aria-hidden>
      <div ref={ring} className="orbit-ring" />
      <div ref={core} className="orbit-core"><ArrowLeftRight className="size-[45%]" strokeWidth={2.5} /></div>
      {ITEMS.map((it, i) => (
        <figure key={it.label} ref={(n) => { cards.current[i] = n; }} className="orbit-card rounded-2xl bg-white p-1.5 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/40">
          <img src={it.src} alt="" width={480} height={600} decoding="async" className="aspect-[4/5] w-full rounded-xl object-cover" />
          <figcaption className="orbit-caption h-[22px] truncate px-1 pt-1.5 text-[11px] font-bold leading-none text-ink sm:text-xs">{it.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
