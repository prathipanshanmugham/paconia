import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import SubmitButton from '@/components/SubmitButton';
import { getCart, readCartToken } from '@/lib/cart';
import { removeCartLine } from '@/app/actions/shop';
import { computeTax } from '@/lib/gst';
import { inr, inr2 } from '@/lib/format';
import { prettySize } from '@/lib/files';
import { allMaterialInfo } from '@/lib/catalog';
import { getShipping } from '@/lib/settings';
import { unitPrice } from '@/components/site/money';
import type { Spec } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cart' };

export default async function Cart() {
  const lines = await getCart(readCartToken());
  const mats = await allMaterialInfo();
  const ship = await getShipping();
  if (!lines.length) {
    return (
      <div className="wrap max-w-xl py-20 text-center">
        <h1 className="text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-ink-soft">Choose a product to see its price and add it here.</p>
        <Link href="/shop" className="btn-primary mt-6">Shop products</Link>
      </div>
    );
  }
  const ok = lines.filter((l) => l.priced.ok);
  const sub = ok.reduce((a, l) => a + (l.priced.ok ? l.priced.total : 0), 0);
  const tax = computeTax(ok.map((l) => ({ amount: l.priced.ok ? l.priced.total : 0, gstRate: l.product.gstRate })), 0, 0, '33');
  return (
    <div className="wrap py-10">
      <h1 className="text-3xl font-bold">Cart</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card divide-y divide-line">
          {lines.map((l) => {
            const spec = l.spec as unknown as Spec;
            const m = mats[spec.material] || Object.values(mats).find((x) => x.code.startsWith(spec.material + '-'));
            const r = l.priced;
            return (
              <div key={l.id} className="grid gap-4 p-4 sm:grid-cols-[120px_1fr_auto]">
                <div className="aspect-[4/3] rounded-lg bg-mist"><ProductArt shape={l.product.shape} colour={m?.colour} w={r.ok ? r.dims.w : 60} h={r.ok ? r.dims.h : 40} d={r.ok ? r.dims.d : 40} className="h-full w-full" /></div>
                <div className="min-w-0">
                  <Link href={`/p/${l.product.slug}`} className="font-semibold hover:underline">{l.product.name}</Link>
                  {r.ok ? <p className="mt-0.5 text-sm text-ink-soft">{r.summary}</p> : <p className="mt-1 text-sm text-rose-700">{r.error}</p>}
                  {r.ok && <p className="num mt-1 text-sm">{r.qty.toLocaleString('en-IN')} pcs × {unitPrice(r.unit)}</p>}
                  {l.files.length ? <p className="mt-1 text-xs text-ink-soft">Artwork: {l.files.map((f) => `${f.name} (${prettySize(f.size)})`).join(', ')}</p> : <p className="mt-1 text-xs text-amber-800">No artwork yet. You can upload it after ordering.</p>}
                  {l.notes && <p className="mt-1 text-xs text-ink-soft">Note: {l.notes}</p>}
                </div>
                <div className="flex items-start justify-between gap-4 sm:flex-col sm:items-end">
                  <span className="num font-semibold">{r.ok ? inr(r.total) : '—'}</span>
                  <form action={removeCartLine}><input type="hidden" name="id" value={l.id} /><SubmitButton className="btn-ghost btn-sm" pendingText="Removing…">Remove</SubmitButton></form>
                </div>
              </div>
            );
          })}
        </div>
        <aside className="card-pad h-fit lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Summary</h2>
          <div className="num mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{inr2(sub)}</span></div>
            {tax.byRate.map((r) => <div key={r.rate} className="flex justify-between text-ink-soft"><span>GST {r.rate}%</span><span>{inr2(r.tax)}</span></div>)}
            <div className="flex justify-between text-ink-soft"><span>Shipping</span><span>{sub >= ship.freeAbove ? 'Free' : `from ${inr(ship.tamilNadu)}`}</span></div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Estimated total</span><span>{inr2(sub + tax.cgst + tax.sgst + tax.igst)}</span></div>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Free pickup from the studio. Courier free above {inr(ship.freeAbove)}. Final GST depends on your delivery state.</p>
          <Link href="/checkout" className={`btn-primary btn-lg mt-5 w-full ${ok.length !== lines.length ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={ok.length !== lines.length}>Checkout</Link>
          <Link href="/shop" className="btn-ghost mt-2 w-full">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
