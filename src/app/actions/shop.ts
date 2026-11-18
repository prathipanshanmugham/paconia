'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSession, requireUser } from '@/lib/auth';
import { cartToken, getCart, readCartToken } from '@/lib/cart';
import { materialsFor } from '@/lib/catalog';
import { getPricing, getShipping, shippingFor } from '@/lib/settings';
import { price, type ProductConfig, type Spec } from '@/lib/pricing';
import { createOrder, recordPayment, type NewItem } from '@/lib/orders';
import { checkGstin, stateFromPin, stateName } from '@/lib/gst';
import { paymentsDemo, razorpay, razorpayReady, verifyPaymentSignature } from '@/lib/razorpay';
import { logActivity } from '@/lib/activity';
import { num } from '@/lib/format';
import type { Prisma } from '@/generated/prisma/client';

export async function addToCart(productId: string, spec: Spec, artworkIds: string[], notes: string) {
  const p = await db.product.findUnique({ where: { id: productId } });
  if (!p || !p.active) return { error: 'This product is no longer available' };
  const cfg = p.config as unknown as ProductConfig;
  const r = price(p.model, cfg, spec, await materialsFor(cfg), await getPricing());
  if (!r.ok) return { error: r.error };
  const token = cartToken();
  const s = await getSession();
  const owned = artworkIds.length ? await db.fileAsset.findMany({ where: { id: { in: artworkIds }, OR: [{ cartToken: token }, ...(s ? [{ uploadedById: s.userId }] : [])] }, select: { id: true } }) : [];
  await db.cartLine.create({ data: { cartToken: token, productId, spec: spec as unknown as Prisma.InputJsonValue, artworkIds: owned.map((f) => f.id), notes: notes?.slice(0, 800) || null } });
  revalidatePath('/cart');
  return { ok: true };
}

export async function removeCartLine(fd: FormData) {
  const token = readCartToken();
  if (!token) return;
  await db.cartLine.deleteMany({ where: { id: String(fd.get('id')), cartToken: token } });
  revalidatePath('/cart');
}

const Checkout = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid mobile number'),
  company: z.string().trim().max(120).optional(),
  gstin: z.string().trim().toUpperCase().optional(),
  fulfilment: z.enum(['COURIER', 'PICKUP']),
  line1: z.string().trim().optional(),
  line2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  pincode: z.string().trim().optional(),
  stateCode: z.string().trim().optional(),
  pay: z.enum(['ONLINE', 'PICKUP', 'CREDIT']),
  notes: z.string().trim().max(800).optional(),
});

export type CheckoutState = { error?: string } | null;

export async function placeOrder(_prev: CheckoutState, fd: FormData): Promise<CheckoutState> {
  const s = await getSession();
  if (!s) return { error: 'Please sign in to place your order' };
  const parsed = Checkout.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const f = parsed.data;
  if (f.fulfilment === 'COURIER') {
    if (!f.line1 || !f.city) return { error: 'Enter the delivery address' };
    if (!/^\d{6}$/.test(f.pincode || '')) return { error: 'Enter a 6-digit pincode' };
  }
  if (f.gstin) { const g = checkGstin(f.gstin); if (!g.ok) return { error: g.error }; }
  const token = readCartToken();
  const lines = await getCart(token);
  if (!lines.length) return { error: 'Your cart is empty' };
  for (const l of lines) if (!l.priced.ok) return { error: `${l.product.name}: ${l.priced.error}` };

  const user = await db.user.findUniqueOrThrow({ where: { id: s.userId }, include: { customer: true } });
  let customer = user.customer;
  if (f.pay === 'CREDIT' && !(customer && customer.creditDays > 0)) return { error: 'Pay on account is available for approved business accounts only' };
  if (f.pay === 'PICKUP' && f.fulfilment !== 'PICKUP') return { error: 'Pay at pickup is only for orders collected from the studio' };
  if (f.pay === 'ONLINE' && !razorpayReady() && !paymentsDemo()) return { error: 'Online payment is not switched on yet. Choose pay at pickup, or contact us.' };
  const stateCode = f.fulfilment === 'COURIER' ? (f.stateCode || stateFromPin(f.pincode)) : (customer?.stateCode || '33');
  const details = {
    name: f.name, phone: f.phone, company: f.company || null, gstin: f.gstin || null, type: f.company || f.gstin ? 'BUSINESS' as const : 'INDIVIDUAL' as const,
    ...(f.fulfilment === 'COURIER' ? { line1: f.line1, line2: f.line2 || null, city: f.city, pincode: f.pincode, stateCode, state: stateName(stateCode) } : {}),
  };
  if (!customer) {
    const { nextCustomerCode } = await import('@/lib/numbering');
    customer = await db.customer.create({ data: { code: await nextCustomerCode(), userId: user.id, email: user.email, ...details } });
  } else {
    customer = await db.customer.update({ where: { id: customer.id }, data: details });
  }

  const items: NewItem[] = lines.map((l) => {
    const r = l.priced as Extract<typeof l.priced, { ok: true }>;
    const cfg = l.product.config as unknown as ProductConfig;
    return {
      productId: l.productId, name: l.product.name, summary: r.summary + (l.notes ? ` · Note: ${l.notes}` : ''), spec: l.spec, qty: r.qty, unitPrice: r.unit, lineTotal: r.total, lineCost: r.cost,
      hsn: l.product.hsn, gstRate: l.product.gstRate, leadDays: l.product.leadDays, artworkIds: l.artworkIds,
      estimate: { route: r.route, sheets: r.sheets, ups: r.ups, materials: r.materials, minutes: r.minutes, cut: cfg.cut },
    };
  });
  const subtotal = items.reduce((a, i) => a + i.lineTotal, 0);
  const shipping = shippingFor(await getShipping(), subtotal, stateCode, f.fulfilment);
  const order = await createOrder({
    customerId: customer.id, channel: 'ONLINE', items, fulfilment: f.fulfilment,
    terms: f.pay === 'ONLINE' ? 'PREPAID' : f.pay === 'PICKUP' ? 'PAY_ON_PICKUP' : 'CREDIT',
    ship: f.fulfilment === 'COURIER' ? { name: f.company || f.name, phone: f.phone, line1: f.line1!, line2: f.line2, city: f.city!, state: stateName(stateCode), stateCode, pincode: f.pincode! } : null,
    shipping, notes: f.notes || null,
  }, s);
  await db.cartLine.deleteMany({ where: { cartToken: token! } });
  revalidatePath('/cart');
  if (f.pay === 'ONLINE') redirect(`/pay/${order.number}`);
  redirect(`/account/orders/${order.number}?placed=1`);
}

async function ownOrder(number: string) {
  const s = await requireUser('/account');
  const o = await db.order.findUnique({ where: { number }, include: { customer: true } });
  if (!o || o.customer.userId !== s.userId) throw new Error('Order not found');
  return { s, o };
}

/** Creates (or reuses) the Razorpay order for checkout. */
export async function razorpayOrderFor(number: string) {
  const { o } = await ownOrder(number);
  if (o.paymentStatus === 'PAID') return { paid: true as const };
  if (!razorpayReady()) return { error: 'Online payment is not configured' };
  const due = Math.round((num(o.total) - num(o.amountPaid)) * 100);
  if (o.rzpOrderId) return { orderId: o.rzpOrderId, amount: due };
  const rz = await razorpay().orders.create({ amount: due, currency: 'INR', receipt: o.number, notes: { order: o.number } });
  await db.order.update({ where: { id: o.id }, data: { rzpOrderId: rz.id } });
  return { orderId: rz.id, amount: due };
}

export async function confirmRazorpay(number: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const { s, o } = await ownOrder(number);
  if (o.rzpOrderId !== payload.razorpay_order_id || !verifyPaymentSignature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature)) {
    return { error: 'We could not verify the payment. If money was debited, it will be matched automatically; please contact us.' };
  }
  const p = await razorpay().payments.fetch(payload.razorpay_payment_id);
  if (p.order_id !== o.rzpOrderId) return { error: 'Payment does not match this order. Please contact us.' };
  if (p.status !== 'captured') return { ok: true }; // authorised but not yet captured: the webhook records it once captured
  await recordPayment(o.id, Number(p.amount) / 100, 'RAZORPAY', s, `Razorpay ${p.method || ''}`.trim(), null, payload.razorpay_payment_id);
  revalidatePath(`/account/orders/${number}`);
  return { ok: true };
}

/** Testing only (PAYMENTS_DEMO=1): marks the order paid without Razorpay. */
export async function simulatePayment(fd: FormData) {
  if (!paymentsDemo()) throw new Error('Demo payments are switched off');
  const number = String(fd.get('number'));
  const { s, o } = await ownOrder(number);
  const due = num(o.total) - num(o.amountPaid);
  if (due > 0) await recordPayment(o.id, due, 'RAZORPAY', s, 'Simulated payment (demo mode)', null, `demo_${o.number}_${Date.now()}`);
  redirect(`/account/orders/${number}?paid=1`);
}

/** Customer response to a proof. */
export async function respondToProof(fd: FormData) {
  const number = String(fd.get('number'));
  const decision = String(fd.get('decision'));
  const comment = String(fd.get('comment') || '').trim().slice(0, 1000);
  const { s, o } = await ownOrder(number);
  const proof = await db.proof.findFirst({ where: { orderId: o.id }, orderBy: { version: 'desc' } });
  if (!proof || proof.status !== 'SENT' || o.status !== 'PROOF_SENT') redirect(`/account/orders/${number}`);
  if (decision === 'approve') {
    await db.proof.update({ where: { id: proof.id }, data: { status: 'APPROVED', response: comment || null, respondedAt: new Date() } });
    await logActivity(s, 'order', o.id, 'proof approved', `v${proof.version}${comment ? ' · ' + comment : ''}`);
    const { startProduction } = await import('@/lib/orders');
    await startProduction(o.id, s, `Proof v${proof.version} approved by customer`);
  } else {
    if (!comment) redirect(`/account/orders/${number}?need=comment`);
    await db.proof.update({ where: { id: proof.id }, data: { status: 'CHANGES', response: comment, respondedAt: new Date() } });
    await db.order.update({ where: { id: o.id }, data: { status: 'CHANGES_REQUESTED' } });
    await logActivity(s, 'order', o.id, 'changes requested', comment);
  }
  revalidatePath(`/account/orders/${number}`);
  redirect(`/account/orders/${number}`);
}
