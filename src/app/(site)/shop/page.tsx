import Link from 'next/link';
import ProductCard from '@/components/site/ProductCard';
import { productCards } from '@/lib/shop';
import { FAMILIES } from '@/lib/catalog';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shop all products' };

export default async function Shop() {
  const cards = await productCards();
  return (
    <div className="wrap py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">All products</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">Prices shown are per piece at our largest standard quantity. Open a product to see the exact price for your size and quantity.</p>
      <div className="mt-6 flex flex-wrap gap-2">{FAMILIES.map((f) => <Link key={f.key} href={`/shop/${f.slug}`} className="chip">{f.name}</Link>)}</div>
      {FAMILIES.map((f) => {
        const list = cards.filter((c) => c.family === f.key);
        if (!list.length) return null;
        return (
          <section key={f.key} className="mt-12">
            <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">{f.name}</h2><p className="text-sm text-ink-soft">{f.blurb}</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
