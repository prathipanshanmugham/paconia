import { db } from './db';
import type { Session } from './auth';
import { logActivity } from './activity';
import { computeTax, stateName, SELLER_STATE_CODE } from './gst';
import { addDays, addWorkingDays, num, round2 } from './format';
import { nextInvoiceNo, nextJobNo, nextOrderNo, nextReceiptNo } from './numbering';
import { getInvoicePrefs } from './settings';
import type { Stage } from './pricing';
import type { Channel, Fulfilment, JobStage, OrderStatus, PayMethod, PaymentTerms, Prisma } from '@/generated/prisma/client';

export type NewItem = {
  productId?: string | null; name: string; summary: string; spec?: unknown; qty: number; unitPrice: number; lineTotal: number; lineCost?: number;
  hsn: string; gstRate: number; estimate?: { route?: Stage[]; sheets?: number; ups?: number; materials?: { code: string; qty: number }[]; minutes?: number; cut?: string } | null;
  artworkIds?: string[]; leadDays?: number;
};
export type ShipTo = { name: string; phone: string; line1: string; line2?: string | null; city: string; state: string; stateCode: string; pincode: string };

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PLACED: 'Waiting for proof', PROOF_SENT: 'Proof sent', CHANGES_REQUESTED: 'Changes requested', APPROVED: 'Approved',
  IN_PRODUCTION: 'In production', READY: 'Ready', DISPATCHED: 'Dispatched', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
export const ORDER_TONE: Record<OrderStatus, 'info' | 'warn' | 'bad' | 'good' | 'muted'> = {
  PLACED: 'warn', PROOF_SENT: 'info', CHANGES_REQUESTED: 'bad', APPROVED: 'info', IN_PRODUCTION: 'info', READY: 'good', DISPATCHED: 'good', COMPLETED: 'muted', CANCELLED: 'muted',
};
export const STAGE_LABEL: Record<JobStage, string> = { PREPRESS: 'Artwork & proof', PRINT: 'Print', CUT: 'Cut', FINISH: 'Finish', PACK: 'Pack', DONE: 'Done' };
export const CHANNEL_LABEL: Record<Channel, string> = { ONLINE: 'Website', B2B: 'B2B', COUNTER: 'Walk-in' };

export function routeOf(estimate: unknown): JobStage[] {
  const r = (estimate as { route?: Stage[] } | null)?.route;
  return r && r.length ? (r as JobStage[]) : ['PREPRESS', 'PRINT', 'CUT', 'PACK'];
}
export function nextStage(route: JobStage[], current: JobStage): JobStage {
  const i = route.indexOf(current);
  return i < 0 || i >= route.length - 1 ? 'DONE' : route[i + 1];
}

/** Machine suggestion for a stage, by the product's cutting method. */
async function machineFor(stage: JobStage, cut?: string) {
  const code = stage === 'PRINT' ? 'OKI-9542' : stage === 'CUT' ? (cut === 'laser' ? 'CO2-LASER' : cut === 'guillotine' ? 'GUILLOTINE' : 'TOYOCUT-B13') : stage === 'FINISH' ? 'FINISH-BENCH' : null;
  if (!code) return null;
  const m = await db.machine.findUnique({ where: { code } });
  return m && m.status === 'ACTIVE' ? m.id : null;
}

export async function createOrder(input: {
  customerId: string; channel: Channel; items: NewItem[]; fulfilment: Fulfilment; terms: PaymentTerms;
  ship?: ShipTo | null; shipping: number; discount?: number; notes?: string | null; skipProof?: boolean; rush?: boolean; quoteId?: string | null;
}, s: Session | null) {
  const customer = await db.customer.findUniqueOrThrow({ where: { id: input.customerId } });
  const discount = round2(input.discount || 0);
  const subtotal = round2(input.items.reduce((a, i) => a + i.lineTotal, 0));
  const buyerState = input.ship?.stateCode || customer.stateCode || SELLER_STATE_CODE;
  const tax = computeTax(input.items.map((i) => ({ amount: i.lineTotal, gstRate: i.gstRate })), input.shipping, discount, buyerState);
  const maxLead = Math.max(1, ...input.items.map((i) => i.leadDays || 3));
  const due = addWorkingDays(new Date(), maxLead + (input.skipProof ? 0 : 1));
  const number = await nextOrderNo();

  const order = await db.order.create({
    data: {
      number, channel: input.channel, customerId: customer.id, fulfilment: input.fulfilment, terms: input.terms,
      shipName: input.ship?.name, shipPhone: input.ship?.phone, shipLine1: input.ship?.line1, shipLine2: input.ship?.line2 || null,
      shipCity: input.ship?.city, shipState: input.ship?.state || stateName(buyerState), shipStateCode: buyerState, shipPincode: input.ship?.pincode,
      subtotal, discount, shipping: input.shipping, taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, total: tax.total,
      cost: Math.round(input.items.reduce((a, i) => a + (i.lineCost || 0), 0) * 100) / 100,
      dueDate: due, notes: input.notes || null, createdById: s?.userId,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId || null, name: i.name, summary: i.summary, spec: (i.spec ?? undefined) as Prisma.InputJsonValue | undefined,
          qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal, lineCost: i.lineCost || 0, hsn: i.hsn, gstRate: i.gstRate,
          estimate: (i.estimate ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      },
    },
    include: { items: true },
  });

  for (let k = 0; k < order.items.length; k++) {
    const it = order.items[k];
    const src = input.items[k];
    if (src.artworkIds?.length) await db.fileAsset.updateMany({ where: { id: { in: src.artworkIds } }, data: { orderId: order.id, orderItemId: it.id, cartToken: null } });
    const est = (src.estimate || {}) as NonNullable<NewItem['estimate']>;
    await db.job.create({
      data: {
        number: await nextJobNo(), orderItemId: it.id, stage: 'PREPRESS', rush: !!input.rush,
        dueDate: addWorkingDays(new Date(), (src.leadDays || 3) + (input.skipProof ? 0 : 1)),
        sheets: est.sheets ?? null, ups: est.ups ?? null,
        events: { create: { stage: 'PREPRESS', note: 'Job opened', userName: s?.name || 'Website' } },
      },
    });
  }
  if (input.quoteId) await db.quote.update({ where: { id: input.quoteId }, data: { orderId: order.id, status: 'ACCEPTED' } });
  await logActivity(s, 'order', order.id, 'created', `${number} · ${input.items.length} item(s) · ₹${tax.total}`);
  if (input.skipProof) await startProduction(order.id, s, 'Artwork approved at the counter');
  return order;
}

/** Proof approved (or skipped): every job leaves prepress for its first machine stage. */
export async function startProduction(orderId: string, s: Session | null, note = 'Proof approved') {
  const items = await db.orderItem.findMany({ where: { orderId }, include: { job: true } });
  for (const it of items) {
    if (!it.job || it.job.stage !== 'PREPRESS') continue;
    const route = routeOf(it.estimate);
    const st = nextStage(route, 'PREPRESS');
    const cut = (it.estimate as { cut?: string } | null)?.cut;
    await db.job.update({
      where: { id: it.job.id },
      data: { stage: st, startedAt: new Date(), machineId: await machineFor(st, cut), events: { create: { stage: st, note, userName: s?.name || 'Customer' } } },
    });
  }
  await db.order.update({ where: { id: orderId }, data: { status: 'IN_PRODUCTION' } });
  await syncOrderFromJobs(orderId);
}

export async function advanceJob(jobId: string, s: Session) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { orderItem: { include: { order: true } } } });
  const order = job.orderItem.order;
  if (job.stage === 'PREPRESS') throw new Error('Approve the proof first (or mark artwork approved) to start production.');
  if (job.stage === 'DONE') return job;
  if (['CANCELLED'].includes(order.status)) throw new Error('This order is cancelled.');
  const route = routeOf(job.orderItem.estimate);
  const st = nextStage(route, job.stage);
  const cut = (job.orderItem.estimate as { cut?: string } | null)?.cut;
  const updated = await db.job.update({
    where: { id: jobId },
    data: {
      stage: st, machineId: st === 'DONE' || st === 'PACK' ? null : await machineFor(st, cut), finishedAt: st === 'DONE' ? new Date() : null,
      events: { create: { stage: st, note: st === 'DONE' ? 'Packed and ready' : `Moved to ${STAGE_LABEL[st]}`, userName: s.name } },
    },
  });
  await syncOrderFromJobs(order.id);
  return updated;
}

/** When every job is done the order is Ready (for pickup or dispatch). */
export async function syncOrderFromJobs(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { job: true } } } });
  if (!['IN_PRODUCTION', 'APPROVED'].includes(order.status)) return;
  const jobs = order.items.map((i) => i.job).filter(Boolean);
  if (jobs.length && jobs.every((j) => j!.stage === 'DONE')) await db.order.update({ where: { id: orderId }, data: { status: 'READY' } });
}

export async function issueMaterials(jobId: string, s: Session) {
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { orderItem: true } });
  if (job.materialsIssued) return { issued: [] as string[] };
  const mats = ((job.orderItem.estimate as { materials?: { code: string; qty: number }[] } | null)?.materials) || [];
  const issued: string[] = [];
  for (const m of mats) {
    const row = await db.material.findUnique({ where: { code: m.code } });
    if (!row) continue;
    await db.$transaction([
      db.material.update({ where: { id: row.id }, data: { onHand: { decrement: m.qty } } }),
      db.stockMove.create({ data: { materialId: row.id, qty: -m.qty, type: 'ISSUE', ref: job.number, note: 'Issued to job', userId: s.userId } }),
    ]);
    issued.push(`${m.qty} ${row.uom} ${row.name}`);
  }
  await db.job.update({ where: { id: jobId }, data: { materialsIssued: true, events: { create: { stage: job.stage, note: `Materials issued: ${issued.join(', ') || 'none listed'}`, userName: s.name } } } });
  return { issued };
}

export async function refreshPaymentStatus(orderId: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: true } });
  const paid = round2(o.payments.reduce((a, p) => a + num(p.amount), 0));
  const total = num(o.total);
  const status = paid <= 0 ? 'UNPAID' : paid + 0.5 >= total ? 'PAID' : 'PARTIAL';
  await db.order.update({ where: { id: orderId }, data: { amountPaid: paid, paymentStatus: status } });
}

export async function recordPayment(orderId: string, amount: number, method: PayMethod, s: Session | null, reference?: string | null, note?: string | null, rzpPaymentId?: string | null) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!(amount > 0)) throw new Error('Enter an amount above zero');
  if (rzpPaymentId) {
    const dup = await db.payment.findUnique({ where: { rzpPaymentId } });
    if (dup) return dup;
  }
  const p = await db.payment.create({
    data: { number: await nextReceiptNo(), orderId, customerId: o.customerId, amount: round2(amount), method, reference: reference || null, note: note || null, rzpPaymentId: rzpPaymentId || null, createdById: s?.userId },
  });
  await refreshPaymentStatus(orderId);
  await logActivity(s, 'order', orderId, 'payment', `₹${round2(amount)} by ${method}${reference ? ' · ' + reference : ''}`);
  return p;
}

export type InvoiceLine = { name: string; summary: string; hsn: string; qty: number; rate: number; amount: number; gstRate: number };

/** Issues the tax invoice for an order (one per order). Returns the existing one if already issued. */
export async function ensureInvoice(orderId: string, s: Session | null) {
  const existing = await db.invoice.findFirst({ where: { orderId, cancelled: false } });
  if (existing) return existing;
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, customer: true } });
  if (o.status === 'CANCELLED') throw new Error('Cancelled orders cannot be invoiced');
  const prefs = await getInvoicePrefs();
  const c = o.customer;
  const lines: InvoiceLine[] = o.items.map((i) => ({ name: i.name, summary: i.summary, hsn: i.hsn, qty: i.qty, rate: num(i.unitPrice), amount: num(i.lineTotal), gstRate: i.gstRate }));
  if (num(o.shipping) > 0) {
    const principal = lines.reduce((a, l) => (l.amount > a.amount ? l : a), lines[0]);
    lines.push({ name: 'Packing & forwarding', summary: 'Courier to delivery address', hsn: principal.hsn, qty: 1, rate: num(o.shipping), amount: num(o.shipping), gstRate: principal.gstRate });
  }
  const stateCode = o.shipStateCode || c.stateCode || SELLER_STATE_CODE;
  const addr = [c.line1, c.line2, c.city, c.state || stateName(stateCode), c.pincode].filter(Boolean).join(', ') ||
    [o.shipLine1, o.shipLine2, o.shipCity, o.shipState, o.shipPincode].filter(Boolean).join(', ');
  const issuedAt = new Date();
  const inv = await db.invoice.create({
    data: {
      number: await nextInvoiceNo(prefs.prefix), orderId, customerId: c.id, issuedAt,
      dueDate: o.terms === 'CREDIT' ? addDays(issuedAt, c.creditDays || prefs.creditDays) : issuedAt,
      placeOfSupply: `${stateName(stateCode)} (${stateCode})`, interstate: stateCode !== SELLER_STATE_CODE,
      billName: c.company ? `${c.company}` : c.name, billGstin: c.gstin, billAddress: addr || '—',
      lines: lines as unknown as Prisma.InputJsonValue, taxable: o.taxable, cgst: o.cgst, sgst: o.sgst, igst: o.igst, total: o.total, createdById: s?.userId,
    },
  });
  await logActivity(s, 'order', orderId, 'invoiced', inv.number);
  return inv;
}

export async function setOrderStatus(orderId: string, status: OrderStatus, s: Session, detail?: string) {
  await db.order.update({ where: { id: orderId }, data: { status } });
  await logActivity(s, 'order', orderId, 'status', `${ORDER_STATUS_LABEL[status]}${detail ? ' · ' + detail : ''}`);
}

export function outstanding(o: { total: unknown; amountPaid: unknown; status: string }) {
  if (o.status === 'CANCELLED') return 0;
  return Math.max(0, round2(num(o.total) - num(o.amountPaid)));
}
