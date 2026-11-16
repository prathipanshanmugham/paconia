'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { nextPoNo } from '@/lib/numbering';
import { logActivity } from '@/lib/activity';
import { addDays, num, round2 } from '@/lib/format';
import type { FormResult } from '@/components/FormMessage';

const PoIn = z.object({
  vendorId: z.string().min(1, 'Choose a vendor'), expectedDays: z.number().int().min(0).max(90), notes: z.string().max(1000).optional(),
  lines: z.array(z.object({ materialId: z.string().min(1), qty: z.number().positive('Quantities must be above zero'), rate: z.number().min(0), gstRate: z.number().refine((n) => [0, 5, 12, 18, 28].includes(n)) })).min(1, 'Add at least one material'),
  order: z.boolean(),
});

export async function createPO(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('stock');
  let raw: unknown;
  try { raw = JSON.parse(String(fd.get('payload'))); } catch { return { error: 'Could not read the form' }; }
  const r = PoIn.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  const sub = round2(f.lines.reduce((a, l) => a + l.qty * l.rate, 0));
  const gst = round2(f.lines.reduce((a, l) => a + (l.qty * l.rate * l.gstRate) / 100, 0));
  const po = await db.purchaseOrder.create({
    data: {
      number: await nextPoNo(), vendorId: f.vendorId, status: f.order ? 'ORDERED' : 'DRAFT', orderedAt: f.order ? new Date() : null, expectedAt: addDays(new Date(), f.expectedDays), notes: f.notes || null,
      subtotal: sub, gst, total: round2(sub + gst), lines: { create: f.lines.map((l) => ({ materialId: l.materialId, qty: l.qty, rate: l.rate, gstRate: l.gstRate })) },
    },
  });
  await logActivity(s, 'po', po.id, 'created', `${po.number} · ₹${po.total}`);
  revalidatePath('/desk/stock', 'layout');
  redirect(`/desk/stock/po/${po.number}`);
}

export async function setPoStatus(fd: FormData) {
  const s = await requireStaff('stock');
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { number: String(fd.get('number')) } });
  const st = String(fd.get('status'));
  if (st === 'ORDERED' && po.status === 'DRAFT') await db.purchaseOrder.update({ where: { id: po.id }, data: { status: 'ORDERED', orderedAt: new Date() } });
  if (st === 'CANCELLED' && ['DRAFT', 'ORDERED'].includes(po.status)) await db.purchaseOrder.update({ where: { id: po.id }, data: { status: 'CANCELLED' } });
  await logActivity(s, 'po', po.id, 'status', st);
  revalidatePath('/desk/stock', 'layout');
  redirect(`/desk/stock/po/${po.number}`);
}

/** Goods received note: adds what arrived to stock and closes the PO when everything is in. */
export async function receivePO(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('stock');
  const po = await db.purchaseOrder.findUnique({ where: { number: String(fd.get('number')) }, include: { lines: { include: { material: true } } } });
  if (!po) return { error: 'PO not found' };
  if (po.status !== 'ORDERED') return { error: 'Only ordered POs can be received' };
  const ref = String(fd.get('ref') || '').trim();
  let any = false;
  for (const l of po.lines) {
    const q = round2(Number(fd.get(`qty_${l.id}`) || 0));
    if (q < 0) return { error: 'Quantities cannot be negative' };
    if (q > 0 && q > num(l.qty) - num(l.receivedQty) + 0.001) return { error: `${l.material.name}: more than the quantity still due` };
  }
  for (const l of po.lines) {
    const q = round2(Number(fd.get(`qty_${l.id}`) || 0));
    if (!q) continue;
    any = true;
    await db.$transaction([
      db.purchaseLine.update({ where: { id: l.id }, data: { receivedQty: { increment: q } } }),
      db.material.update({ where: { id: l.materialId }, data: { onHand: { increment: q }, cost: l.rate } }),
      db.stockMove.create({ data: { materialId: l.materialId, qty: q, type: 'PURCHASE', ref: po.number, note: ref ? `Vendor bill ${ref}` : 'Received', userId: s.userId } }),
    ]);
  }
  if (!any) return { error: 'Enter the quantity received for at least one line' };
  const fresh = await db.purchaseLine.findMany({ where: { poId: po.id } });
  if (fresh.every((l) => num(l.receivedQty) + 0.001 >= num(l.qty))) await db.purchaseOrder.update({ where: { id: po.id }, data: { status: 'RECEIVED', receivedAt: new Date() } });
  await logActivity(s, 'po', po.id, 'received', ref || undefined);
  revalidatePath('/desk/stock', 'layout');
  return { ok: true, message: 'Stock updated', t: Date.now() };
}
