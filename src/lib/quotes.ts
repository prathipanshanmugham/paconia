import { db } from './db';
import { materialsFor } from './catalog';
import { getPricing } from './settings';
import { price, type ProductConfig, type Spec } from './pricing';
import { computeTax, SELLER_STATE_CODE } from './gst';
import { addDays, num, round2 } from './format';
import { logActivity } from './activity';
import type { Session } from './auth';

/** Marks every draft or sent quote past its validity date as expired. Cheap; called whenever quotes are read. */
export async function expireQuotes() {
  const now = new Date();
  const r = await db.quote.updateMany({ where: { status: { in: ['DRAFT', 'SENT'] }, validUntil: { lt: now }, orderId: null }, data: { status: 'EXPIRED', expiredAt: now } });
  return r.count;
}

/**
 * Renews a quote for `days` more days. Product lines are re-priced at today's rates and material costs unless the line
 * had a special rate, which is kept; costs and margins are recalculated either way.
 */
export async function renewQuote(id: string, days: number, s: Session | null) {
  const q = await db.quote.findUniqueOrThrow({ where: { id }, include: { lines: { include: { product: true } }, customer: true } });
  if (q.orderId) throw new Error('This quote is already an order');
  const ps = await getPricing();
  let changed = 0;
  for (const l of q.lines) {
    if (!l.product || !l.spec) continue;
    const cfg = l.product.config as unknown as ProductConfig;
    const r = price(l.product.model, cfg, l.spec as unknown as Spec, await materialsFor(cfg), ps);
    if (!r.ok) continue;
    const special = /special rate/.test(l.summary);
    const unit = special ? num(l.unitPrice) : r.unit;
    const total = special ? round2(unit * r.qty) : r.total;
    if (total !== num(l.lineTotal) || r.cost !== num(l.lineCost)) changed++;
    await db.quoteLine.update({ where: { id: l.id }, data: { unitPrice: unit, lineTotal: total, lineCost: r.cost } });
  }
  const lines = await db.quoteLine.findMany({ where: { quoteId: q.id } });
  const sub = round2(lines.reduce((a, l) => a + num(l.lineTotal), 0));
  const tax = computeTax(lines.map((l) => ({ amount: num(l.lineTotal), gstRate: l.gstRate })), 0, Math.min(num(q.discount), sub), q.customer.stateCode || SELLER_STATE_CODE);
  await db.quote.update({
    where: { id: q.id },
    data: { status: 'DRAFT', validUntil: addDays(new Date(), days), renewedAt: new Date(), expiredAt: null, subtotal: sub, taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total, cost: round2(lines.reduce((a, l) => a + num(l.lineCost), 0)) },
  });
  await logActivity(s, 'quote', q.id, 'renewed', `${days} days${changed ? ` · ${changed} line${changed > 1 ? 's' : ''} re-priced` : ''}`);
  return { changed };
}
