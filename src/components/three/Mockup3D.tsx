'use client';
import { useEffect, useRef, useState } from 'react';
import type { MockupSpec } from './mockup';

type Props = Omit<MockupSpec, 'logo'> & {
  logoUrl?: string | null; interactive?: boolean; autoRotate?: number; className?: string; label?: string;
  preserve?: boolean; view?: { azimuth?: number; elevation?: number }; onReady?: () => void; fallback?: React.ReactNode;
  /** Turn the product by up to this many radians as the page scrolls past it. */
  scrollTurn?: number;
};

/** Real-time 3D mockup. Loads three.js only in the browser; shows `fallback` until the scene is ready or if WebGL is missing. */
export default function Mockup3D({ logoUrl, interactive, autoRotate = 0, className = '', label = 'Product preview', preserve, view, onReady, fallback, scrollTurn, ...spec }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<import('./Stage').Stage | null>(null);
  const mod = useRef<typeof import('./mockup') | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const key = JSON.stringify([spec.shape, spec.w, spec.h, spec.d, spec.round, spec.material, spec.finish, spec.design]);

  useEffect(() => {
    if (!logoUrl) { setLogo(null); return; }
    const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => setLogo(img); img.onerror = () => setLogo(null); img.src = logoUrl;
  }, [logoUrl]);

  useEffect(() => {
    let dead = false;
    (async () => {
      const [{ Stage, webglOk, reducedMotion }, m] = await Promise.all([import('./Stage'), import('./mockup')]);
      if (dead || !host.current) return;
      if (!webglOk()) { setFailed(true); return; }
      try {
        await document.fonts?.ready;
        const s = new Stage(host.current, { interactive, preserve });
        if (view?.azimuth !== undefined || view?.elevation !== undefined) {
          s.fixedView = true; const d = m.VIEWS[spec.shape] || s.view;
          s.view.azimuth = view.azimuth ?? d.azimuth; s.view.elevation = view.elevation ?? d.elevation;
        }
        s.autoRotate = reducedMotion() ? 0 : autoRotate;
        stage.current = s; mod.current = m;
        s.set(m.buildProduct({ ...spec, logo }));
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!dead) { setReady(true); onReady?.(); } }));
      } catch (e) { console.error(e); setFailed(true); }
    })();
    return () => { dead = true; stage.current?.destroy(); stage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scrollTurn || !ready) return;
    const s = stage.current, el = host.current;
    if (!s || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let base: number | null = null, raf = 0;
    const tick = () => {
      raf = 0;
      if (base === null) base = s.view.azimuth;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
      s.view.azimuth = base - p * scrollTurn; s.place();
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick(); window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [scrollTurn, ready]);

  // rebuild when the options change (debounced so typing a custom size stays smooth)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const s = stage.current, m = mod.current;
      if (s && m) s.set(m.buildProduct({ ...spec, logo }), true);
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, logo, ready]);

  return (
    <div className={/\b(absolute|fixed|sticky)\b/.test(className) ? className : `relative ${className}`} role="img" aria-label={label}>
      <div ref={host} className={`absolute inset-0 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'} ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ touchAction: interactive ? 'pan-y' : 'auto' }} />
      {(!ready || failed) && fallback ? <div className="absolute inset-0">{fallback}</div> : null}
    </div>
  );
}
