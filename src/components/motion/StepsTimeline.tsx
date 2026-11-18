'use client';
import { useRef, useState } from 'react';
import { useScrollProgress } from './scroll';

/** Order steps on a line that fills as you scroll; each step lights up when the line reaches it. */
export default function StepsTimeline({ steps }: { steps: [string, string][] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [p, setP] = useState(0);
  useScrollProgress(ref, setP, { start: 0.85, end: 0.55 });
  const n = steps.length;
  return (
    <ol ref={ref} className="timeline relative mt-10 grid gap-9 lg:grid-cols-4 lg:gap-6" style={{ ['--p' as string]: p }}>
      <span aria-hidden className="timeline-track" />
      <span aria-hidden className="timeline-fill" />
      {steps.map(([t, d], i) => {
        const on = p >= (n === 1 ? 0 : i / (n - 1)) - 0.02;
        return (
          <li key={t} className="relative pl-14 lg:pl-0 lg:pt-14" data-on={on || undefined}>
            <span className="timeline-dot num">{i + 1}</span>
            <h3 className="text-lg">{t}</h3>
            <p className="mt-1.5 text-[15px] text-ink-soft">{d}</p>
          </li>
        );
      })}
    </ol>
  );
}
