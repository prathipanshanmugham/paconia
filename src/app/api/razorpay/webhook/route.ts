import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay';
import { recordPayment } from '@/lib/orders';

export const runtime = 'nodejs';

/** Razorpay webhook (payment.captured / order.paid). Set the URL to https://<domain>/api/razorpay/webhook in the Razorpay dashboard. */
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!verifyWebhookSignature(body, req.headers.get('x-razorpay-signature') || '')) return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  const evt = JSON.parse(body);
  const pay = evt?.payload?.payment?.entity;
  if (!pay?.order_id || !['payment.captured', 'order.paid'].includes(evt.event)) return NextResponse.json({ ok: true });
  const order = await db.order.findUnique({ where: { rzpOrderId: pay.order_id } });
  if (!order) return NextResponse.json({ ok: true });
  await recordPayment(order.id, Number(pay.amount) / 100, 'RAZORPAY', null, pay.method ? `Razorpay ${pay.method}` : 'Razorpay', null, pay.id);
  return NextResponse.json({ ok: true });
}
