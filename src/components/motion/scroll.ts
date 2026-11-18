'use client';
import { useEffect, type RefObject } from 'react';

/** Calls back with how far an element has travelled through the viewport (0 = just entering, 1 = leaving), once per frame while scrolling. */
export function useScrollProgress(ref: RefObject<HTMLElement>, cb: (p: number) => void, opts: { start?: number; end?: number } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = opts.start ?? 1, end = opts.end ?? 0; // viewport fractions where the element's top/bottom sit at p=0 / p=1
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const a = vh * start, b = vh * end - r.height; // top position at p=0 and p=1
      cb(Math.max(0, Math.min(1, (a - r.top) / (a - b))));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
