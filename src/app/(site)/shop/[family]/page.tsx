import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/site/ProductCard';
import { productCards } from '@/lib/shop';
import { FAMILIES, familyBySlug } from '@/lib/catalog';
import { Tabs } from '@/components/ui';

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
      <h1 className="text-[2.2rem]">{fam.name}</h1>
      <p className="mb-6 mt-2 max-w-2xl text-ink-soft">{fam.blurb}</p>
      <Tabs current={`/shop/${fam.slug}`} items={[{ href: '/shop', label: 'All products' }, ...FAMILIES.map((f) => ({ href: `/shop/${f.slug}`, label: f.name }))]} />
      <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      {cards.length === 0 && <p className="mt-8 text-ink-soft">Nothing here yet. <Link href="/quote" className="underline">Ask us for a quote</Link>.</p>}
    </div>
  );
}
