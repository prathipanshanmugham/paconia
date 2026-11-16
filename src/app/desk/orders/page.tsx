import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Empty, PageHead, Tabs } from '@/components/ui';
import { CHANNEL_LABEL, ORDER_STATUS_LABEL, ORDER_TONE } from '@/lib/orders';
import { dateShort, inr2, num } from '@/lib/format';
import Icon from '@/components/desk/Icon';
import type { OrderStatus, Prisma } from '@/generated/prisma/client';

export const metadata = { title: 'Orders' };

const VIEWS: Record<string, { label: string; statuses?: OrderStatus[] }> = {
  open: { label: 'Open', statuses: ['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'READY'] },
  proof: { label: 'Needs proof', statuses: ['PLACED', 'CHANGES_REQUESTED'] },
  waiting: { label: 'Awaiting approval', statuses: ['PROOF_SENT'] },
  production: { label: 'In production', statuses: ['APPROVED', 'IN_PRODUCTION'] },
  ready: { label: 'Ready', statuses: ['READY'] },
  done: { label: 'Dispatched & done', statuses: ['DISPATCHED', 'COMPLETED'] },
  cancelled: { label: 'Cancelled', statuses: ['CANCELLED'] },
  all: { label: 'All' },
};

export default async function Orders({ searchParams }: { searchParams: { view?: string; q?: string; channel?: string; unpaid?: string } }) {
  await requireStaff('orders');
  const view = VIEWS[searchParams.view || 'open'] ? searchParams.view || 'open' : 'open';
  const q = (searchParams.q || '').trim();
  const where: Prisma.OrderWhereInput = {
    ...(VIEWS[view].statuses ? { status: { in: VIEWS[view].statuses } } : {}),
    ...(searchParams.channel && ['ONLINE', 'B2B', 'COUNTER'].includes(searchParams.channel) ? { channel: searchParams.channel as 'ONLINE' } : {}),
    ...(searchParams.unpaid ? { paymentStatus: { not: 'PAID' } } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { name: { contains: q, mode: 'insensitive' } } }, { customer: { company: { contains: q, mode: 'insensitive' } } }, { customer: { phone: { contains: q } } }, { items: { some: { name: { contains: q, mode: 'insensitive' } } } }] } : {}),
  };
  const [orders, counts] = await Promise.all([
    db.order.findMany({ where, orderBy: { placedAt: 'desc' }, take: 200, include: { customer: true, items: { select: { name: true, qty: true } } } }),
    db.order.groupBy({ by: ['status'], _count: true }),
  ]);
  const count = (st?: OrderStatus[]) => counts.filter((c) => !st || st.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const qs = (v: string) => `/desk/orders?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  return (
    <>
      <PageHead title="Orders" actions={<Link href="/desk/orders/new" className="btn-primary"><Icon name="plus" /> New order</Link>} />
      <Tabs current={qs(view)} items={Object.entries(VIEWS).map(([k, v]) => ({ href: qs(k), label: v.label, count: k === 'all' || k === 'cancelled' || k === 'done' ? undefined : count(v.statuses) }))} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        <input name="q" defaultValue={q} placeholder="Order no., customer, phone or product" className="input max-w-xs" aria-label="Search orders" />
        <select name="channel" defaultValue={searchParams.channel || ''} className="input w-40" aria-label="Channel"><option value="">All channels</option><option value="ONLINE">Website</option><option value="COUNTER">Walk-in</option><option value="B2B">B2B</option></select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unpaid" value="1" defaultChecked={!!searchParams.unpaid} className="h-4 w-4 accent-leaf-600" />Unpaid only</label>
        <button className="btn-secondary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        {orders.length ? (
          <table className="tbl min-w-[860px]">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th>Due</th><th className="text-right">Total</th></tr></thead>
            <tbody>{orders.map((o) => {
              const late = o.dueDate && o.dueDate < new Date() && !['DISPATCHED', 'COMPLETED', 'CANCELLED', 'READY'].includes(o.status);
              return (
                <tr key={o.id} className="rowlink">
                  <td><Link href={`/desk/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link><div className="text-xs text-ink-soft">{CHANNEL_LABEL[o.channel]} · {dateShort(o.placedAt)}</div></td>
                  <td>{o.customer.company || o.customer.name}<div className="text-xs text-ink-soft">{o.customer.phone}</div></td>
                  <td className="max-w-[240px] truncate text-sm">{o.items.map((i) => `${i.name} ×${i.qty.toLocaleString('en-IN')}`).join(', ')}</td>
                  <td><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td>{o.status === 'CANCELLED' ? '—' : <Badge tone={o.paymentStatus === 'PAID' ? 'good' : o.paymentStatus === 'PARTIAL' ? 'warn' : o.terms === 'CREDIT' ? 'info' : 'bad'}>{o.paymentStatus === 'PAID' ? 'Paid' : o.paymentStatus === 'PARTIAL' ? 'Part paid' : o.terms === 'CREDIT' ? 'Credit' : 'Unpaid'}</Badge>}</td>
                  <td className={late ? 'font-semibold text-rose-700' : 'text-ink-soft'}>{dateShort(o.dueDate)}</td>
                  <td className="num text-right">{inr2(o.total)}{num(o.amountPaid) > 0 && o.paymentStatus !== 'PAID' && <div className="text-xs text-ink-soft">bal {inr2(num(o.total) - num(o.amountPaid))}</div>}</td>
                </tr>
              );
            })}</tbody>
          </table>
        ) : <Empty title="No orders here" action={<Link href="/desk/orders/new" className="btn-secondary">New order</Link>}>{q ? 'Try a different search.' : 'Orders in this view will show here.'}</Empty>}
      </div>
    </>
  );
}
