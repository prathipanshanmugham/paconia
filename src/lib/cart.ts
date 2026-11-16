import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from './db';
import { materialsFor } from './catalog';
import { getPricing } from './settings';
import { price, type ProductConfig, type Spec, type PriceResult } from './pricing';

const CART = 'pc_cart';

/** Read the cart token (never sets a cookie; safe in server components). */
export function readCartToken() { return cookies().get(CART)?.value || null; }

/** Read or create the cart token. Call only from server actions or route handlers. */
export function cartToken() {
  const existing = cookies().get(CART)?.value;
  if (existing) return existing;
  const t = crypto.randomBytes(16).toString('hex');
  cookies().set(CART, t, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES, path: '/', maxAge: 60 * 60 * 24 * 60 });
  return t;
}

export type PricedLine = Awaited<ReturnType<typeof getCart>>[number];

export async function getCart(token: string | null) {
  if (!token) return [];
  const lines = await db.cartLine.findMany({ where: { cartToken: token }, include: { product: true }, orderBy: { createdAt: 'asc' } });
  const ps = await getPricing();
  const out = [];
  for (const l of lines) {
    const cfg = l.product.config as unknown as ProductConfig;
    const mats = await materialsFor(cfg);
    const r: PriceResult = price(l.product.model, cfg, l.spec as unknown as Spec, mats, ps);
    const files = l.artworkIds.length ? await db.fileAsset.findMany({ where: { id: { in: l.artworkIds } }, select: { id: true, name: true, size: true } }) : [];
    out.push({ ...l, priced: r, files });
  }
  return out;
}
