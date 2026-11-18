import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, isStaff } from '@/lib/auth';
import { readCartToken } from '@/lib/cart';
import { readStored } from '@/lib/files';

export const runtime = 'nodejs';
const PHOTO_MIME = /^image\/(png|jpeg|webp)$/;

/** Streams an uploaded file to staff, the customer who owns the order, or the visitor whose cart it belongs to. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const f = await db.fileAsset.findUnique({ where: { id: params.id }, include: { order: { include: { customer: true } } } });
  if (!f) return new NextResponse('Not found', { status: 404 });
  // product photos are public catalogue images (raster only)
  if (f.kind === 'PRODUCT' && f.productId && PHOTO_MIME.test(f.mime)) {
    try {
      const buf = await readStored(f.path);
      return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': f.mime, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    } catch { return new NextResponse('File missing', { status: 410 }); }
  }
  const s = await getSession();
  const allowed = isStaff(s?.role) || (s && f.order?.customer.userId === s.userId) || (f.cartToken && f.cartToken === readCartToken()) || (s && f.uploadedById === s.userId);
  if (!allowed) return new NextResponse('Not allowed', { status: 403 });
  try {
    const buf = await readStored(f.path);
    const inline = /^(image\/(png|jpe?g|webp|gif|svg\+xml)|application\/pdf)$/.test(f.mime) && req.nextUrl.searchParams.get('download') !== '1';
    const safeName = f.name.replace(/[^\w.\- ]+/g, '_');
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': inline ? f.mime : 'application/octet-stream',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return new NextResponse('File missing', { status: 410 });
  }
}
