'use client';
import { ArrowLeftRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

const ITEMS = [
  { src: '/demo/thumb/sneakers-1.webp', label: 'Sneakers', a: 0 },
  { src: '/demo/thumb/headphones-1.webp', label: 'Headphones', a: 120 },
  { src: '/demo/thumb/camera-0.webp', label: 'Film camera', a: 240 },
];

/**
 * The hero's 3D moment, built with CSS 3D transforms instead of a 3D engine: three real demo items orbit a swap
 * token on a tilted plane and always face the viewer. Pointer movement tilts the scene a few degrees.
 * Reduced motion → static composition. No WebGL, no extra dependency, ~0 KB of assets beyond three thumbnails.
 */
export function SwapOrbit() {
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scene.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) return;
    let raf = 0; let tx = 0; let ty = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 16; ty = ((e.clientY - (r.top + r.height / 2)) / window.innerHeight) * -12;
      cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { el.style.setProperty('--ry', `${tx.toFixed(2)}deg`); el.style.setProperty('--rx', `${ty.toFixed(2)}deg`); });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={scene} className="orbit-scene" aria-hidden>
      <div className="orbit-tilt">
        <div className="orbit-ring" />
        <div className="orbit-plane">
          {ITEMS.map((it) => (
            <div key={it.label} className="orbit-sat" style={{ ['--a' as string]: `${it.a}deg` }}>
              <div className="orbit-face">
                <figure className="w-24 overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/40 sm:w-32">
                  <img src={it.src} alt="" width={480} height={600} decoding="async" className="aspect-[4/5] w-full rounded-xl object-cover" />
                  <figcaption className="px-1 pb-0.5 pt-1.5 text-[11px] font-bold text-ink sm:text-xs">{it.label}</figcaption>
                </figure>
              </div>
            </div>
          ))}
        </div>
        <div className="orbit-core"><ArrowLeftRight className="size-8 sm:size-10" strokeWidth={2.5} /></div>
      </div>
    </div>
  );
}
