'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { prefersReduced, useScrollProgress } from './scroll';

const STEPS = [
  { at: 0, title: 'Your artwork, printed flat', body: 'Front, sides, back and lid are printed edge to edge on one sheet of card. White ink goes under the colour on kraft and black board.' },
  { at: 0.27, title: 'Cut and creased to the dieline', body: 'The cutter cuts the outline and presses every fold line, so each box in the run comes out the same size.' },
  { at: 0.58, title: 'Folded into a box', body: 'Sides first, then the dust flaps, then the lid tucks in. It holds its shape without tape.' },
  { at: 0.88, title: 'Made to your size', body: 'Any size from 30 to 150 mm wide and up to 200 mm tall, from 25 boxes. Choose the card and finish and see the price as you go.' },
];
const ease = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/** A printed sheet that folds into a tuck-end box as you scroll. */
export default function FoldingStory() {
  const section = useRef<HTMLElement>(null), host = useRef<HTMLDivElement>(null);
  const api = useRef<((t: number) => void) | null>(null);
  const [p, setP] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { setReduced(prefersReduced()); }, []);

  useEffect(() => {
    let dead = false, stage: import('@/components/three/Stage').Stage | null = null;
    (async () => {
      const [{ Stage, webglOk }, { buildFoldingBox }] = await Promise.all([import('@/components/three/Stage'), import('@/components/three/mockup')]);
      if (dead || !host.current || !webglOk()) return;
      await document.fonts?.ready;
      const s = new Stage(host.current); stage = s; s.fixedView = true;
      const box = buildFoldingBox(6, 4, 9);
      const shot = (t: number, elev: number, fill: number) => { box.setFold(t); s.view.azimuth = -0.3; s.view.elevation = elev; s.set(box.group); s.frame(fill); return { d: s.view.distance, target: s.target.clone() }; };
      const B = shot(0.74, 0.36, 0.84); // framed with the lid still open, the tallest moment
      s.content.remove(box.group);
      const A = shot(0, 1.12, 0.86);
      api.current = (t) => {
        box.setFold(t);
        const k = ease(0.1, 0.8, t);
        s.view.elevation = 1.12 + (0.36 - 1.12) * k; s.view.distance = A.d + (B.d - A.d) * k; s.target.lerpVectors(A.target, B.target, k);
        s.place();
      };
      api.current(prefersReduced() ? 1 : 0);
      setReady(true);
    })();
    return () => { dead = true; stage?.destroy(); };
  }, []);

  useScrollProgress(section, (v) => { if (prefersReduced()) return; setP(v); api.current?.(v); }, { start: 0, end: 1 });
  useEffect(() => { if (ready) api.current?.(reduced ? 1 : p); }, [ready, reduced, p]);

  const active = reduced ? STEPS.length - 1 : STEPS.reduce((a, s, i) => (p >= s.at ? i : a), 0);

  return (
    <section ref={section} aria-label="How a box is made" className={reduced ? 'border-y border-line bg-white' : 'relative h-[320vh] border-y border-line bg-white'}>
      <div className={reduced ? 'wrap grid items-center gap-8 py-14 lg:grid-cols-[0.9fr_1.1fr]' : 'sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden lg:top-[4.5rem] lg:h-[calc(100svh-4.5rem)]'}>
        <div className={reduced ? 'contents' : 'wrap grid h-full w-full grid-rows-[1fr_auto] items-center gap-4 py-6 lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-1 lg:gap-10'}>
          <div className="order-2 lg:order-1">
            <h2 className="text-[1.75rem] leading-tight">From a flat sheet to your box</h2>
            {reduced ? (
              <ol className="mt-5 space-y-4">{STEPS.map((s) => <li key={s.title}><h3 className="text-lg">{s.title}</h3><p className="mt-1 text-[15px] text-ink-soft">{s.body}</p></li>)}</ol>
            ) : (
              <>
                <div className="relative mt-4 min-h-[8.5rem] sm:min-h-[7rem]">
                  {STEPS.map((s, i) => (
                    <div key={s.title} className="fold-caption absolute inset-0" data-on={i === active || undefined} aria-hidden={i !== active}>
                      <h3 className="text-xl">{s.title}</h3>
                      <p className="mt-2 max-w-md text-[15px] text-ink-soft">{s.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex max-w-xs gap-1.5" aria-hidden>
                  {STEPS.map((s, i) => {
                    const next = STEPS[i + 1]?.at ?? 1, f = Math.max(0, Math.min(1, (p - s.at) / (next - s.at)));
                    return <span key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-mist"><span className="block h-full origin-left rounded-full bg-sky-500" style={{ transform: `scaleX(${f})` }} /></span>;
                  })}
                </div>
              </>
            )}
            <Link href="/p/product-boxes" className={`btn-primary mt-6 transition-opacity duration-500 ${reduced || active === STEPS.length - 1 ? 'opacity-100' : 'pointer-events-none opacity-0'}`} tabIndex={reduced || active === STEPS.length - 1 ? 0 : -1}>Price your boxes</Link>
          </div>
          <div className={`bg-studio relative order-1 h-full min-h-[280px] w-full overflow-hidden rounded-3xl lg:order-2 ${reduced ? 'aspect-[4/3] h-auto' : ''}`}>
            <div ref={host} className={`absolute inset-0 transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} role="img" aria-label="A printed box sheet folding into a tuck-end box" />
          </div>
        </div>
      </div>
    </section>
  );
}
