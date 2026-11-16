'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaff, type Session } from '@/lib/auth';
import { LineIn, buildItems } from '@/lib/lines';
import { advanceJob, createOrder, ensureInvoice, issueMaterials, recordPayment, setOrderStatus, startProduction } from '@/lib/orders';
import { stateName } from '@/lib/gst';
import { resolveCustomer } from '@/lib/customers';
import { checkUpload, storeFile } from '@/lib/files';
import { logActivity } from '@/lib/activity';
import { num, round2 } from '@/lib/format';
import type { FormResult } from '@/components/FormMessage';
import type { PayMethod } from '@/generated/prisma/client';

const OrderPayload = z.object({
  customer: z.unknown(), lines: z.array(z.unknown()).min(1, 'Add at least one item'), discount: z.number().min(0), notes: z.string().max(2000).optional(),
  channel: z.enum(['COUNTER', 'B2B']), fulfilment: z.enum(['PICKUP', 'COURIER']), terms: z.enum(['PREPAID', 'PAY_ON_PICKUP', 'CREDIT']),
  skipProof: z.boolean(), rush: z.boolean(), shipping: z.number().min(0),
  ship: z.object({ line1: z.string(), city: z.string(), pincode: z.string(), stateCode: z.string() }).nullable(),
  paidNow: z.number().min(0), payMethod: z.enum(['UPI', 'CASH', 'CARD', 'BANK', 'CHEQUE']),
});

export async function createDeskOrder(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('orders');
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get('payload'))); } catch { return { error: 'Could not read the form. Reload and try again.' }; }
  const p = OrderPayload.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0].message };
  const f = p.data;
  const lines = z.array(LineIn).safeParse(f.lines);
  if (!lines.success) return { error: lines.error.issues[0].message };
  const cust = await resolveCustomer(f.customer);
  if ('error' in cust) return cust;
  const built = await buildItems(lines.data);
  if ('error' in built) return built;
  const customer = await db.customer.findUniqueOrThrow({ where: { id: cust.id } });
  if (f.fulfilment === 'COURIER' && (!f.ship?.line1 || !/^\d{6}$/.test(f.ship.pincode))) return { error: 'Enter the delivery address and a 6-digit pincode' };
  const subtotal = built.items.reduce((a, i) => a + i.lineTotal, 0);
  if (f.discount > subtotal) return { error: 'Discount cannot be more than the items total' };
  if (f.terms === 'CREDIT' && num(customer.creditLimit) > 0 && !['OWNER', 'MANAGER'].includes(s.role)) {
    const open = await db.order.findMany({ where: { customerId: customer.id, status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } }, select: { total: true, amountPaid: true } });
    const owed = open.reduce((a, o) => a + num(o.total) - num(o.amountPaid), 0);
    if (owed + subtotal > num(customer.creditLimit)) return { error: `This takes ${customer.company || customer.name} over their credit limit of ₹${num(customer.creditLimit).toLocaleString('en-IN')}. Ask the owner or a manager to place it.` };
  }
  const order = await createOrder({
    customerId: customer.id, channel: f.channel, items: built.items, fulfilment: f.fulfilment, terms: f.terms,
    ship: f.fulfilment === 'COURIER' && f.ship ? { name: customer.company || customer.name, phone: customer.phone, line1: f.ship.line1, city: f.ship.city, pincode: f.ship.pincode, stateCode: f.ship.stateCode, state: stateName(f.ship.stateCode) } : null,
    shipping: round2(f.shipping), discount: round2(f.discount), notes: f.notes || null, skipProof: f.skipProof, rush: f.rush,
  }, s);
  if (f.paidNow > 0) await recordPayment(order.id, Math.min(f.paidNow, num(order.total)), f.payMethod as PayMethod, s, null, 'Received at order');
  revalidatePath('/desk', 'layout');
  redirect(`/desk/orders/${order.number}?created=1`);
}

async function orderByNumber(number: unknown) {
  const o = await db.order.findUnique({ where: { number: String(number) } });
  if (!o) throw new Error('Order not found');
  return o;
}
const back = (n: string, q = '') => { revalidatePath(`/desk/orders/${n}`); revalidatePath('/desk', 'layout'); redirect(`/desk/orders/${n}${q}`); };

/** Uploads a proof file and sends it to the customer for approval. */
export async function sendProof(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  if (!['PLACED', 'CHANGES_REQUESTED', 'PROOF_SENT'].includes(o.status)) return { error: 'Proofs can only be sent before production starts' };
  const file = fd.get('file');
  if (!(file instanceof File) || !file.size) return { error: 'Attach the proof file (PDF or image)' };
  const bad = checkUpload(file);
  if (bad) return { error: bad };
  const note = String(fd.get('note') || '').trim().slice(0, 1000);
  const stored = await storeFile(file, { kind: 'PROOF', uploadedById: s.userId, orderId: o.id });
  const last = await db.proof.findFirst({ where: { orderId: o.id }, orderBy: { version: 'desc' } });
  if (last?.status === 'SENT') await db.proof.update({ where: { id: last.id }, data: { status: 'CHANGES', response: last.response || 'Replaced by a newer proof', respondedAt: new Date() } });
  const v = (last?.version || 0) + 1;
  await db.proof.create({ data: { orderId: o.id, version: v, fileId: stored.id, note, createdById: s.userId } });
  await db.order.update({ where: { id: o.id }, data: { status: 'PROOF_SENT' } });
  await logActivity(s, 'order', o.id, 'proof sent', `v${v}${note ? ' · ' + note : ''}`);
  back(o.number, '?proof=1');
  return null;
}

export async function approveArtwork(fd: FormData) {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  if (!['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED'].includes(o.status)) back(o.number);
  const last = await db.proof.findFirst({ where: { orderId: o.id }, orderBy: { version: 'desc' } });
  if (last?.status === 'SENT') await db.proof.update({ where: { id: last.id }, data: { status: 'APPROVED', response: `Approved by ${s.name} for the customer`, respondedAt: new Date() } });
  await startProduction(o.id, s, `Artwork approved (recorded by ${s.name})`);
  await logActivity(s, 'order', o.id, 'artwork approved', String(fd.get('how') || 'on phone / in person'));
  back(o.number);
}

export async function addPayment(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  if (o.status === 'CANCELLED') return { error: 'This order is cancelled' };
  const amount = round2(Number(fd.get('amount')));
  const due = round2(num(o.total) - num(o.amountPaid));
  if (!(amount > 0)) return { error: 'Enter the amount received' };
  if (amount > due + 0.5) return { error: `That is more than the balance of ₹${due.toLocaleString('en-IN')}` };
  const method = String(fd.get('method')) as PayMethod;
  if (!['CASH', 'UPI', 'CARD', 'BANK', 'CHEQUE'].includes(method)) return { error: 'Choose how it was paid' };
  await recordPayment(o.id, amount, method, s, String(fd.get('reference') || '').trim() || null);
  revalidatePath(`/desk/orders/${o.number}`);
  return { ok: true, message: `₹${amount.toLocaleString('en-IN')} recorded`, t: Date.now() };
}

export async function makeInvoice(fd: FormData) {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  const inv = await ensureInvoice(o.id, s);
  revalidatePath(`/desk/orders/${o.number}`);
  redirect(`/print/invoice/${inv.id}`);
}

export async function markReady(fd: FormData) {
  const s = await requireStaff('production');
  const o = await orderByNumber(fd.get('number'));
  if (!['APPROVED', 'IN_PRODUCTION'].includes(o.status)) back(o.number);
  const items = await db.orderItem.findMany({ where: { orderId: o.id }, include: { job: true } });
  for (const it of items) if (it.job && it.job.stage !== 'DONE') await db.job.update({ where: { id: it.job.id }, data: { stage: 'DONE', finishedAt: new Date(), events: { create: { stage: 'DONE', note: 'Marked done from the order', userName: s.name } } } });
  await setOrderStatus(o.id, 'READY', s);
  back(o.number);
}

export async function dispatchOrder(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  if (o.status !== 'READY') return { error: 'Only ready orders can be handed over' };
  if (o.fulfilment === 'COURIER') {
    const courier = String(fd.get('courier') || '').trim(), awb = String(fd.get('awb') || '').trim();
    if (!courier || !awb) return { error: 'Enter the courier and tracking number' };
    await db.order.update({ where: { id: o.id }, data: { courier, awb } });
    await setOrderStatus(o.id, 'DISPATCHED', s, `${courier} ${awb}`);
  } else {
    await setOrderStatus(o.id, 'COMPLETED', s, 'Collected at the studio');
  }
  if (num(o.total) > 0) await ensureInvoice(o.id, s).catch(() => null);
  back(o.number);
  return null;
}

export async function completeOrder(fd: FormData) {
  const s = await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  if (o.status === 'DISPATCHED') await setOrderStatus(o.id, 'COMPLETED', s, 'Delivered');
  back(o.number);
}

export async function cancelOrder(fd: FormData) {
  const s = await requireStaff('orders');
  if (!['OWNER', 'MANAGER', 'ACCOUNTS'].includes(s.role)) throw new Error('Only the owner, a manager or accounts can cancel orders');
  const o = await orderByNumber(fd.get('number'));
  if (['DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(o.status)) back(o.number);
  const reason = String(fd.get('reason') || '').trim() || 'No reason given';
  await db.invoice.updateMany({ where: { orderId: o.id }, data: { cancelled: true } });
  await setOrderStatus(o.id, 'CANCELLED', s, reason);
  if (num(o.amountPaid) > 0) await logActivity(s, 'order', o.id, 'refund due', `₹${num(o.amountPaid)} was paid on this order`);
  back(o.number);
}

export async function saveInternalNote(_p: FormResult, fd: FormData): Promise<FormResult> {
  await requireStaff('orders');
  const o = await orderByNumber(fd.get('number'));
  await db.order.update({ where: { id: o.id }, data: { internalNotes: String(fd.get('internalNotes') || '').slice(0, 4000) || null } });
  revalidatePath(`/desk/orders/${o.number}`);
  return { ok: true, message: 'Saved', t: Date.now() };
}

/* ---------- production ---------- */

async function jobGuard(fd: FormData): Promise<{ s: Session; id: string; from: string }> {
  const s = await requireStaff('production');
  return { s, id: String(fd.get('jobId')), from: String(fd.get('from') || '/desk/production') };
}
const safeFrom = (f: string) => (f.startsWith('/desk') ? f : '/desk/production');

export async function moveJob(fd: FormData) {
  const { s, id, from } = await jobGuard(fd);
  try { await advanceJob(id, s); } catch (e) { redirect(`${safeFrom(from)}${safeFrom(from).includes('?') ? '&' : '?'}err=${encodeURIComponent((e as Error).message)}`); }
  revalidatePath('/desk', 'layout');
  redirect(safeFrom(from));
}

export async function issueJobMaterials(fd: FormData) {
  const { s, id, from } = await jobGuard(fd);
  await issueMaterials(id, s);
  revalidatePath('/desk', 'layout');
  redirect(safeFrom(from));
}

export async function setJobMachine(fd: FormData) {
  const { s, id, from } = await jobGuard(fd);
  const machineId = String(fd.get('machineId') || '') || null;
  const j = await db.job.update({ where: { id }, data: { machineId }, include: { machine: true } });
  await db.jobEvent.create({ data: { jobId: id, stage: j.stage, note: `Machine: ${j.machine?.name || 'none'}`, userName: s.name } });
  revalidatePath('/desk/production');
  redirect(safeFrom(from));
}

export async function toggleRush(fd: FormData) {
  const { id, from } = await jobGuard(fd);
  const j = await db.job.findUniqueOrThrow({ where: { id } });
  await db.job.update({ where: { id }, data: { rush: !j.rush } });
  revalidatePath('/desk/production');
  redirect(safeFrom(from));
}
