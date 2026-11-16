import { NextRequest, NextResponse } from 'next/server';
import { getSession, isStaff } from '@/lib/auth';
import { cartToken } from '@/lib/cart';
import { checkUpload, storeFile } from '@/lib/files';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/** Artwork upload. Customers (signed in or not) attach files to their cart; staff and customers can attach to an order with ?order=<number>. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'Choose a file to upload' }, { status: 400 });
  if (files.length > 10) return NextResponse.json({ error: 'Upload up to 10 files at a time' }, { status: 400 });
  const orderNo = req.nextUrl.searchParams.get('order');
  const kind = req.nextUrl.searchParams.get('kind') === 'PROOF' ? 'PROOF' : 'ARTWORK';
  let orderId: string | null = null;
  if (orderNo) {
    const o = await db.order.findUnique({ where: { number: orderNo }, include: { customer: true } });
    if (!o) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const owner = s && o.customer.userId === s.userId;
    if (!owner && !isStaff(s?.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    if (kind === 'PROOF' && !isStaff(s?.role)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    orderId = o.id;
  }
  const token = orderId ? null : cartToken();
  if (token) {
    const recent = await db.fileAsset.count({ where: { cartToken: token, createdAt: { gt: new Date(Date.now() - 86400000) } } });
    if (recent + files.length > 30) return NextResponse.json({ error: 'Upload limit reached for today. Contact us to send more files.' }, { status: 429 });
  }
  const out = [], errors: string[] = [];
  for (const f of files) {
    const bad = checkUpload(f);
    if (bad) { errors.push(bad); continue; }
    const row = await storeFile(f, { kind, uploadedById: s?.userId, cartToken: token, orderId });
    out.push({ id: row.id, name: row.name, size: row.size });
  }
  if (!out.length) return NextResponse.json({ error: errors.join(' ') || 'Upload failed' }, { status: 400 });
  return NextResponse.json({ files: out, errors });
}
