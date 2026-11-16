'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { LineIn, buildItems } from '@/lib/lines';
import { computeTax, SELLER_STATE_CODE, stateName } from '@/lib/gst';
import { createOrder, type NewItem } from '@/lib/orders';
import { materialsFor } from '@/lib/catalog';
import { getPricing, getShipping, shippingFor } from '@/lib/settings';
import { price, type ProductConfig, type Spec } from '@/lib/pricing';
import { nextQuoteNo } from '@/lib/numbering';
import { addDays, num, round2 } from '@/lib/format';
import { logActivity } from '@/lib/activity';
import { resolveCustomer } from '@/lib/customers';
import type { FormResult } from '@/components/FormMessage';
import type { Prisma } from '@/generated/prisma/client';

const QuotePayload = z.object({ customer: z.unknown(), lines: z.array(z.unknown()).min(1, 'Add at least one item'), discount: z.number().min(0), notes: z.string().max(2000).optional(), validDays: z.number().int().min(1).max(90), enquiryId: z.string().optional() });

export async function createQuote(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('quotes');
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get('payload'))); } catch { return { error: 'Could not read the form. Reload and try again.' }; }
  const p = QuotePayload.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const lines = z.array(LineIn).safeParse(p.data.lines);
  if (!lines.success) return { error: lines.error.issues[0].message };
  const cust = await resolveCustomer(p.data.customer);
  if ('error' in cust) return cust;
  const built = await buildItems(lines.data);
  if ('error' in built) return built;
  const c = await db.customer.findUniqueOrThrow({ where: { id: cust.id } });
  const sub = built.items.reduce((a, i) => a + i.lineTotal, 0);
  if (p.data.discount > sub) return { error: 'Discount cannot be more than the items total' };
  const tax = computeTax(built.items.map((i) => ({ amount: i.lineTotal, gstRate: i.gstRate })), 0, p.data.discount, c.stateCode || SELLER_STATE_CODE);
  const q = await db.quote.create({
    data: {
      number: await nextQuoteNo(), customerId: c.id, validUntil: addDays(new Date(), p.data.validDays), notes: p.data.notes || null,
      subtotal: round2(sub), discount: round2(p.data.discount), taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
      enquiryId: p.data.enquiryId || null, createdById: s.userId,
      lines: { create: built.items.map((i, k) => ({ productId: i.productId || null, name: i.name, summary: i.summary, spec: (i.spec ?? undefined) as Prisma.InputJsonValue | undefined, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal, hsn: i.hsn, gstRate: i.gstRate, sort: k })) },
    },
  });
  if (p.data.enquiryId) await db.enquiry.update({ where: { id: p.data.enquiryId }, data: { status: 'QUOTED', customerId: c.id } }).catch(() => null);
  await logActivity(s, 'quote', q.id, 'created', `${q.number} · ₹${tax.total}`);
  revalidatePath('/desk/quotes');
  redirect(`/desk/quotes/${q.number}?created=1`);
}

export async function setQuoteStatus(fd: FormData) {
  const s = await requireStaff('quotes');
  const q = await db.quote.findUniqueOrThrow({ where: { number: String(fd.get('number')) } });
  const status = String(fd.get('status')) as 'SENT' | 'DECLINED' | 'DRAFT';
  if (!['SENT', 'DECLINED', 'DRAFT'].includes(status) || q.status === 'ACCEPTED') redirect(`/desk/quotes/${q.number}`);
  await db.quote.update({ where: { id: q.id }, data: { status } });
  await logActivity(s, 'quote', q.id, 'status', status);
  revalidatePath('/desk/quotes');
  redirect(`/desk/quotes/${q.number}`);
}

/** Turns an accepted quote into an order at the quoted prices. */
export async function convertQuote(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('orders');
  const q = await db.quote.findUnique({ where: { number: String(fd.get('number')) }, include: { lines: { orderBy: { sort: 'asc' }, include: { product: true } }, customer: true } });
  if (!q) return { error: 'Quote not found' };
  if (q.orderId) return { error: 'This quote is already an order' };
  const fulfilment = fd.get('fulfilment') === 'COURIER' ? 'COURIER' : 'PICKUP';
  const terms = (['PREPAID', 'PAY_ON_PICKUP', 'CREDIT'] as const).find((t) => t === fd.get('terms')) || 'PAY_ON_PICKUP';
  const c = q.customer;
  if (fulfilment === 'COURIER' && !(c.line1 && c.pincode)) return { error: 'Add the customer’s address on their customer page first, or choose pickup' };
  const ps = await getPricing();
  const items: NewItem[] = [];
  for (const l of q.lines) {
    let estimate: NewItem['estimate'] = { route: ['PREPRESS', 'PRINT', 'PACK'] };
    if (l.product && l.spec) {
      const cfg = l.product.config as unknown as ProductConfig;
      const r = price(l.product.model, cfg, l.spec as unknown as Spec, await materialsFor(cfg), ps);
      if (r.ok) estimate = { route: r.route, sheets: r.sheets, ups: r.ups, materials: r.materials, minutes: r.minutes, cut: cfg.cut };
    }
    items.push({ productId: l.productId, name: l.name, summary: l.summary, spec: l.spec, qty: l.qty, unitPrice: num(l.unitPrice), lineTotal: num(l.lineTotal), hsn: l.hsn, gstRate: l.gstRate, leadDays: l.product?.leadDays || 3, estimate });
  }
  const stateCode = c.stateCode || SELLER_STATE_CODE;
  const shipping = shippingFor(await getShipping(), num(q.subtotal), stateCode, fulfilment);
  const order = await createOrder({
    customerId: c.id, channel: c.creditDays > 0 || c.gstin ? 'B2B' : 'COUNTER', items, fulfilment, terms,
    ship: fulfilment === 'COURIER' ? { name: c.company || c.name, phone: c.phone, line1: c.line1!, line2: c.line2, city: c.city || '', pincode: c.pincode!, stateCode, state: stateName(stateCode) } : null,
    shipping, discount: num(q.discount), notes: q.notes, skipProof: fd.get('skipProof') === 'on', quoteId: q.id,
  }, s);
  revalidatePath('/desk', 'layout');
  redirect(`/desk/orders/${order.number}?created=1`);
}

export async function setEnquiryStatus(fd: FormData) {
  await requireStaff('quotes');
  const status = String(fd.get('status')) as 'NEW' | 'CONTACTED' | 'QUOTED' | 'CLOSED';
  if (!['NEW', 'CONTACTED', 'QUOTED', 'CLOSED'].includes(status)) return;
  await db.enquiry.update({ where: { id: String(fd.get('id')) }, data: { status } });
  revalidatePath('/desk', 'layout');
  redirect('/desk/quotes?tab=enquiries');
}
