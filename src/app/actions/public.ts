'use server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { ORDER_STATUS_LABEL, STAGE_LABEL } from '@/lib/orders';
import { dateFmt } from '@/lib/format';
import type { FormResult } from '@/components/FormMessage';

const Enq = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(80),
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid mobile number'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).optional(),
  product: z.string().trim().min(2, 'Choose what you need').max(80),
  qty: z.string().trim().min(1, 'Tell us roughly how many').max(60),
  details: z.string().trim().min(10, 'Add a few details (size, material, deadline)').max(2000),
  website: z.string().max(0).optional(), // honeypot
});

export async function sendEnquiry(_p: FormResult, fd: FormData): Promise<FormResult> {
  const r = Enq.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  const s = await getSession();
  const customer = s ? await db.customer.findUnique({ where: { userId: s.userId } }) : null;
  await db.enquiry.create({ data: { name: f.name, company: f.company || null, phone: f.phone, email: f.email || null, product: f.product, qty: f.qty, details: f.details, customerId: customer?.id } });
  return { ok: true, message: 'Thank you. We will call or WhatsApp you with a quote within one working day.', t: Date.now() };
}

export type TrackResult = { error?: string; order?: { number: string; status: string; placed: string; ready: string | null; stages: string[]; courier: string | null; awb: string | null } } | null;

export async function trackOrder(_p: TrackResult, fd: FormData): Promise<TrackResult> {
  const number = String(fd.get('number') || '').trim().toUpperCase();
  const phone = String(fd.get('phone') || '').replace(/\D/g, '').slice(-10);
  if (!number || phone.length !== 10) return { error: 'Enter your order number and the 10-digit mobile number used on the order' };
  const o = await db.order.findUnique({ where: { number }, include: { customer: true, items: { include: { job: true } } } });
  const match = o && [o.customer.phone, o.shipPhone].some((p) => (p || '').replace(/\D/g, '').slice(-10) === phone);
  if (!o || !match) return { error: 'We could not find an order with that number and mobile' };
  return {
    order: {
      number: o.number, status: ORDER_STATUS_LABEL[o.status], placed: dateFmt(o.placedAt), ready: o.dueDate ? dateFmt(o.dueDate) : null,
      stages: o.status === 'IN_PRODUCTION' ? o.items.map((i) => `${i.name}: ${i.job ? STAGE_LABEL[i.job.stage] : '—'}`) : [],
      courier: o.status === 'DISPATCHED' || o.status === 'COMPLETED' ? o.courier : null, awb: o.status === 'DISPATCHED' || o.status === 'COMPLETED' ? o.awb : null,
    },
  };
}
