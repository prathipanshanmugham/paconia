import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getCart, readCartToken } from '@/lib/cart';
import { getBusiness, getShipping } from '@/lib/settings';
import { paymentsDemo, razorpayReady } from '@/lib/razorpay';
import CheckoutForm from '@/components/site/CheckoutForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checkout' };

export default async function Checkout() {
  const s = await requireUser('/checkout');
  const lines = await getCart(readCartToken());
  if (!lines.length) redirect('/cart');
  const c = await db.customer.findUnique({ where: { userId: s.userId } });
  const ship = await getShipping();
  const b = await getBusiness();
  const items = lines.filter((l) => l.priced.ok).map((l) => ({ name: l.product.name, summary: l.priced.ok ? l.priced.summary : '', qty: l.priced.ok ? l.priced.qty : 0, total: l.priced.ok ? l.priced.total : 0, gstRate: l.product.gstRate }));
  return (
    <div className="wrap py-10">
      <h1 className="text-3xl font-bold">Checkout</h1>
      <CheckoutForm
        items={items} shipping={ship} pickupAddress={`${b.address}, ${b.city} ${b.pincode}`}
        online={razorpayReady() || paymentsDemo()} credit={!!c && c.creditDays > 0}
        initial={{ name: c?.name || s.name, phone: c?.phone || '', company: c?.company || '', gstin: c?.gstin || '', line1: c?.line1 || '', line2: c?.line2 || '', city: c?.city || '', pincode: c?.pincode || '', stateCode: c?.stateCode || '33' }}
      />
    </div>
  );
}
