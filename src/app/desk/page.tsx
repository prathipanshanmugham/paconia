import Link from 'next/link';
import { db } from '@/lib/db';
import { can, requireStaff } from '@/lib/auth';
import { Badge, Empty, Notice, PageHead, Stat } from '@/components/ui';
import { CHANNEL_LABEL, ORDER_STATUS_LABEL, ORDER_TONE, STAGE_LABEL } from '@/lib/orders';
import { ago, dateShort, inr, num, qtyFmt } from '@/lib/format';
import Icon from '@/components/desk/Icon';

export const metadata = { title: 'Today' };

const startOfDay = () => { const d = new Date(Date.now() + 5.5 * 3600000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 5.5 * 3600000); };

export default async function Today({ searchParams }: { searchParams: { denied?: string } }) {
  const s = await requireStaff('today');
  const money = can(s.role, 'accounts');
  const today = startOfDay();
  const now = new Date();
  const [toProof, waiting, ready, jobs, overdue, todayOrders, todayPay, open, mats, enquiries, machines] = await Promise.all([
    db.order.findMany({ where: { status: { in: ['PLACED', 'CHANGES_REQUESTED'] } }, orderBy: { placedAt: 'asc' }, take: 8, include: { customer: true, files: { where: { kind: 'ARTWORK' }, select: { id: true } } } }),
    db.order.count({ where: { status: 'PROOF_SENT' } }),
    db.order.findMany({ where: { status: 'READY' }, orderBy: { updatedAt: 'asc' }, take: 8, include: { customer: true } }),
    db.job.groupBy({ by: ['stage'], where: { stage: { notIn: ['PREPRESS', 'DONE'] } }, _count: true }),
    db.job.findMany({ where: { stage: { notIn: ['DONE'] }, dueDate: { lt: now }, orderItem: { order: { status: { notIn: ['CANCELLED', 'COMPLETED', 'DISPATCHED'] } } } }, take: 8, orderBy: { dueDate: 'asc' }, include: { orderItem: { include: { order: true } } } }),
    db.order.findMany({ where: { placedAt: { gte: today }, status: { not: 'CANCELLED' } }, select: { total: true } }),
    db.payment.aggregate({ where: { receivedAt: { gte: today } }, _sum: { amount: true } }),
    db.order.findMany({ where: { status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } }, select: { total: true, amountPaid: true } }),
    db.material.findMany({ where: { active: true }, select: { id: true, code: true, name: true, onHand: true, reorderLevel: true, uom: true } }),
    db.enquiry.findMany({ where: { status: 'NEW' }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.machine.findMany({ where: { OR: [{ status: 'MAINTENANCE' }, { nextServiceAt: { lte: new Date(Date.now() + 7 * 86400000) } }], NOT: { status: 'RETIRED' } } }),
  ]);
  const low = mats.filter((m) => num(m.onHand) <= num(m.reorderLevel));
  const receivable = open.reduce((a, o) => a + Math.max(0, num(o.total) - num(o.amountPaid)), 0);
  const inProd = jobs.reduce((a, j) => a + j._count, 0);
  const hello = new Date(Date.now() + 5.5 * 3600000).getUTCHours() < 12 ? 'Good morning' : 'Good afternoon';

  return (
    <>
      <PageHead title={`${hello}, ${s.name.split(' ')[0]}`} sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' })}
        actions={can(s.role, 'orders') && <><Link href="/desk/orders/new" className="btn-primary"><Icon name="plus" /> New order</Link>{can(s.role, 'quotes') && <Link href="/desk/quotes/new" className="btn-secondary">New quote</Link>}</>} />
      {searchParams.denied && <div className="mb-5"><Notice tone="warn">Your role does not include {searchParams.denied}. Ask the owner if you need it.</Notice></div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Proofs to send" value={toProof.length} sub={`${waiting} waiting on customers`} tone={toProof.length ? 'warn' : undefined} href="/desk/orders?view=proof" />
        <Stat label="Jobs on machines" value={inProd} sub={jobs.map((j) => `${STAGE_LABEL[j.stage]} ${j._count}`).join(' · ') || 'Nothing running'} href="/desk/production" />
        <Stat label="Ready to hand over" value={ready.length} sub="pickup or dispatch" tone={ready.length ? 'warn' : undefined} href="/desk/orders?view=ready" />
        {money ? <Stat label="Collected today" value={inr(todayPay._sum.amount)} sub={`${todayOrders.length} orders · ${inr(todayOrders.reduce((a, o) => a + num(o.total), 0))} booked`} href="/desk/accounts?tab=payments" />
          : <Stat label="Orders today" value={todayOrders.length} />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">Proofs to prepare</h2><Link href="/desk/orders?view=proof" className="text-sm text-ink-soft hover:text-ink">All →</Link></header>
          {toProof.length ? <table className="tbl"><tbody>{toProof.map((o) => (
            <tr key={o.id} className="rowlink">
              <td><Link href={`/desk/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link><div className="text-xs text-ink-soft">{CHANNEL_LABEL[o.channel]} · {ago(o.placedAt)}</div></td>
              <td>{o.customer.company || o.customer.name}</td>
              <td>{o.status === 'CHANGES_REQUESTED' ? <Badge tone="bad">Changes asked</Badge> : o.files.length ? <Badge tone="info">Artwork in</Badge> : <Badge tone="warn">No artwork</Badge>}</td>
            </tr>))}</tbody></table> : <Empty title="All proofs are out">New orders will appear here.</Empty>}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">Ready to hand over</h2></header>
          {ready.length ? <ul className="divide-y divide-line">{ready.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
              <div><Link href={`/desk/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link> <span className="text-ink-soft">· {o.customer.company || o.customer.name}</span></div>
              <Badge tone={o.fulfilment === 'PICKUP' ? 'info' : 'good'}>{o.fulfilment === 'PICKUP' ? 'Pickup' : 'Courier'}</Badge>
            </li>))}</ul> : <Empty title="Nothing waiting">Finished jobs show here.</Empty>}
        </section>

        <section className="card overflow-hidden">
          <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">Running late</h2><Link href="/desk/production" className="text-sm text-ink-soft hover:text-ink">Board →</Link></header>
          {overdue.length ? <table className="tbl"><tbody>{overdue.map((j) => (
            <tr key={j.id}><td className="mono">{j.number}</td><td>{j.orderItem.name}<div className="text-xs text-ink-soft">{j.orderItem.order.number}</div></td><td><Badge tone="bad">{STAGE_LABEL[j.stage]}</Badge></td><td className="text-right text-xs text-rose-700">due {dateShort(j.dueDate)}</td></tr>))}</tbody></table>
            : <Empty title="Nothing overdue" />}
        </section>

        <div className="space-y-6">
          {money && <Stat label="Money to collect" value={inr(receivable)} sub={`${open.length} unpaid or part-paid orders`} tone={receivable > 0 ? 'warn' : undefined} href="/desk/accounts?tab=receivables" />}
          <section className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">New enquiries</h2><Link href="/desk/quotes?tab=enquiries" className="text-sm text-ink-soft hover:text-ink">All →</Link></header>
            {enquiries.length ? <ul className="divide-y divide-line">{enquiries.map((e) => <li key={e.id} className="px-5 py-3 text-sm"><b>{e.company || e.name}</b> · {e.product} · {e.qty}<div className="text-xs text-ink-soft">{ago(e.createdAt)} · {e.phone}</div></li>)}</ul> : <Empty title="No new enquiries" />}
          </section>
          {(low.length > 0 || machines.length > 0) && can(s.role, 'stock') && (
            <section className="card-pad">
              <h2 className="font-semibold">Needs attention</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {low.slice(0, 6).map((m) => <li key={m.id} className="flex justify-between gap-3"><Link href="/desk/stock?filter=low" className="hover:underline">{m.name}</Link><span className="num text-amber-800">{qtyFmt(m.onHand, 1)} {m.uom} left</span></li>)}
                {low.length > 6 && <li className="text-xs text-ink-soft">+{low.length - 6} more below reorder level</li>}
                {machines.map((m) => <li key={m.id} className="flex justify-between gap-3"><span>{m.name}</span><span className="text-amber-800">{m.status === 'MAINTENANCE' ? 'Under maintenance' : `Service due ${dateShort(m.nextServiceAt)}`}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      </div>
      <p className="mt-6 text-xs text-ink-faint">Order status legend: {(['PLACED', 'PROOF_SENT', 'IN_PRODUCTION', 'READY'] as const).map((st) => <span key={st} className="mr-2"><Badge tone={ORDER_TONE[st]}>{ORDER_STATUS_LABEL[st]}</Badge></span>)}</p>
    </>
  );
}
