import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/site/ProductCard';
import { productCards } from '@/lib/shop';
import { FAMILIES, familyBySlug } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { family: string } }) {
  return { title: familyBySlug(params.family)?.name || 'Shop' };
}

export default async function FamilyPage({ params }: { params: { family: string } }) {
  const fam = familyBySlug(params.family);
  if (!fam) notFound();
  const cards = await productCards({ family: fam.key });
  return (
    <div className="wrap py-10">
      <nav className="text-sm text-ink-soft"><Link href="/shop" className="hover:text-ink">Shop</Link> / {fam.name}</nav>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{fam.name}</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">{fam.blurb}</p>
      <div className="mt-6 flex flex-wrap gap-2">{FAMILIES.map((f) => <Link key={f.key} href={`/shop/${f.slug}`} className={`chip ${f.key === fam.key ? 'chip-on' : ''}`}>{f.name}</Link>)}</div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      {cards.length === 0 && <p className="mt-8 text-ink-soft">Nothing here yet. <Link href="/quote" className="underline">Ask us for a quote</Link>.</p>}
    </div>
  );
}
