import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import type { ProductConfig } from '@/lib/pricing';
import RenderShot from '@/components/three/RenderShot';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false } };

/** Bare full-screen render of a product mockup, used to make the catalogue images. */
export default async function RenderPage({ params, searchParams }: { params: { slug: string }; searchParams: { size?: string; material?: string; finish?: string; az?: string; el?: string } }) {
  const p = await db.product.findUnique({ where: { slug: params.slug } });
  if (!p) notFound();
  const cfg = p.config as unknown as ProductConfig;
  const si = Math.min(Number(searchParams.size ?? Math.min(1, cfg.sizes.length - 1)), cfg.sizes.length - 1);
  const s = cfg.sizes[si];
  const material = searchParams.material || cfg.materials[0];
  const pouchCode = p.model === 'POUCH' && s.code ? `${material}-${s.code}` : material;
  return <RenderShot spec={{ shape: p.shape, w: s.w, h: s.h, d: s.d, round: s.round, material: pouchCode, finish: searchParams.finish || cfg.finishes[0] }} view={{ azimuth: searchParams.az ? Number(searchParams.az) : undefined, elevation: searchParams.el ? Number(searchParams.el) : undefined }} />;
}
