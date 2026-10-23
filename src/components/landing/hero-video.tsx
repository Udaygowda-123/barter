'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Background video for the hero. The poster (rendered by the server, see Hero) is the LCP image and the fallback:
 * the video is only attached after the page is idle, and never for reduced-motion, data-saver or 2G users.
 * It pauses when scrolled away or when the tab is hidden, and fades in only once frames are actually playing.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (reduce || conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(() => setEnabled(true), { timeout: 2500 }); return () => w.cancelIdleCallback?.(id); }
    const t = setTimeout(() => setEnabled(true), 1200); return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const v = ref.current; if (!enabled || !v) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && document.visibilityState === 'visible') v.play().catch(() => undefined); else v.pause(); }, { threshold: 0.15 });
    io.observe(v);
    const onVis = () => (document.visibilityState === 'visible' ? v.play().catch(() => undefined) : v.pause());
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <video ref={ref} aria-hidden tabIndex={-1} muted loop playsInline autoPlay preload="auto" poster="/video/hero-poster.webp"
      onPlaying={() => setPlaying(true)} onError={() => setPlaying(false)}
      className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-1000 ${playing ? 'opacity-100' : 'opacity-0'}`}>
      <source src="/video/hero.webm" type="video/webm" />
      <source src="/video/hero.mp4" type="video/mp4" />
    </video>
  );
}
