import { db } from './db';
import { num, round2 } from './format';
import type { InvoiceLine } from './orders';

/** Outward supplies for a period, from issued invoices: totals by rate, B2B vs B2C, and an HSN summary (for GSTR-1). */
export async function gstSummary(start: Date, end: Date) {
  const invoices = await db.invoice.findMany({ where: { issuedAt: { gte: start, lt: end }, cancelled: false }, orderBy: { issuedAt: 'asc' } });
  const byRate = new Map<number, { rate: number; taxable: number; tax: number }>();
  const hsn = new Map<string, { hsn: string; rate: number; qty: number; taxable: number; tax: number }>();
  let b2b = 0, b2c = 0;
  for (const inv of invoices) {
    const lines = inv.lines as unknown as InvoiceLine[];
    const gross = lines.reduce((a, l) => a + l.amount, 0) || 1;
    const factor = num(inv.taxable) / gross;
    if (inv.billGstin) b2b += num(inv.taxable); else b2c += num(inv.taxable);
    for (const l of lines) {
      const t = l.amount * factor, tx = (t * l.gstRate) / 100;
      const r = byRate.get(l.gstRate) || { rate: l.gstRate, taxable: 0, tax: 0 };
      r.taxable += t; r.tax += tx; byRate.set(l.gstRate, r);
      const k = `${l.hsn}|${l.gstRate}`;
      const h = hsn.get(k) || { hsn: l.hsn, rate: l.gstRate, qty: 0, taxable: 0, tax: 0 };
      h.qty += l.qty; h.taxable += t; h.tax += tx; hsn.set(k, h);
    }
  }
  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'total') => round2(invoices.reduce((a, i) => a + num(i[k]), 0));
  const expenses = await db.expense.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amount: true, gst: true } });
  const pos = await db.purchaseOrder.aggregate({ where: { receivedAt: { gte: start, lt: end }, status: 'RECEIVED' }, _sum: { gst: true, total: true } });
  const outputTax = round2(sum('cgst') + sum('sgst') + sum('igst'));
  const inputTax = round2(num(expenses._sum.gst) + num(pos._sum.gst));
  return {
    invoices, taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'), total: sum('total'), b2b: round2(b2b), b2c: round2(b2c),
    byRate: [...byRate.values()].sort((a, b) => a.rate - b.rate), hsn: [...hsn.values()].sort((a, b) => a.hsn.localeCompare(b.hsn)),
    outputTax, inputTax, purchases: num(pos._sum.total), expenses: num(expenses._sum.amount),
  };
}
