import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireStaff } from '@/lib/auth';
import { Badge, PageHead, Stat } from '@/components/ui';
import { ORDER_STATUS_LABEL, ORDER_TONE } from '@/lib/orders';
import { dateShort, inr, inr2, num } from '@/lib/format';
import CustomerForm from '@/components/desk/CustomerForm';

export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: { code: string } }) {
  const s = await requireStaff('customers');
  const c = await db.customer.findUnique({ where: { code: params.code }, include: { orders: { orderBy: { placedAt: 'desc' }, include: { items: { select: { name: true, qty: true } } } }, quotes: { orderBy: { createdAt: 'desc' }, take: 10 }, payments: { orderBy: { receivedAt: 'desc' }, take: 10 }, user: true } });
  if (!c) notFound();
  const live = c.orders.filter((o) => o.status !== 'CANCELLED');
  const total = live.reduce((a, o) => a + num(o.total), 0);
  const bal = live.reduce((a, o) => a + Math.max(0, num(o.total) - num(o.amountPaid)), 0);
  const overdue = live.filter((o) => o.terms === 'CREDIT' && o.paymentStatus !== 'PAID' && o.dueDate && o.dueDate < new Date());
  const money = ['OWNER', 'MANAGER', 'ACCOUNTS'].includes(s.role);
  return (
    <>
      <PageHead back={{ href: '/desk/customers', label: 'Customers' }} title={c.company || c.name} sub={<><span className="mono">{c.code}</span>{c.company ? ` · ${c.name}` : ''} · {c.phone}{c.user ? ' · has a website login' : ''}</>}
        actions={<>{can(s.role, 'orders') && <Link href={`/desk/orders/new?customer=${c.id}`} className="btn-primary">New order</Link>}{can(s.role, 'quotes') && <Link href={`/desk/quotes/new?customer=${c.id}`} className="btn-secondary">New quote</Link>}</>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={live.length} />
        <Stat label="Business to date" value={inr(total)} />
        <Stat label="Balance due" value={inr(bal)} tone={bal > 0.5 ? 'warn' : undefined} sub={overdue.length ? `${overdue.length} overdue` : undefined} />
        <Stat label="Terms" value={c.creditDays > 0 ? `${c.creditDays} days` : 'Advance'} sub={num(c.creditLimit) > 0 ? `limit ${inr(c.creditLimit)}` : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="card overflow-x-auto"><h2 className="border-b border-line px-5 py-3 font-semibold">Orders</h2>
            {c.orders.length ? <table className="tbl"><tbody>{c.orders.map((o) => <tr key={o.id} className="rowlink"><td><Link href={`/desk/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link><div className="text-xs text-ink-soft">{dateShort(o.placedAt)}</div></td><td className="max-w-[260px] truncate text-sm">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</td><td><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td><td className="num text-right">{inr2(o.total)}{o.paymentStatus !== 'PAID' && o.status !== 'CANCELLED' && <div className="text-xs text-amber-800">due {inr2(num(o.total) - num(o.amountPaid))}</div>}</td></tr>)}</tbody></table> : <p className="px-5 py-6 text-sm text-ink-soft">No orders yet.</p>}
          </section>
          {c.quotes.length > 0 && <section className="card overflow-x-auto"><h2 className="border-b border-line px-5 py-3 font-semibold">Quotes</h2><table className="tbl"><tbody>{c.quotes.map((q) => <tr key={q.id}><td><Link href={`/desk/quotes/${q.number}`} className="mono hover:underline">{q.number}</Link></td><td>{dateShort(q.createdAt)}</td><td>{q.status.toLowerCase()}</td><td className="num text-right">{inr2(q.total)}</td></tr>)}</tbody></table></section>}
          {money && c.payments.length > 0 && <section className="card overflow-x-auto"><h2 className="border-b border-line px-5 py-3 font-semibold">Recent payments</h2><table className="tbl"><tbody>{c.payments.map((p) => <tr key={p.id}><td className="mono">{p.number}</td><td>{dateShort(p.receivedAt)}</td><td>{p.method}{p.reference ? ` · ${p.reference}` : ''}</td><td className="num text-right">{inr2(p.amount)}</td></tr>)}</tbody></table></section>}
        </div>
        <section className="card-pad h-fit"><h2 className="mb-4 font-semibold">Details</h2><CustomerForm c={c} money={money} /></section>
      </div>
    </>
  );
}
