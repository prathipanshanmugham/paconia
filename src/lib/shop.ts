import { db } from './db';
import { allMaterialInfo } from './catalog';
import { getPricing } from './settings';
import { price, type ProductConfig } from './pricing';
import type { Product } from '@/generated/prisma/client';
import { productImage } from './images';

export type Card = Product & { fromUnit: number | null; fromQty: number; colour: string; w: number; h: number; d?: number; round?: boolean; image: { src: string; photo: boolean } | null };

export async function productCards(where: { family?: string } = {}): Promise<Card[]> {
  const products = await db.product.findMany({ where: { active: true, ...(where.family ? { family: where.family as Product['family'] } : {}) }, orderBy: [{ family: 'asc' }, { sort: 'asc' }], include: { photos: { where: { kind: 'PRODUCT' }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }], take: 1, select: { id: true } } } });
  const mats = await allMaterialInfo();
  const ps = await getPricing();
  return products.map((p) => {
    const cfg = p.config as unknown as ProductConfig;
    const qty = cfg.qtyTiers[cfg.qtyTiers.length - 1];
    let fromUnit: number | null = null;
    for (let i = 0; i < cfg.sizes.length; i++) for (const m of cfg.materials) {
      const fin = cfg.finishes.includes('none') ? 'none' : cfg.finishes.includes('cut') ? 'cut' : cfg.finishes[0];
      const r = price(p.model, cfg, { size: i, material: m, finish: fin, qty }, mats, ps);
      if (r.ok && (fromUnit === null || r.unit < fromUnit)) fromUnit = r.unit;
    }
    const firstMat = mats[cfg.materials[0]] || Object.values(mats).find((x) => x.code.startsWith(cfg.materials[0] + '-'));
    const s0 = cfg.sizes[Math.min(1, cfg.sizes.length - 1)];
    const { photos, ...rest } = p;
    return { ...rest, fromUnit, fromQty: qty, colour: firstMat?.colour || '#FFFFFF', w: s0.w, h: s0.h, d: s0.d, round: s0.round, image: productImage(p.slug, photos[0]?.id) };
  });
}
