import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import { unitPrice } from '@/components/site/money';
import type { Card } from '@/lib/shop';

export default function ProductCard({ p }: { p: Card }) {
  return (
    <Link href={`/p/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-colors hover:border-sky-300">
      <div className="aspect-[4/3] bg-paper"><ProductArt shape={p.shape} colour={p.colour} w={p.w} h={p.h} d={p.d} round={p.round} className="h-full w-full" label={p.name} /></div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-semibold leading-snug group-hover:text-sky-700">{p.name}</h3>
        <p className="mt-1 text-sm text-ink-soft">{p.tagline}</p>
        <p className="mt-auto pt-3 text-sm text-ink-soft">From <b className="num text-base text-ink">{p.fromUnit !== null ? unitPrice(p.fromUnit) : 'on request'}</b> a piece, ready in {p.leadDays}–{p.leadDays + 1} days</p>
      </div>
    </Link>
  );
}
