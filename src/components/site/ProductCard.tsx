import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import { unitPrice } from '@/components/site/money';
import type { Card } from '@/lib/shop';

export default function ProductCard({ p }: { p: Card }) {
  return (
    <Link href={`/p/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-colors hover:border-sky-300">
      <div className="bg-studio aspect-[4/3] overflow-hidden">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image.src} alt={p.name} loading="lazy" decoding="async" className={`h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.04] ${p.image.photo ? 'object-cover' : 'object-contain'}`} />
        ) : <ProductArt shape={p.shape} colour={p.colour} w={p.w} h={p.h} d={p.d} round={p.round} className="h-full w-full" label={p.name} />}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[17px] font-semibold leading-snug group-hover:text-sky-700">{p.name}</h3>
        <p className="mt-1 text-sm text-ink-soft">{p.tagline}</p>
        <p className="mt-auto pt-3 text-sm text-ink-soft">From <b className="num text-base text-ink">{p.fromUnit !== null ? unitPrice(p.fromUnit) : 'on request'}</b> a piece, ready in {p.leadDays}–{p.leadDays + 1} days</p>
      </div>
    </Link>
  );
}
