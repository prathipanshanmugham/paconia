import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { inr2, num } from '@/lib/format';
import { paymentsDemo, razorpayKeyId, razorpayReady } from '@/lib/razorpay';
import { simulatePayment } from '@/app/actions/shop';
import RazorpayButton from '@/components/site/RazorpayButton';
import SubmitButton from '@/components/SubmitButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Payment' };

export default async function Pay({ params }: { params: { number: string } }) {
  const s = await requireUser(`/pay/${params.number}`);
  const o = await db.order.findUnique({ where: { number: params.number }, include: { customer: true, items: true } });
  if (!o || o.customer.userId !== s.userId) notFound();
  const due = num(o.total) - num(o.amountPaid);
  if (due <= 0.009 || o.status === 'CANCELLED') redirect(`/account/orders/${o.number}`);
  return (
    <div className="wrap max-w-lg py-14">
      <div className="card-pad">
        <p className="kicker">Order {o.number} placed</p>
        <h1 className="mt-1 text-2xl font-bold">Pay {inr2(due)}</h1>
        <ul className="mt-4 divide-y divide-line text-sm">{o.items.map((i) => <li key={i.id} className="flex justify-between gap-3 py-2"><span>{i.name} · {i.qty.toLocaleString('en-IN')} pcs</span><span className="num">{inr2(num(i.lineTotal))}</span></li>)}</ul>
        <p className="mt-2 text-xs text-ink-faint">Total includes GST and shipping.</p>
        <div className="mt-6">
          {razorpayReady() ? (
            <RazorpayButton number={o.number} keyId={razorpayKeyId()} name={o.customer.name} email={o.customer.email || s.email} phone={o.customer.phone || ''} label={`Pay ${inr2(due)}`} />
          ) : paymentsDemo() ? (
            <form action={simulatePayment}>
              <input type="hidden" name="number" value={o.number} />
              <SubmitButton className="btn-primary btn-lg w-full" pendingText="Processing…">Simulate payment of {inr2(due)}</SubmitButton>
              <p className="mt-2 text-center text-xs text-amber-800">Demo mode: Razorpay keys are not set, so this marks the order paid for testing.</p>
            </form>
          ) : (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Online payment is not switched on yet. We will contact you to collect payment.</p>
          )}
        </div>
        <Link href={`/account/orders/${o.number}`} className="btn-ghost mt-3 w-full">Pay later and view the order</Link>
      </div>
    </div>
  );
}
