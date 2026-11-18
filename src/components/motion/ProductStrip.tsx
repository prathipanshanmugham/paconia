'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { prefersReduced, useScrollProgress } from './scroll';

type Item = { slug: string; name: string; image: string; from: string | null };

/** A row of product renders that slides sideways as the page scrolls (swipe it on phones). */
export default function ProductStrip({ items }: { items: Item[] }) {
  const wrap = useRef<HTMLDivElement>(null), row = useRef<HTMLUListElement>(null);
  useScrollProgress(wrap, (p) => {
    const r = row.current, w = wrap.current;
    if (!r || !w || prefersReduced() || window.innerWidth < 1024) { if (r) r.style.transform = ''; return; }
    const travel = Math.max(0, r.scrollWidth - w.clientWidth);
    r.style.transform = `translate3d(${-p * travel}px,0,0)`;
  }, { start: 1, end: 0 });
  return (
    <div ref={wrap} className="overflow-x-auto pb-2 lg:overflow-hidden [scrollbar-width:none]">
      <ul ref={row} className="flex w-max gap-4 px-4 will-change-transform sm:px-6 lg:px-[max(1.5rem,calc((100vw-1200px)/2))]">
        {items.map((it) => (
          <li key={it.slug} className="w-[230px] shrink-0 sm:w-[260px]">
            <Link href={`/p/${it.slug}`} className="group block">
              <div className="bg-studio aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-line transition-shadow group-hover:shadow-lift">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.image} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.05]" />
              </div>
              <p className="mt-2.5 font-semibold leading-snug group-hover:text-sky-700">{it.name}</p>
              {it.from && <p className="text-sm text-ink-soft">From <span className="num font-semibold text-ink">{it.from}</span> a piece</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
