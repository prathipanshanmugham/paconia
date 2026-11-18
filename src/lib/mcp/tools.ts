/**
 * Tools that AI agents (Claude over MCP) and scripts (REST) can call. Each call runs as the team member the API key
 * belongs to: their role decides what they may touch, write tools need a read-and-write key, and every change is
 * written to the activity log with the key's name.
 */
import { z } from 'zod';
import { db } from '../db';
import { can, seesCost, type Area, type Role, type Session } from '../auth';
import { LineIn, buildItems } from '../lines';
import { ORDER_STATUS_LABEL, STAGE_LABEL, advanceJob, createOrder, ensureInvoice, issueMaterials, recordPayment, setOrderStatus, startProduction, type NewItem } from '../orders';
import { resolveCustomer } from '../customers';
import { expireQuotes, renewQuote } from '../quotes';
import { FINISH_LABEL, margin, price, priceForMargin, type ProductConfig, type Spec } from '../pricing';
import { FAMILIES, materialsFor } from '../catalog';
import { getPricing, getShipping, shippingFor } from '../settings';
import { SELLER_STATE_CODE, computeTax, stateName } from '../gst';
import { nextQuoteNo } from '../numbering';
import { addDays, isoDate, num, round2 } from '../format';
import { monthRange } from '../period';
import { gstSummary } from '../gstReport';
import { logActivity } from '../activity';
import type { OrderStatus, PayMethod, Prisma } from '@/generated/prisma/client';

export type Ctx = { s: Session; write: boolean; keyName: string };
type Tool = { name: string; title: string; description: string; area: Area; write?: boolean; input: z.ZodTypeAny; run: (a: any, c: Ctx) => Promise<unknown> };

export class ToolError extends Error {}
const fail = (m: string): never => { throw new ToolError(m); };
const money = (v: unknown) => round2(num(v));
const lim = z.number().int().min(1).max(200).default(25);

/* ---------- helpers that turn friendly agent input into the app's own shapes ---------- */

const AgentLine = z.union([
  z.object({
    product: z.string().describe('Product slug or name, e.g. "product-labels"'),
    size: z.union([z.number().int(), z.string()]).optional().describe('Size label (e.g. "Round 50 mm"), its index, or "custom"'),
    width: z.number().optional(), height: z.number().optional(), depth: z.number().optional(),
    material: z.string().optional().describe('Material code or name; defaults to the first'),
    finish: z.string().optional().describe('Finish code or label, e.g. "gloss"; defaults to the first'),
    qty: z.number().int().positive(),
    sides: z.union([z.literal(1), z.literal(2)]).optional(),
    extras: z.array(z.string()).optional().describe('Add-on codes, e.g. ["STRING"]'),
    rate: z.number().positive().optional().describe('Special rate per piece (₹), overriding the list price'),
    margin_pct: z.number().min(0).max(90).optional().describe('Price the line to give this margin % instead of the list price'),
    note: z.string().max(300).optional(),
  }),
  z.object({
    custom: z.literal(true), name: z.string().min(2), details: z.string().optional(), hsn: z.string().regex(/^\d{4,8}$/), gst_rate: z.number(),
    qty: z.number().int().positive(), rate: z.number().positive(), cost: z.number().min(0).optional(),
  }),
]);

async function toLineIn(l: z.infer<typeof AgentLine>): Promise<LineIn> {
  if ('custom' in l) return { kind: 'custom', name: l.name, summary: l.details || '', hsn: l.hsn, gstRate: l.gst_rate, qty: l.qty, rate: l.rate, cost: l.cost || 0, leadDays: 2 };
  const key = l.product.trim().toLowerCase();
  const products = await db.product.findMany({ where: { active: true } });
  const p = products.find((x) => x.slug === key) || products.find((x) => x.name.toLowerCase() === key) || products.find((x) => x.name.toLowerCase().includes(key));
  if (!p) fail(`No product matches "${l.product}". Call list_products for the slugs.`);
  const cfg = p!.config as unknown as ProductConfig;
  let size: number | 'custom' = 0;
  if (l.size === 'custom' || (l.width && l.height && l.size === undefined)) size = 'custom';
  else if (typeof l.size === 'number') size = l.size;
  else if (typeof l.size === 'string') {
    const i = cfg.sizes.findIndex((s) => s.label.toLowerCase() === l.size!.toString().toLowerCase() || s.label.toLowerCase().includes(l.size!.toString().toLowerCase()));
    if (i < 0) fail(`"${l.size}" is not a size of ${p!.name}. Sizes: ${cfg.sizes.map((s) => s.label).join(', ')}`);
    size = i;
  }
  const mats = await materialsFor(cfg);
  const mq = (l.material || '').toLowerCase();
  const material = !mq ? cfg.materials[0] : cfg.materials.find((c) => c.toLowerCase() === mq) || cfg.materials.find((c) => (mats[c]?.name || Object.values(mats).find((m) => m.code.startsWith(c + '-'))?.name || '').toLowerCase().includes(mq));
  if (!material) fail(`"${l.material}" is not a material of ${p!.name}. Materials: ${cfg.materials.join(', ')}`);
  const fq = (l.finish || '').toLowerCase();
  const finish = !fq ? cfg.finishes[0] : cfg.finishes.find((f) => f === fq || (FINISH_LABEL[f] || '').toLowerCase().includes(fq));
  if (!finish) fail(`"${l.finish}" is not a finish of ${p!.name}. Finishes: ${cfg.finishes.join(', ')}`);
  const spec: Spec = { size, material: material!, finish: finish!, qty: l.qty, sides: l.sides || 1, extras: l.extras || [], ...(size === 'custom' ? { w: l.width, h: l.height, d: l.depth } : {}) };
  let unitOverride: number | null = l.rate || null;
  if (l.margin_pct !== undefined) {
    const r = price(p!.model, cfg, spec, mats, await getPricing());
    if (!r.ok) fail(`${p!.name}: ${r.error}`);
    if (r.ok) unitOverride = priceForMargin(r.cost, r.qty, l.margin_pct);
  }
  return { kind: 'product', productId: p!.id, spec: spec as Extract<LineIn, { kind: 'product' }>['spec'], unitOverride, note: l.note };
}

async function itemsFrom(lines: z.infer<typeof AgentLine>[]): Promise<NewItem[]> {
  const ins: LineIn[] = [];
  for (const l of lines) ins.push(await toLineIn(l));
  const parsed = z.array(LineIn).safeParse(ins);
  if (!parsed.success) fail(parsed.error.issues[0].message);
  const built = await buildItems(parsed.success ? parsed.data : []);
  if ('error' in built) fail(built.error);
  return (built as { items: NewItem[] }).items;
}

const CustomerRef = z.object({
  customer_code: z.string().optional().describe('Existing customer code, e.g. C-0007'),
  new_customer: z.object({ name: z.string(), phone: z.string(), company: z.string().optional(), email: z.string().optional(), gstin: z.string().optional(), line1: z.string().optional(), city: z.string().optional(), pincode: z.string().optional() }).optional(),
});
async function customerId(a: z.infer<typeof CustomerRef>) {
  if (a.customer_code) {
    const c = await db.customer.findUnique({ where: { code: a.customer_code.toUpperCase() } });
    return c ? c.id : fail(`No customer ${a.customer_code}`);
  }
  if (a.new_customer) { const r = await resolveCustomer({ new: a.new_customer }); return 'error' in r ? fail(r.error) : r.id; }
  return fail('Give customer_code or new_customer');
}

const orderOut = (o: Prisma.OrderGetPayload<{ include: { customer: true; items: { include: { job: true } } } }>) => ({
  number: o.number, status: ORDER_STATUS_LABEL[o.status], channel: o.channel, placed: isoDate(o.placedAt), due: o.dueDate ? isoDate(o.dueDate) : null,
  customer: { code: o.customer.code, name: o.customer.company || o.customer.name, phone: o.customer.phone },
  items: o.items.map((i) => ({ name: i.name, summary: i.summary, qty: i.qty, unit_price: num(i.unitPrice), total: money(i.lineTotal), cost: money(i.lineCost), job: i.job ? { number: i.job.number, stage: STAGE_LABEL[i.job.stage] } : null })),
  subtotal: money(o.subtotal), discount: money(o.discount), shipping: money(o.shipping), gst: money(num(o.cgst) + num(o.sgst) + num(o.igst)), total: money(o.total),
  paid: money(o.amountPaid), balance: round2(num(o.total) - num(o.amountPaid)), payment: o.paymentStatus, terms: o.terms, fulfilment: o.fulfilment,
  margin: margin(num(o.subtotal) - num(o.discount), num(o.cost)), courier: o.courier, awb: o.awb, notes: o.notes,
});
const orderInclude = { customer: true, items: { include: { job: true } } } as const;

/* ---------- the tools ---------- */

export const TOOLS: Tool[] = [
  {
    name: 'whoami', title: 'Who am I', area: 'today', input: z.object({}),
    description: 'The team member this key acts as, their role and whether the key can make changes.',
    run: async (_a, c) => ({ name: c.s.name, role: c.s.role, access: c.write ? 'read and write' : 'read only', key: c.keyName }),
  },
  {
    name: 'business_overview', title: 'Today at Paconia', area: 'today', input: z.object({}),
    description: 'What needs attention now: proofs to send, jobs on each production stage, orders ready to hand over, money to collect, new enquiries, quotes about to expire and low stock.',
    run: async (_a, c) => {
      await expireQuotes();
      const [proofs, waiting, ready, jobs, open, enquiries, expiring, mats] = await Promise.all([
        db.order.findMany({ where: { status: { in: ['PLACED', 'CHANGES_REQUESTED'] } }, select: { number: true, status: true } }),
        db.order.count({ where: { status: 'PROOF_SENT' } }),
        db.order.findMany({ where: { status: 'READY' }, select: { number: true, fulfilment: true } }),
        db.job.groupBy({ by: ['stage'], where: { stage: { notIn: ['DONE'] }, orderItem: { order: { status: { notIn: ['CANCELLED'] } } } }, _count: true }),
        db.order.findMany({ where: { status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } }, select: { total: true, amountPaid: true } }),
        db.enquiry.count({ where: { status: 'NEW' } }),
        db.quote.findMany({ where: { status: { in: ['DRAFT', 'SENT'] }, validUntil: { lt: addDays(new Date(), 3) } }, select: { number: true, validUntil: true } }),
        db.material.findMany({ where: { active: true }, select: { code: true, name: true, onHand: true, reorderLevel: true, uom: true } }),
      ]);
      return {
        proofs_to_send: proofs.map((o) => `${o.number} (${ORDER_STATUS_LABEL[o.status]})`), waiting_for_customer_approval: waiting,
        jobs_by_stage: Object.fromEntries(jobs.map((j) => [STAGE_LABEL[j.stage], j._count])),
        ready_to_hand_over: ready.map((o) => `${o.number} (${o.fulfilment === 'PICKUP' ? 'pickup' : 'courier'})`),
        ...(can(c.s.role, 'accounts') ? { money_to_collect: round2(open.reduce((a, o) => a + Math.max(0, num(o.total) - num(o.amountPaid)), 0)) } : {}),
        new_enquiries: enquiries, quotes_expiring_within_3_days: expiring.map((q) => `${q.number} on ${isoDate(q.validUntil)}`),
        low_stock: mats.filter((m) => num(m.onHand) <= num(m.reorderLevel)).map((m) => `${m.name}: ${num(m.onHand)} ${m.uom}`),
      };
    },
  },
  {
    name: 'list_products', title: 'Products and options', area: 'today', input: z.object({ family: z.enum(['LABELS', 'PACKAGING', 'POUCHES', 'CARDS', 'LASER']).optional() }),
    description: 'Every product with its sizes, material codes, finishes, add-ons, quantity steps, HSN and GST. Use these values in price_product, create_quote and create_order.',
    run: async (a) => {
      const ps = await db.product.findMany({ where: { active: true, ...(a.family ? { family: a.family } : {}) }, orderBy: [{ family: 'asc' }, { sort: 'asc' }] });
      return Promise.all(ps.map(async (p) => {
        const cfg = p.config as unknown as ProductConfig;
        const mats = await materialsFor(cfg);
        return {
          slug: p.slug, name: p.name, family: FAMILIES.find((f) => f.key === p.family)?.name, hsn: p.hsn, gst_rate: p.gstRate, lead_days: p.leadDays,
          sizes: cfg.sizes.map((s, i) => ({ index: i, label: s.label })), custom_size: cfg.custom || null,
          materials: cfg.materials.map((m) => ({ code: m, name: mats[m]?.name || Object.values(mats).find((x) => x.code.startsWith(m + '-'))?.name || m })),
          finishes: cfg.finishes.map((f) => ({ code: f, label: FINISH_LABEL[f] || f })), two_sided: !!cfg.sides,
          extras: (cfg.extras || []).map((e) => ({ code: e.code, label: e.label, price: e.price, per: e.per })), quantity_steps: cfg.qtyTiers, minimum_qty: cfg.minQty,
        };
      }));
    },
  },
  {
    name: 'price_product', title: 'Price a product', area: 'tools', input: AgentLine,
    description: 'Exact price for one product spec, with the studio cost, margin, sheet layout and how the price is built. Nothing is saved.',
    run: async (a) => {
      const [l] = [await toLineIn(a)];
      if (l.kind !== 'product') return fail('price_product needs a product, not a custom line');
      const p = await db.product.findUniqueOrThrow({ where: { id: l.productId } });
      const cfg = p.config as unknown as ProductConfig;
      const r = price(p.model, cfg, l.spec as Spec, await materialsFor(cfg), await getPricing());
      if (!r.ok) return fail(r.error);
      const unit = l.unitOverride || r.unit, total = l.unitOverride ? round2(l.unitOverride * r.qty) : r.total;
      return { product: p.name, summary: r.summary, qty: r.qty, list_unit_price: r.unit, unit_price: unit, total_before_gst: total, gst_rate: p.gstRate, total_with_gst: round2(total * (1 + p.gstRate / 100)), cost: r.cost, margin: margin(total, r.cost), per_sheet: r.ups, sheets: r.sheets, laser_minutes: r.minutes, white_ink: r.white, price_breakdown: r.breakdown, cost_breakdown: r.costLines, route: r.route.map((s) => STAGE_LABEL[s]) };
    },
  },
  {
    name: 'search_orders', title: 'Find orders', area: 'orders',
    input: z.object({ query: z.string().optional().describe('Order number, customer name, phone or product'), status: z.enum(['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED', 'CANCELLED']).optional(), unpaid_only: z.boolean().optional(), limit: lim }),
    description: 'Orders, newest first, with status, customer, totals and balance.',
    run: async (a) => {
      const q = a.query?.trim();
      const rows = await db.order.findMany({
        where: { ...(a.status ? { status: a.status as OrderStatus } : {}), ...(a.unpaid_only ? { paymentStatus: { not: 'PAID' }, status: { not: 'CANCELLED' } } : {}), ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }, { customer: { company: { contains: q, mode: 'insensitive' } } }, { customer: { phone: { contains: q } } }, { items: { some: { name: { contains: q, mode: 'insensitive' } } } }] } : {}) },
        orderBy: { placedAt: 'desc' }, take: a.limit, include: { customer: true },
      });
      return rows.map((o) => ({ number: o.number, placed: isoDate(o.placedAt), status: ORDER_STATUS_LABEL[o.status], customer: o.customer.company || o.customer.name, total: money(o.total), balance: round2(num(o.total) - num(o.amountPaid)), due: o.dueDate ? isoDate(o.dueDate) : null }));
    },
  },
  {
    name: 'get_order', title: 'Open an order', area: 'orders', input: z.object({ number: z.string() }),
    description: 'Full detail of one order: items, jobs and their stage, money, margin, delivery and notes.',
    run: async (a) => { const o = await db.order.findUnique({ where: { number: a.number.toUpperCase() }, include: orderInclude }); return o ? orderOut(o) : fail(`No order ${a.number}`); },
  },
  {
    name: 'search_quotes', title: 'Find quotes', area: 'quotes', input: z.object({ query: z.string().optional(), status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(), limit: lim }),
    description: 'Quotes, newest first, with status, validity and margin. Quotes past their validity are expired automatically.',
    run: async (a) => {
      await expireQuotes();
      const q = a.query?.trim();
      const rows = await db.quote.findMany({ where: { ...(a.status ? { status: a.status } : {}), ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }, { customer: { company: { contains: q, mode: 'insensitive' } } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: a.limit, include: { customer: true } });
      return rows.map((x) => ({ number: x.number, status: x.status, customer: x.customer.company || x.customer.name, valid_until: isoDate(x.validUntil), total: money(x.total), margin: margin(num(x.subtotal) - num(x.discount), num(x.cost)) }));
    },
  },
  {
    name: 'get_quote', title: 'Open a quote', area: 'quotes', input: z.object({ number: z.string() }),
    description: 'One quote with its lines, cost and margin per line, validity and status.',
    run: async (a) => {
      await expireQuotes();
      const q = await db.quote.findUnique({ where: { number: a.number.toUpperCase() }, include: { customer: true, lines: { orderBy: { sort: 'asc' } }, order: true } });
      if (!q) return fail(`No quote ${a.number}`);
      return { number: q.number, status: q.status, customer: { code: q.customer.code, name: q.customer.company || q.customer.name }, valid_until: isoDate(q.validUntil), order: q.order?.number || null, lines: q.lines.map((l) => ({ name: l.name, summary: l.summary, qty: l.qty, unit_price: num(l.unitPrice), total: money(l.lineTotal), cost: money(l.lineCost), margin: margin(num(l.lineTotal), num(l.lineCost)) })), subtotal: money(q.subtotal), discount: money(q.discount), total_with_gst: money(q.total), cost: money(q.cost), margin: margin(num(q.subtotal) - num(q.discount), num(q.cost)), notes: q.notes };
    },
  },
  {
    name: 'search_customers', title: 'Find customers', area: 'customers', input: z.object({ query: z.string().optional(), limit: lim }),
    description: 'Customers by name, business, phone, GSTIN or code, with what they owe.',
    run: async (a) => {
      const q = a.query?.trim();
      const rows = await db.customer.findMany({ where: q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { code: { contains: q, mode: 'insensitive' } }, { gstin: { contains: q, mode: 'insensitive' } }] } : {}, take: a.limit, orderBy: { createdAt: 'desc' }, include: { orders: { where: { status: { not: 'CANCELLED' } }, select: { total: true, amountPaid: true } } } });
      return rows.map((c) => ({ code: c.code, name: c.name, company: c.company, phone: c.phone, email: c.email, gstin: c.gstin, city: c.city, credit_days: c.creditDays, orders: c.orders.length, balance: round2(c.orders.reduce((s, o) => s + Math.max(0, num(o.total) - num(o.amountPaid)), 0)) }));
    },
  },
  {
    name: 'stock_levels', title: 'Stock levels', area: 'stock', input: z.object({ low_only: z.boolean().optional(), category: z.enum(['MEDIA', 'BLANK', 'LASER', 'TONER', 'FILM', 'CONSUMABLE', 'PACKING']).optional() }),
    description: 'Materials on hand with reorder level, cost and price.',
    run: async (a) => {
      const rows = await db.material.findMany({ where: { active: true, ...(a.category ? { category: a.category } : {}) }, orderBy: { name: 'asc' } });
      return rows.filter((m) => !a.low_only || num(m.onHand) <= num(m.reorderLevel)).map((m) => ({ code: m.code, name: m.name, category: m.category, on_hand: num(m.onHand), uom: m.uom, reorder_level: num(m.reorderLevel), reorder_qty: num(m.reorderQty), cost: num(m.cost), price: num(m.price), low: num(m.onHand) <= num(m.reorderLevel) }));
    },
  },
  {
    name: 'production_board', title: 'Production board', area: 'production', input: z.object({}),
    description: 'Every open job by stage, with machine, due date, rush flag and whether materials are issued.',
    run: async () => {
      const jobs = await db.job.findMany({ where: { stage: { not: 'DONE' }, orderItem: { order: { status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPATCHED'] } } } }, include: { machine: true, orderItem: { include: { order: { include: { customer: true } } } } }, orderBy: [{ rush: 'desc' }, { dueDate: 'asc' }] });
      return jobs.map((j) => ({ job: j.number, order: j.orderItem.order.number, order_status: ORDER_STATUS_LABEL[j.orderItem.order.status], stage: STAGE_LABEL[j.stage], item: `${j.orderItem.name} × ${j.orderItem.qty}`, customer: j.orderItem.order.customer.company || j.orderItem.order.customer.name, machine: j.machine?.name || null, due: j.dueDate ? isoDate(j.dueDate) : null, late: !!j.dueDate && j.dueDate < new Date(), rush: j.rush, sheets: j.sheets, materials_issued: j.materialsIssued }));
    },
  },
  {
    name: 'run_report', title: 'Run a report', area: 'accounts',
    input: z.object({ report: z.enum(['sales', 'margins', 'receivables', 'gst', 'expenses']), month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('YYYY-MM, India time; defaults to this month') }),
    description: 'Monthly sales by channel, margins by product, money to collect, GST summary (by rate and HSN) or expenses by category.',
    run: async (a) => {
      const p = monthRange(a.month);
      if (a.report === 'receivables') {
        const os = await db.order.findMany({ where: { status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } }, include: { customer: true } });
        return os.map((o) => ({ order: o.number, customer: o.customer.company || o.customer.name, phone: o.customer.phone, terms: o.terms, due: o.dueDate ? isoDate(o.dueDate) : null, balance: round2(num(o.total) - num(o.amountPaid)) })).filter((r) => r.balance > 0.5);
      }
      if (a.report === 'gst') { const g = await gstSummary(p.start, p.end); return { month: p.label, invoices: g.invoices.length, taxable: g.taxable, cgst: g.cgst, sgst: g.sgst, igst: g.igst, b2b: g.b2b, b2c: g.b2c, by_rate: g.byRate, hsn: g.hsn, output_tax: g.outputTax, input_tax: g.inputTax }; }
      if (a.report === 'expenses') { const ex = await db.expense.findMany({ where: { date: { gte: p.start, lt: p.end } } }); const by: Record<string, number> = {}; for (const e of ex) by[e.category] = round2((by[e.category] || 0) + num(e.amount)); return { month: p.label, total: round2(ex.reduce((s, e) => s + num(e.amount), 0)), by_category: by }; }
      const orders = await db.order.findMany({ where: { placedAt: { gte: p.start, lt: p.end }, status: { not: 'CANCELLED' } }, include: { items: true } });
      if (a.report === 'sales') {
        const by: Record<string, { orders: number; value: number }> = {};
        for (const o of orders) { const k = o.channel; by[k] = by[k] || { orders: 0, value: 0 }; by[k].orders++; by[k].value = round2(by[k].value + num(o.taxable)); }
        return { month: p.label, orders: orders.length, value_before_gst: round2(orders.reduce((s, o) => s + num(o.taxable), 0)), by_channel: by };
      }
      const costed = orders.filter((o) => num(o.cost) > 0);
      const by: Record<string, { sales: number; cost: number }> = {};
      for (const o of costed) for (const i of o.items) { if (!num(i.lineCost)) continue; by[i.name] = by[i.name] || { sales: 0, cost: 0 }; by[i.name].sales = round2(by[i.name].sales + num(i.lineTotal)); by[i.name].cost = round2(by[i.name].cost + num(i.lineCost)); }
      const sales = round2(costed.reduce((s, o) => s + num(o.subtotal) - num(o.discount), 0)), cost = round2(costed.reduce((s, o) => s + num(o.cost), 0));
      return { month: p.label, orders_with_costs: costed.length, orders_without_costs: orders.length - costed.length, sales, cost, margin: margin(sales, cost), by_product: Object.entries(by).map(([k, v]) => ({ product: k, ...v, margin: margin(v.sales, v.cost) })).sort((x, y) => y.sales - x.sales) };
    },
  },
  {
    name: 'list_enquiries', title: 'Website enquiries', area: 'quotes', input: z.object({ status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'CLOSED']).optional(), limit: lim }),
    description: 'Bulk-quote enquiries sent from the website.',
    run: async (a) => (await db.enquiry.findMany({ where: a.status ? { status: a.status } : {}, orderBy: { createdAt: 'desc' }, take: a.limit })).map((e) => ({ id: e.id, status: e.status, received: isoDate(e.createdAt), name: e.name, company: e.company, phone: e.phone, email: e.email, product: e.product, qty: e.qty, details: e.details })),
  },

  /* ----- changes (need a read-and-write key) ----- */
  {
    name: 'create_customer', title: 'Add a customer', area: 'customers', write: true,
    input: z.object({ name: z.string(), phone: z.string(), company: z.string().optional(), email: z.string().optional(), gstin: z.string().optional(), line1: z.string().optional(), city: z.string().optional(), pincode: z.string().optional() }),
    description: 'Adds a customer. If the mobile number already exists, returns that customer instead of making a duplicate.',
    run: async (a, c) => { const r = await resolveCustomer({ new: a }); if ('error' in r) return fail(r.error); const cu = await db.customer.findUniqueOrThrow({ where: { id: r.id } }); await logActivity(c.s, 'customer', cu.id, 'saved', `via ${c.keyName}`); return { code: cu.code, name: cu.name, company: cu.company }; },
  },
  {
    name: 'create_quote', title: 'Make a quote', area: 'quotes', write: true,
    input: CustomerRef.extend({ lines: z.array(AgentLine).min(1), discount: z.number().min(0).optional(), valid_days: z.number().int().min(1).max(90).optional(), notes: z.string().max(2000).optional() }),
    description: 'Creates a draft quote priced by the pricing engine. Each line can take a special rate or a target margin_pct. The quote expires on its own after valid_days (default 15).',
    run: async (a, c) => {
      const cid = await customerId(a);
      const items = await itemsFrom(a.lines);
      const cu = await db.customer.findUniqueOrThrow({ where: { id: cid } });
      const sub = round2(items.reduce((s, i) => s + i.lineTotal, 0)), disc = Math.min(a.discount || 0, sub);
      const tax = computeTax(items.map((i) => ({ amount: i.lineTotal, gstRate: i.gstRate })), 0, disc, cu.stateCode || SELLER_STATE_CODE);
      const q = await db.quote.create({ data: {
        number: await nextQuoteNo(), customerId: cid, validUntil: addDays(new Date(), a.valid_days || 15), notes: a.notes || null, subtotal: sub, discount: disc, taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
        cost: round2(items.reduce((s, i) => s + (i.lineCost || 0), 0)), createdById: c.s.userId,
        lines: { create: items.map((i, k) => ({ productId: i.productId || null, name: i.name, summary: i.summary, spec: (i.spec ?? undefined) as Prisma.InputJsonValue | undefined, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal, lineCost: i.lineCost || 0, hsn: i.hsn, gstRate: i.gstRate, sort: k })) },
      } });
      await logActivity(c.s, 'quote', q.id, 'created', `${q.number} via ${c.keyName}`);
      return { number: q.number, total_with_gst: money(q.total), valid_until: isoDate(q.validUntil), margin: margin(sub - disc, num(q.cost)) };
    },
  },
  {
    name: 'renew_quote', title: 'Renew a quote', area: 'quotes', write: true, input: z.object({ number: z.string(), valid_days: z.number().int().min(1).max(90).default(15) }),
    description: 'Re-prices an expired or ageing quote at today’s rates (special rates are kept) and extends its validity.',
    run: async (a, c) => { const q = await db.quote.findUnique({ where: { number: a.number.toUpperCase() } }); if (!q) return fail(`No quote ${a.number}`); const r = await renewQuote(q.id, a.valid_days, c.s); return { number: q.number, lines_repriced: r.changed, valid_until: isoDate(addDays(new Date(), a.valid_days)) }; },
  },
  {
    name: 'set_quote_status', title: 'Mark a quote sent or declined', area: 'quotes', write: true, input: z.object({ number: z.string(), status: z.enum(['SENT', 'DECLINED']) }),
    description: 'Records that a quote was sent to the customer, or that they declined it.',
    run: async (a, c) => { const q = await db.quote.findUnique({ where: { number: a.number.toUpperCase() } }); if (!q) return fail(`No quote ${a.number}`); if (q.status === 'ACCEPTED' || q.status === 'EXPIRED') return fail(`Quote is ${q.status.toLowerCase()}`); await db.quote.update({ where: { id: q.id }, data: { status: a.status } }); await logActivity(c.s, 'quote', q.id, 'status', `${a.status} via ${c.keyName}`); return { number: q.number, status: a.status }; },
  },
  {
    name: 'convert_quote_to_order', title: 'Turn a quote into an order', area: 'orders', write: true,
    input: z.object({ number: z.string(), fulfilment: z.enum(['PICKUP', 'COURIER']).default('PICKUP'), terms: z.enum(['PREPAID', 'PAY_ON_PICKUP', 'CREDIT']).default('PAY_ON_PICKUP'), artwork_approved: z.boolean().default(false).describe('True starts production straight away; false waits for a proof') }),
    description: 'Creates the order at the quoted prices. Expired quotes must be renewed first.',
    run: async (a, c) => {
      await expireQuotes();
      const q = await db.quote.findUnique({ where: { number: a.number.toUpperCase() }, include: { lines: { orderBy: { sort: 'asc' }, include: { product: true } }, customer: true } });
      if (!q) return fail(`No quote ${a.number}`);
      if (q.orderId) return fail('Already an order');
      if (q.status === 'EXPIRED' || q.status === 'DECLINED') return fail(`Quote is ${q.status.toLowerCase()}; renew it first`);
      const cu = q.customer;
      if (a.fulfilment === 'COURIER' && !(cu.line1 && cu.pincode)) return fail('Customer has no address on file; use PICKUP or add the address');
      const ps = await getPricing();
      const items: NewItem[] = [];
      for (const l of q.lines) {
        let estimate: NewItem['estimate'] = { route: ['PREPRESS', 'PRINT', 'PACK'] };
        if (l.product && l.spec) { const cfg = l.product.config as unknown as ProductConfig; const r = price(l.product.model, cfg, l.spec as unknown as Spec, await materialsFor(cfg), ps); if (r.ok) estimate = { route: r.route, sheets: r.sheets, ups: r.ups, materials: r.materials, minutes: r.minutes, cut: cfg.cut }; }
        items.push({ productId: l.productId, name: l.name, summary: l.summary, spec: l.spec, qty: l.qty, unitPrice: num(l.unitPrice), lineTotal: num(l.lineTotal), lineCost: num(l.lineCost), hsn: l.hsn, gstRate: l.gstRate, leadDays: l.product?.leadDays || 3, estimate });
      }
      const sc = cu.stateCode || SELLER_STATE_CODE;
      const o = await createOrder({ customerId: cu.id, channel: cu.creditDays > 0 || cu.gstin ? 'B2B' : 'COUNTER', items, fulfilment: a.fulfilment, terms: a.terms, ship: a.fulfilment === 'COURIER' ? { name: cu.company || cu.name, phone: cu.phone, line1: cu.line1!, line2: cu.line2, city: cu.city || '', pincode: cu.pincode!, stateCode: sc, state: stateName(sc) } : null, shipping: shippingFor(await getShipping(), num(q.subtotal), sc, a.fulfilment), discount: num(q.discount), notes: q.notes, skipProof: a.artwork_approved, quoteId: q.id }, c.s);
      return { order: o.number, total_with_gst: money(o.total) };
    },
  },
  {
    name: 'create_order', title: 'Book an order', area: 'orders', write: true,
    input: CustomerRef.extend({ lines: z.array(AgentLine).min(1), fulfilment: z.enum(['PICKUP', 'COURIER']).default('PICKUP'), terms: z.enum(['PREPAID', 'PAY_ON_PICKUP', 'CREDIT']).default('PAY_ON_PICKUP'), discount: z.number().min(0).optional(), artwork_approved: z.boolean().default(false), rush: z.boolean().default(false), notes: z.string().max(2000).optional() }),
    description: 'Books a walk-in or B2B order at engine prices (or special rates). Courier orders ship to the customer’s saved address.',
    run: async (a, c) => {
      const cid = await customerId(a);
      const items = await itemsFrom(a.lines);
      const cu = await db.customer.findUniqueOrThrow({ where: { id: cid } });
      if (a.fulfilment === 'COURIER' && !(cu.line1 && cu.pincode)) return fail('Customer has no address on file; use PICKUP or add the address');
      const sub = round2(items.reduce((s, i) => s + i.lineTotal, 0));
      const sc = cu.stateCode || SELLER_STATE_CODE;
      const o = await createOrder({ customerId: cid, channel: cu.creditDays > 0 || cu.gstin ? 'B2B' : 'COUNTER', items, fulfilment: a.fulfilment, terms: a.terms, ship: a.fulfilment === 'COURIER' ? { name: cu.company || cu.name, phone: cu.phone, line1: cu.line1!, line2: cu.line2, city: cu.city || '', pincode: cu.pincode!, stateCode: sc, state: stateName(sc) } : null, shipping: shippingFor(await getShipping(), sub, sc, a.fulfilment), discount: Math.min(a.discount || 0, sub), notes: a.notes || null, skipProof: a.artwork_approved, rush: a.rush }, c.s);
      return { order: o.number, total_with_gst: money(o.total), status: ORDER_STATUS_LABEL[o.status] };
    },
  },
  {
    name: 'record_payment', title: 'Record a payment', area: 'orders', write: true,
    input: z.object({ order: z.string(), amount: z.number().positive(), method: z.enum(['CASH', 'UPI', 'CARD', 'BANK', 'CHEQUE']), reference: z.string().max(80).optional() }),
    description: 'Records money received against an order (not online payments; those arrive by themselves).',
    run: async (a, c) => {
      const o = await db.order.findUnique({ where: { number: a.order.toUpperCase() } });
      if (!o) return fail(`No order ${a.order}`);
      const due = round2(num(o.total) - num(o.amountPaid));
      if (a.amount > due + 0.5) return fail(`Balance is only ₹${due}`);
      await recordPayment(o.id, round2(a.amount), a.method as PayMethod, c.s, a.reference || null, `via ${c.keyName}`);
      return { order: o.number, received: a.amount, balance: round2(due - a.amount) };
    },
  },
  {
    name: 'approve_artwork', title: 'Start production', area: 'orders', write: true, input: z.object({ order: z.string(), how: z.string().default('on WhatsApp') }),
    description: 'Records that the customer approved the artwork (on WhatsApp, phone or in person) and moves the jobs to the machines.',
    run: async (a, c) => {
      const o = await db.order.findUnique({ where: { number: a.order.toUpperCase() } });
      if (!o) return fail(`No order ${a.order}`);
      if (!['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED'].includes(o.status)) return fail(`Order is ${ORDER_STATUS_LABEL[o.status]}`);
      await startProduction(o.id, c.s, `Artwork approved ${a.how} (via ${c.keyName})`);
      return { order: o.number, status: 'In production' };
    },
  },
  {
    name: 'advance_job', title: 'Move a job to its next stage', area: 'production', write: true, input: z.object({ job: z.string().describe('Job number, e.g. JOB-1004') }),
    description: 'Moves a job from print to cut to finish to pack to done. When every job on an order is done the order becomes Ready.',
    run: async (a, c) => {
      const j = await db.job.findUnique({ where: { number: a.job.toUpperCase() } });
      if (!j) return fail(`No job ${a.job}`);
      await advanceJob(j.id, c.s);
      const n = await db.job.findUniqueOrThrow({ where: { id: j.id } });
      return { job: n.number, stage: STAGE_LABEL[n.stage] };
    },
  },
  {
    name: 'issue_materials', title: 'Issue stock to a job', area: 'production', write: true, input: z.object({ job: z.string() }),
    description: 'Takes the estimated sheets, blanks and add-ons for a job out of stock.',
    run: async (a, c) => { const j = await db.job.findUnique({ where: { number: a.job.toUpperCase() } }); if (!j) return fail(`No job ${a.job}`); if (j.materialsIssued) return fail('Already issued'); await issueMaterials(j.id, c.s); return { job: j.number, materials_issued: true }; },
  },
  {
    name: 'update_order', title: 'Hand over, deliver or cancel', area: 'orders', write: true,
    input: z.object({ order: z.string(), action: z.enum(['dispatch', 'collected', 'delivered', 'cancel']), courier: z.string().optional(), awb: z.string().optional(), reason: z.string().optional() }),
    description: 'dispatch (needs courier and awb) or collected for a Ready order; delivered for a dispatched one; cancel (owner, manager or accounts only).',
    run: async (a, c) => {
      const o = await db.order.findUnique({ where: { number: a.order.toUpperCase() } });
      if (!o) return fail(`No order ${a.order}`);
      if (a.action === 'cancel') {
        if (!['OWNER', 'MANAGER', 'ACCOUNTS'].includes(c.s.role)) return fail('Only the owner, a manager or accounts can cancel');
        if (['DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(o.status)) return fail(`Order is ${ORDER_STATUS_LABEL[o.status]}`);
        await db.invoice.updateMany({ where: { orderId: o.id }, data: { cancelled: true } });
        await setOrderStatus(o.id, 'CANCELLED', c.s, `${a.reason || 'No reason given'} (via ${c.keyName})`);
      } else if (a.action === 'delivered') {
        if (o.status !== 'DISPATCHED') return fail('Only dispatched orders can be marked delivered');
        await setOrderStatus(o.id, 'COMPLETED', c.s, `Delivered (via ${c.keyName})`);
      } else {
        if (o.status !== 'READY') return fail('Only Ready orders can be handed over');
        if (a.action === 'dispatch') {
          if (!a.courier || !a.awb) return fail('Give courier and awb');
          await db.order.update({ where: { id: o.id }, data: { courier: a.courier, awb: a.awb } });
          await setOrderStatus(o.id, 'DISPATCHED', c.s, `${a.courier} ${a.awb} (via ${c.keyName})`);
        } else await setOrderStatus(o.id, 'COMPLETED', c.s, `Collected at the studio (via ${c.keyName})`);
        await ensureInvoice(o.id, c.s).catch(() => null);
      }
      const n = await db.order.findUniqueOrThrow({ where: { id: o.id } });
      return { order: n.number, status: ORDER_STATUS_LABEL[n.status] };
    },
  },
  {
    name: 'adjust_stock', title: 'Adjust stock', area: 'stock', write: true,
    input: z.object({ material: z.string().describe('Material code'), mode: z.enum(['received', 'used', 'count']), qty: z.number().min(0), note: z.string().max(200).optional() }),
    description: 'received adds stock, used takes it out, count sets the physical count.',
    run: async (a, c) => {
      const m = await db.material.findUnique({ where: { code: a.material.toUpperCase() } });
      if (!m) return fail(`No material ${a.material}`);
      const delta = a.mode === 'received' ? a.qty : a.mode === 'used' ? -a.qty : round2(a.qty - num(m.onHand));
      if (!delta) return { material: m.code, on_hand: num(m.onHand), changed: false };
      await db.$transaction([db.material.update({ where: { id: m.id }, data: { onHand: { increment: delta } } }), db.stockMove.create({ data: { materialId: m.id, qty: delta, type: a.mode === 'received' ? 'PURCHASE' : a.mode === 'used' ? 'ISSUE' : 'ADJUST', note: `${a.note || a.mode} (via ${c.keyName})`, userId: c.s.userId } })]);
      return { material: m.code, change: delta, on_hand: round2(num(m.onHand) + delta) };
    },
  },
  {
    name: 'add_expense', title: 'Add an expense', area: 'accounts', write: true,
    input: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), category: z.string().min(2), description: z.string().min(2), amount: z.number().positive(), gst: z.number().min(0).default(0), method: z.enum(['CASH', 'UPI', 'CARD', 'BANK', 'CHEQUE']), reference: z.string().optional() }),
    description: 'Records a business expense; gst is the GST included in the amount.',
    run: async (a, c) => { if (a.gst > a.amount) return fail('GST is more than the amount'); const e = await db.expense.create({ data: { date: a.date ? new Date(a.date + 'T12:00:00+05:30') : new Date(), category: a.category, description: `${a.description}`, amount: a.amount, gst: a.gst, method: a.method, reference: a.reference || null, createdById: c.s.userId } }); await logActivity(c.s, 'expense', e.id, 'added', `${a.category} ₹${a.amount} via ${c.keyName}`); return { id: e.id, saved: true }; },
  },
  {
    name: 'update_enquiry', title: 'Update an enquiry', area: 'quotes', write: true, input: z.object({ id: z.string(), status: z.enum(['NEW', 'CONTACTED', 'QUOTED', 'CLOSED']) }),
    description: 'Marks a website enquiry contacted, quoted or closed.',
    run: async (a) => { await db.enquiry.update({ where: { id: a.id }, data: { status: a.status } }).catch(() => fail('No such enquiry')); return { id: a.id, status: a.status }; },
  },
];

export function toolsFor(c: { s: Session; write: boolean }) {
  return TOOLS.filter((t) => can(c.s.role as Role, t.area) && (!t.write || c.write));
}

export async function callTool(name: string, args: unknown, c: Ctx) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) throw new ToolError(`Unknown tool "${name}"`);
  if (!can(c.s.role as Role, t.area)) throw new ToolError(`${c.s.name}'s role cannot use ${name}`);
  if (t.write && !c.write) throw new ToolError(`${name} changes data; this key is read only`);
  const parsed = t.input.safeParse(args ?? {});
  if (!parsed.success) throw new ToolError(parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '));
  const out = await t.run(parsed.data, c);
  return seesCost(c.s.role as Role) ? out : scrub(out);
}

const HIDDEN = new Set(['cost', 'cost_breakdown', 'margin', 'orders_with_costs', 'orders_without_costs']);
function scrub(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !HIDDEN.has(k)).map(([k, x]) => [k, scrub(x)]));
  return v;
}
