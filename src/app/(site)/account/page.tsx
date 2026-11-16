import Link from 'next/link';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Badge, Empty, Notice } from '@/components/ui';
import { ORDER_STATUS_LABEL, ORDER_TONE } from '@/lib/orders';
import { dateFmt, inr2, num } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My orders' };

export default async function Account() {
  const s = await requireUser('/account');
  const c = await db.customer.findUnique({ where: { userId: s.userId } });
  const orders = c ? await db.order.findMany({ where: { customerId: c.id }, orderBy: { placedAt: 'desc' }, include: { items: { select: { name: true, qty: true } } } }) : [];
  const toReview = orders.filter((o) => o.status === 'PROOF_SENT');
  const due = orders.filter((o) => o.status !== 'CANCELLED').reduce((a, o) => a + Math.max(0, num(o.total) - num(o.amountPaid)), 0);
  return (
    <div className="space-y-6">
      {toReview.map((o) => <Notice key={o.id} tone="info"><b>A proof is waiting for you on {o.number}.</b> Approve it and we start printing. <Link href={`/account/orders/${o.number}`} className="font-semibold underline">Review proof →</Link></Notice>)}
      {due > 0.009 && <Notice tone="warn">Balance due across your orders: <b className="num">{inr2(due)}</b></Notice>}
      <div className="card overflow-hidden">
        {orders.length ? (
          <table className="tbl">
            <thead><tr><th>Order</th><th>Placed</th><th>Items</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id} className="rowlink">
                <td><Link href={`/account/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link></td>
                <td>{dateFmt(o.placedAt)}</td>
                <td className="max-w-[280px] truncate">{o.items.map((i) => `${i.name} × ${i.qty.toLocaleString('en-IN')}`).join(', ')}</td>
                <td><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>{o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED' && <Badge tone="warn">{o.paymentStatus === 'PARTIAL' ? 'Part paid' : 'Unpaid'}</Badge>}</td>
                <td className="num text-right">{inr2(o.total)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <Empty title="No orders yet" action={<Link href="/shop" className="btn-primary">Start an order</Link>}>Your orders, proofs and invoices will show here.</Empty>}
      </div>
    </div>
  );
}
