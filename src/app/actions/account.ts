'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession, getSession } from '@/lib/auth';
import { checkGstin, stateFromPin, stateName } from '@/lib/gst';
import { nextCustomerCode } from '@/lib/numbering';
import type { FormResult } from '@/components/FormMessage';

const Profile = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid mobile number'),
  company: z.string().trim().max(120).optional(),
  gstin: z.string().trim().toUpperCase().optional(),
  line1: z.string().trim().max(200).optional(),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  pincode: z.string().trim().regex(/^(\d{6})?$/, 'Pincode must be 6 digits').optional(),
});

export async function updateProfile(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await getSession();
  if (!s) return { error: 'Please sign in again' };
  const r = Profile.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  if (f.gstin) { const g = checkGstin(f.gstin); if (!g.ok) return { error: g.error }; }
  const stateCode = f.gstin ? f.gstin.slice(0, 2) : f.pincode ? stateFromPin(f.pincode) : undefined;
  const data = {
    name: f.name, phone: f.phone, company: f.company || null, gstin: f.gstin || null, type: f.company || f.gstin ? 'BUSINESS' as const : 'INDIVIDUAL' as const,
    line1: f.line1 || null, line2: f.line2 || null, city: f.city || null, pincode: f.pincode || null,
    ...(stateCode ? { stateCode, state: stateName(stateCode) } : {}),
  };
  const u = await db.user.update({ where: { id: s.userId }, data: { name: f.name, phone: f.phone }, include: { customer: true } });
  if (u.customer) await db.customer.update({ where: { id: u.customer.id }, data });
  else await db.customer.create({ data: { ...data, code: await nextCustomerCode(), userId: u.id, email: u.email } });
  await createSession({ ...s, name: f.name });
  revalidatePath('/account', 'layout');
  return { ok: true, message: 'Details saved', t: Date.now() };
}
