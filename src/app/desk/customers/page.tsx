import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Empty, PageHead } from '@/components/ui';
import { dateShort, inr, num } from '@/lib/format';
import Icon from '@/components/desk/Icon';
import type { Prisma } from '@/generated/prisma/client';

export const metadata = { title: 'Customers' };

export default async function Customers({ searchParams }: { searchParams: { q?: string; type?: string } }) {
  await requireStaff('customers');
  const q = (searchParams.q || '').trim();
  const where: Prisma.CustomerWhereInput = {
    ...(searchParams.type === 'credit' ? { creditDays: { gt: 0 } } : searchParams.type === 'business' ? { type: 'BUSINESS' } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { code: { contains: q, mode: 'insensitive' } }, { gstin: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const list = await db.customer.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300, include: { orders: { where: { status: { not: 'CANCELLED' } }, select: { total: true, amountPaid: true, placedAt: true } }, user: { select: { id: true } } } });
  return (
    <>
      <PageHead title="Customers" sub={`${list.length} shown`} actions={<Link href="/desk/customers/new" className="btn-primary"><Icon name="plus" /> Add customer</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Name, business, phone, GSTIN, city" className="input max-w-xs" aria-label="Search customers" />
        <select name="type" defaultValue={searchParams.type || ''} className="input w-44" aria-label="Type"><option value="">Everyone</option><option value="business">Businesses</option><option value="credit">Credit accounts</option></select>
        <button className="btn-secondary">Filter</button>
      </form>
      <div className="card overflow-x-auto">{list.length ? (
        <table className="tbl min-w-[760px]"><thead><tr><th>Customer</th><th>Phone</th><th>City</th><th className="text-right">Orders</th><th className="text-right">Business</th><th className="text-right">Balance</th><th>Last order</th></tr></thead>
          <tbody>{list.map((c) => {
            const total = c.orders.reduce((a, o) => a + num(o.total), 0), bal = c.orders.reduce((a, o) => a + Math.max(0, num(o.total) - num(o.amountPaid)), 0);
            const last = c.orders.reduce<Date | null>((a, o) => (!a || o.placedAt > a ? o.placedAt : a), null);
            return <tr key={c.id} className="rowlink">
              <td><Link href={`/desk/customers/${c.code}`} className="font-semibold hover:underline">{c.company || c.name}</Link><div className="text-xs text-ink-soft"><span className="mono">{c.code}</span>{c.company ? ` · ${c.name}` : ''}</div>
                <div className="mt-0.5 flex gap-1">{c.gstin && <Badge tone="info">GST</Badge>}{c.creditDays > 0 && <Badge tone="good">{c.creditDays}d credit</Badge>}{c.user && <Badge tone="muted">Web</Badge>}</div></td>
              <td>{c.phone}</td><td>{c.city || '—'}</td><td className="num text-right">{c.orders.length}</td><td className="num text-right">{inr(total)}</td>
              <td className={`num text-right ${bal > 0.5 ? 'font-semibold text-amber-800' : 'text-ink-faint'}`}>{bal > 0.5 ? inr(bal) : '—'}</td><td className="text-ink-soft">{last ? dateShort(last) : '—'}</td>
            </tr>;
          })}</tbody></table>) : <Empty title="No customers found" />}</div>
    </>
  );
}
