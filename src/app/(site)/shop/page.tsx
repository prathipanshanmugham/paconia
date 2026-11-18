import Link from 'next/link';
import ProductCard from '@/components/site/ProductCard';
import { productCards } from '@/lib/shop';
import { FAMILIES } from '@/lib/catalog';
import { Tabs } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shop all products' };

export default async function Shop() {
  const cards = await productCards();
  return (
    <div className="wrap py-10">
      <h1 className="text-[2.2rem]">All products</h1>
      <p className="mb-6 mt-2 max-w-2xl text-ink-soft">The price shown is a piece at our largest standard quantity. Open a product for the exact price at your size and quantity.</p>
      <Tabs current="/shop" items={[{ href: '/shop', label: 'All products' }, ...FAMILIES.map((f) => ({ href: `/shop/${f.slug}`, label: f.name }))]} />
      {FAMILIES.map((f) => {
        const list = cards.filter((c) => c.family === f.key);
        if (!list.length) return null;
        return (
          <section key={f.key} className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-2xl"><Link href={`/shop/${f.slug}`} className="hover:text-sky-700">{f.name}</Link></h2><p className="text-sm text-ink-soft">{f.blurb}</p></div></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
