import { z } from 'zod';
import { db } from './db';
import { materialsFor } from './catalog';
import { getPricing } from './settings';
import { price, type ProductConfig, type Spec } from './pricing';
import { round2 } from './format';
import type { NewItem } from './orders';

/** One line as sent by the Desk line builder. Product lines are re-priced here; the client figure is never trusted. */
export const LineIn = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('product'), productId: z.string().min(1),
    spec: z.object({
      size: z.union([z.number().int().min(0), z.literal('custom')]), w: z.number().optional(), h: z.number().optional(), d: z.number().optional(),
      material: z.string(), finish: z.string(), sides: z.union([z.literal(1), z.literal(2)]).optional(), extras: z.array(z.string()).optional(), qty: z.number().int().positive(),
    }),
    unitOverride: z.number().positive().nullable().optional(),
    note: z.string().max(500).optional(),
  }),
  z.object({
    kind: z.literal('custom'), name: z.string().trim().min(2, 'Name each custom item').max(120), summary: z.string().trim().max(300).default(''),
    hsn: z.string().trim().regex(/^\d{4,8}$/, 'HSN must be 4–8 digits'), gstRate: z.number().refine((n) => [0, 5, 12, 18, 28].includes(n), 'GST rate must be 0, 5, 12, 18 or 28'),
    qty: z.number().int().positive('Quantity must be above zero'), rate: z.number().positive('Rate must be above zero'), leadDays: z.number().int().min(0).max(60).default(2),
  }),
]);
export type LineIn = z.infer<typeof LineIn>;

export async function buildItems(lines: LineIn[]): Promise<{ items: NewItem[] } | { error: string }> {
  if (!lines.length) return { error: 'Add at least one item' };
  const ps = await getPricing();
  const items: NewItem[] = [];
  for (const [i, l] of lines.entries()) {
    if (l.kind === 'custom') {
      items.push({ name: l.name, summary: l.summary || l.name, qty: l.qty, unitPrice: l.rate, lineTotal: round2(l.qty * l.rate), hsn: l.hsn, gstRate: l.gstRate, leadDays: l.leadDays, estimate: { route: ['PREPRESS', 'PRINT', 'PACK'] } });
      continue;
    }
    const p = await db.product.findUnique({ where: { id: l.productId } });
    if (!p) return { error: `Item ${i + 1}: product not found` };
    const cfg = p.config as unknown as ProductConfig;
    const r = price(p.model, cfg, l.spec as Spec, await materialsFor(cfg), ps);
    if (!r.ok) return { error: `Item ${i + 1} (${p.name}): ${r.error}` };
    const unit = l.unitOverride ? l.unitOverride : r.unit;
    const total = l.unitOverride ? round2(unit * r.qty) : r.total;
    items.push({
      productId: p.id, name: p.name, summary: r.summary + (l.unitOverride ? ' · special rate' : '') + (l.note ? ` · ${l.note}` : ''), spec: l.spec,
      qty: r.qty, unitPrice: unit, lineTotal: total, hsn: p.hsn, gstRate: p.gstRate, leadDays: p.leadDays,
      estimate: { route: r.route, sheets: r.sheets, ups: r.ups, materials: r.materials, minutes: r.minutes, cut: cfg.cut },
    });
  }
  return { items };
}
