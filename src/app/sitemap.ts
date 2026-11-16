import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { FAMILIES } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const products = await db.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
  return [
    ...['', '/shop', '/quote', '/contact', '/artwork-guide', '/track', '/policies/terms', '/policies/privacy', '/policies/refunds', '/policies/shipping'].map((p) => ({ url: site + p })),
    ...FAMILIES.map((f) => ({ url: `${site}/shop/${f.slug}` })),
    ...products.map((p) => ({ url: `${site}/p/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
