import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import { unitPrice } from '@/components/site/money';
import type { Card } from '@/lib/shop';

export default function ProductCard({ p }: { p: Card }) {
  return (
    <Link href={`/p/${p.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[4/3] bg-mist">
        <ProductArt shape={p.shape} colour={p.colour} w={p.w} h={p.h} d={p.d} round={p.round} className="h-full w-full" label={p.name} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">Ready in {p.leadDays}–{p.leadDays + 1} days</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-lg font-semibold leading-snug">{p.name}</h3>
        <p className="text-sm text-ink-soft">{p.tagline}</p>
        <div className="mt-auto flex items-baseline justify-between pt-3 text-sm">
          <span className="text-ink-soft">from</span>
          <span><b className="num font-display text-lg">{p.fromUnit !== null ? unitPrice(p.fromUnit) : '—'}</b> <span className="text-ink-soft">/ piece</span></span>
        </div>
      </div>
    </Link>
  );
}
