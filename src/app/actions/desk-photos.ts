'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { removeStored, storeFile } from '@/lib/files';
import type { FormResult } from '@/components/FormMessage';

const MAX_PHOTOS = 8;
const PHOTO = /^image\/(png|jpeg|webp)$/;

/** Adds real product photos. They show beside the 3D preview on the website and on product cards. */
export async function addProductPhotos(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('catalogue');
  const p = await db.product.findUnique({ where: { id: String(fd.get('productId') || '') }, include: { photos: { select: { sort: true } } } });
  if (!p) return { error: 'Product not found' };
  const files = fd.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: 'Choose one or more photos' };
  if (p.photos.length + files.length > MAX_PHOTOS) return { error: `A product can have up to ${MAX_PHOTOS} photos. Remove some first.` };
  for (const f of files) {
    if (!PHOTO.test(f.type)) return { error: `${f.name}: use JPG, PNG or WebP` };
    if (f.size > 8 * 1024 * 1024) return { error: `${f.name}: photos must be under 8 MB` };
  }
  let sort = p.photos.reduce((m, x) => Math.max(m, x.sort), -1) + 1;
  for (const f of files) await storeFile(f, { kind: 'PRODUCT', uploadedById: s.userId, productId: p.id, sort: sort++ });
  await logActivity(s, 'product', p.id, 'photos added', `${files.length} photo${files.length > 1 ? 's' : ''}`);
  revalidatePath('/', 'layout');
  return { ok: true, message: `${files.length} photo${files.length > 1 ? 's' : ''} added`, t: Date.now() };
}

export async function removeProductPhoto(fd: FormData) {
  const s = await requireStaff('catalogue');
  const f = await db.fileAsset.findFirst({ where: { id: String(fd.get('id') || ''), kind: 'PRODUCT' } });
  if (!f?.productId) return;
  await db.fileAsset.delete({ where: { id: f.id } });
  await removeStored(f.path);
  await logActivity(s, 'product', f.productId, 'photo removed', f.name);
  revalidatePath('/', 'layout');
}

/** Moves a photo to the front, making it the cover on product cards. */
export async function makeCoverPhoto(fd: FormData) {
  const s = await requireStaff('catalogue');
  const f = await db.fileAsset.findFirst({ where: { id: String(fd.get('id') || ''), kind: 'PRODUCT' } });
  if (!f?.productId) return;
  const all = await db.fileAsset.findMany({ where: { productId: f.productId, kind: 'PRODUCT' }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] });
  const order = [f, ...all.filter((x) => x.id !== f.id)];
  await db.$transaction(order.map((x, i) => db.fileAsset.update({ where: { id: x.id }, data: { sort: i } })));
  await logActivity(s, 'product', f.productId, 'cover photo set', f.name);
  revalidatePath('/', 'layout');
}
