import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { familyByKey, materialLabel, materialsFor, publicMats, publicPricing } from '@/lib/catalog';
import { getPricing } from '@/lib/settings';
import Configurator from '@/components/site/Configurator';
import type { ProductConfig } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await db.product.findUnique({ where: { slug: params.slug } });
  return p ? { title: p.name, description: p.tagline } : {};
}

export default async function ProductPage({ params, searchParams }: { params: { slug: string }; searchParams: { size?: string; material?: string; finish?: string; qty?: string } }) {
  const p = await db.product.findUnique({ where: { slug: params.slug } });
  if (!p || !p.active) notFound();
  const cfg = p.config as unknown as ProductConfig;
  const mats = await materialsFor(cfg);
  const ps = await getPricing();
  const options = cfg.materials.map((code) => {
    const variant = mats[code] || Object.values(mats).find((m) => m.code.startsWith(code + '-'));
    return { code, name: materialLabel(code, mats), colour: variant?.colour || '#FFFFFF', white: !!variant?.needsWhite, available: !!variant };
  });
  const fam = familyByKey(p.family);
  return (
    <div className="wrap py-8">
      <nav className="mb-5 text-sm text-ink-soft" aria-label="Breadcrumb"><Link href="/shop" className="hover:text-ink">Products</Link><span className="mx-2 text-ink-faint">/</span><Link href={`/shop/${fam?.slug}`} className="hover:text-ink">{fam?.name}</Link></nav>
      <Configurator
        product={{ id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, description: p.description, model: p.model, shape: p.shape, hsn: p.hsn, gstRate: p.gstRate, leadDays: p.leadDays }}
        cfg={cfg} mats={publicMats(mats)} ps={publicPricing(ps)} options={options}
        initial={{ size: searchParams.size === 'custom' ? 'custom' : searchParams.size !== undefined && /^\d+$/.test(searchParams.size) ? Number(searchParams.size) : undefined, material: searchParams.material, finish: searchParams.finish, qty: searchParams.qty && /^\d+$/.test(searchParams.qty) ? Number(searchParams.qty) : undefined }}
      />
    </div>
  );
}
