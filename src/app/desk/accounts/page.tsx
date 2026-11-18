import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Empty, PageHead, Stat, Tabs } from '@/components/ui';
import { dateShort, inr, inr2, isoDate, num } from '@/lib/format';
import { monthRange } from '@/lib/period';
import { gstSummary } from '@/lib/gstReport';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { addExpense, deleteExpense } from '@/app/actions/desk-admin';
import { margin } from '@/lib/pricing';
import { getPricing } from '@/lib/settings';

export const metadata = { title: 'Accounts' };
const TABS = ['overview', 'margins', 'invoices', 'payments', 'receivables', 'expenses', 'gst'] as const;
const LABEL: Record<(typeof TABS)[number], string> = { overview: 'Overview', margins: 'Margins', invoices: 'Invoices', payments: 'Payments', receivables: 'Receivables', expenses: 'Expenses', gst: 'GST summary' };
const EXP_CATS = ['Rent', 'Electricity', 'Salaries', 'Toner & consumables', 'Courier', 'Machine service', 'Packing material', 'Internet & phone', 'Marketing', 'Transport', 'Other'];

export default async function Accounts({ searchParams }: { searchParams: { tab?: string; month?: string } }) {
  const s = await requireStaff('accounts');
  const tab = (TABS as readonly string[]).includes(searchParams.tab || '') ? (searchParams.tab as (typeof TABS)[number]) : 'overview';
  const p = monthRange(searchParams.month);
  const link = (t: string, m = p.ym) => `/desk/accounts?tab=${t}&month=${m}`;
  const monthNav = (
    <div className="flex items-center gap-2 text-sm"><Link href={link(tab, p.prev)} className="btn-ghost btn-sm" aria-label="Previous month">←</Link><span className="min-w-[120px] text-center font-semibold">{p.label}</span><Link href={link(tab, p.next)} className="btn-ghost btn-sm" aria-label="Next month">→</Link></div>
  );
  return (
    <>
      <PageHead title="Accounts" actions={tab !== 'receivables' && monthNav} />
      <Tabs current={link(tab)} items={TABS.map((t) => ({ href: link(t), label: LABEL[t] }))} />
      {tab === 'overview' && <Overview start={p.start} end={p.end} />}
      {tab === 'margins' && <Margins start={p.start} end={p.end} />}
      {tab === 'invoices' && <Invoices start={p.start} end={p.end} ym={p.ym} />}
      {tab === 'payments' && <Payments start={p.start} end={p.end} ym={p.ym} />}
      {tab === 'receivables' && <Receivables />}
      {tab === 'expenses' && <Expenses start={p.start} end={p.end} ym={p.ym} canDelete={['OWNER', 'MANAGER'].includes(s.role)} />}
      {tab === 'gst' && <Gst start={p.start} end={p.end} ym={p.ym} />}
    </>
  );
}

async function Overview({ start, end }: { start: Date; end: Date }) {
  const [orders, pays, exps, pos, g] = await Promise.all([
    db.order.findMany({ where: { placedAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, select: { taxable: true, total: true, channel: true } }),
    db.payment.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.expense.findMany({ where: { date: { gte: start, lt: end } }, select: { amount: true, gst: true, category: true } }),
    db.purchaseOrder.aggregate({ where: { receivedAt: { gte: start, lt: end }, status: 'RECEIVED' }, _sum: { subtotal: true } }),
    gstSummary(start, end),
  ]);
  const sales = orders.reduce((a, o) => a + num(o.taxable), 0);
  const expNet = exps.reduce((a, e) => a + num(e.amount) - num(e.gst), 0);
  const buy = num(pos._sum.subtotal);
  const byChannel = (['ONLINE', 'COUNTER', 'B2B'] as const).map((c) => ({ c, v: orders.filter((o) => o.channel === c).reduce((a, o) => a + num(o.taxable), 0) }));
  const byCat = Object.entries(exps.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] || 0) + num(e.amount) }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sales booked (before GST)" value={inr(sales)} sub={`${orders.length} orders`} />
        <Stat label="Money received" value={inr(pays._sum.amount)} />
        <Stat label="Spent (stock + expenses)" value={inr(buy + expNet)} sub={`stock ${inr(buy)} · expenses ${inr(expNet)}`} />
        <Stat label="Rough margin" value={inr(sales - buy - expNet)} tone={sales - buy - expNet < 0 ? 'bad' : undefined} sub="sales − purchases − expenses" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card-pad"><h2 className="font-semibold">Sales by channel</h2><ul className="mt-3 space-y-2 text-sm">{byChannel.map(({ c, v }) => <li key={c} className="flex justify-between"><span>{c === 'ONLINE' ? 'Website' : c === 'COUNTER' ? 'Walk-in' : 'B2B'}</span><span className="num">{inr(v)}</span></li>)}</ul></section>
        <section className="card-pad"><h2 className="font-semibold">GST this month</h2><ul className="mt-3 space-y-2 text-sm"><li className="flex justify-between"><span>Output tax (invoices)</span><span className="num">{inr2(g.outputTax)}</span></li><li className="flex justify-between"><span>Input tax (bills recorded)</span><span className="num">{inr2(g.inputTax)}</span></li><li className="flex justify-between border-t border-line pt-2 font-semibold"><span>Estimated payable</span><span className="num">{inr2(Math.max(0, g.outputTax - g.inputTax))}</span></li></ul><p className="mt-2 text-xs text-ink-faint">Estimate only. Your CA files the actual return.</p></section>
        <section className="card-pad"><h2 className="font-semibold">Expenses by type</h2>{byCat.length ? <ul className="mt-3 space-y-2 text-sm">{byCat.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="num">{inr(v)}</span></li>)}</ul> : <p className="mt-3 text-sm text-ink-soft">None recorded.</p>}</section>
      </div>
    </div>
  );
}

async function Invoices({ start, end, ym }: { start: Date; end: Date; ym: string }) {
  const list = await db.invoice.findMany({ where: { issuedAt: { gte: start, lt: end } }, orderBy: { issuedAt: 'desc' }, include: { order: true } });
  return (
    <>
      <div className="mb-3 flex justify-end"><a href={`/desk/accounts/export?type=invoices&month=${ym}`} className="btn-secondary btn-sm">Download CSV</a></div>
      <div className="card overflow-x-auto">{list.length ? <table className="tbl min-w-[820px]"><thead><tr><th>Invoice</th><th>Date</th><th>Bill to</th><th>Order</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th><th>Due</th></tr></thead>
        <tbody>{list.map((i) => <tr key={i.id} className={i.cancelled ? 'opacity-50' : 'rowlink'}><td><Link href={`/print/invoice/${i.id}`} className="mono font-semibold hover:underline">{i.number}</Link>{i.cancelled && <Badge tone="bad">Cancelled</Badge>}</td><td>{dateShort(i.issuedAt)}</td><td>{i.billName}{i.billGstin && <div className="mono text-xs text-ink-soft">{i.billGstin}</div>}</td><td><Link href={`/desk/orders/${i.order.number}`} className="mono text-sm hover:underline">{i.order.number}</Link></td><td className="num text-right">{inr2(i.taxable)}</td><td className="num text-right">{inr2(num(i.cgst) + num(i.sgst) + num(i.igst))}</td><td className="num text-right">{inr2(i.total)}</td><td>{i.order.paymentStatus === 'PAID' ? <Badge tone="good">Paid</Badge> : <span className={i.dueDate < new Date() ? 'text-rose-700' : ''}>{dateShort(i.dueDate)}</span>}</td></tr>)}</tbody></table>
        : <Empty title="No invoices this month">Invoices are created from an order (Create invoice), or automatically when an order is handed over.</Empty>}</div>
    </>
  );
}

async function Payments({ start, end, ym }: { start: Date; end: Date; ym: string }) {
  const list = await db.payment.findMany({ where: { receivedAt: { gte: start, lt: end } }, orderBy: { receivedAt: 'desc' }, include: { customer: true, order: true } });
  const by = list.reduce<Record<string, number>>((a, p) => ({ ...a, [p.method]: (a[p.method] || 0) + num(p.amount) }), {});
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{Object.entries(by).map(([m, v]) => <span key={m} className="chip">{m === 'RAZORPAY' ? 'Online' : m} <b className="num ml-1">{inr(v)}</b></span>)}</div><a href={`/desk/accounts/export?type=payments&month=${ym}`} className="btn-secondary btn-sm">Download CSV</a></div>
      <div className="card overflow-x-auto">{list.length ? <table className="tbl min-w-[720px]"><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Order</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{list.map((p) => <tr key={p.id}><td className="mono">{p.number}</td><td>{dateShort(p.receivedAt)}</td><td>{p.customer.company || p.customer.name}</td><td>{p.order && <Link href={`/desk/orders/${p.order.number}`} className="mono text-sm hover:underline">{p.order.number}</Link>}</td><td>{p.method === 'RAZORPAY' ? 'Online' : p.method}{p.reference ? <div className="text-xs text-ink-soft">{p.reference}</div> : null}</td><td className="num text-right">{inr2(p.amount)}</td></tr>)}</tbody></table> : <Empty title="No payments this month" />}</div>
    </>
  );
}

async function Receivables() {
  const orders = await db.order.findMany({ where: { status: { not: 'CANCELLED' }, paymentStatus: { not: 'PAID' } }, include: { customer: true, invoices: { where: { cancelled: false } } }, orderBy: { placedAt: 'asc' } });
  const now = Date.now();
  const rows = orders.map((o) => {
    const due = num(o.total) - num(o.amountPaid);
    const dueOn = o.invoices[0]?.dueDate || o.dueDate || o.placedAt;
    const days = Math.floor((now - dueOn.getTime()) / 86400000);
    return { o, due, dueOn, days };
  }).filter((r) => r.due > 0.5);
  const bucket = (d: number) => (d <= 0 ? 'Not yet due' : d <= 15 ? '1–15 days late' : d <= 30 ? '16–30 days late' : 'Over 30 days late');
  const buckets = ['Not yet due', '1–15 days late', '16–30 days late', 'Over 30 days late'].map((b) => ({ b, v: rows.filter((r) => bucket(r.days) === b).reduce((a, r) => a + r.due, 0) }));
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{buckets.map(({ b, v }, i) => <Stat key={b} label={b} value={inr(v)} tone={i >= 2 && v > 0 ? 'bad' : i === 1 && v > 0 ? 'warn' : undefined} />)}</div>
      <div className="card overflow-x-auto">{rows.length ? <table className="tbl min-w-[720px]"><thead><tr><th>Order</th><th>Customer</th><th>Terms</th><th>Due on</th><th className="text-right">Balance</th><th></th></tr></thead>
        <tbody>{rows.sort((a, b) => b.days - a.days).map(({ o, due, dueOn, days }) => <tr key={o.id} className="rowlink"><td><Link href={`/desk/orders/${o.number}`} className="mono font-semibold hover:underline">{o.number}</Link></td><td>{o.customer.company || o.customer.name}<div className="text-xs text-ink-soft">{o.customer.phone}</div></td><td>{o.terms === 'CREDIT' ? 'Credit' : o.terms === 'PREPAID' ? 'Advance' : 'On delivery'}</td><td className={days > 0 ? 'font-semibold text-rose-700' : ''}>{dateShort(dueOn)}{days > 0 && <div className="text-xs font-normal">{days} days late</div>}</td><td className="num text-right">{inr2(due)}</td>
          <td className="text-right"><a className="btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${o.customer.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hello ${o.customer.name}, a gentle reminder from Paconia: ₹${due.toLocaleString('en-IN', { maximumFractionDigits: 2 })} is due on order ${o.number}. Thank you!`)}`}>Remind</a></td></tr>)}</tbody></table> : <Empty title="Nothing to collect">Every order is paid.</Empty>}</div>
    </>
  );
}

async function Expenses({ start, end, ym, canDelete }: { start: Date; end: Date; ym: string; canDelete: boolean }) {
  const list = await db.expense.findMany({ where: { date: { gte: start, lt: end } }, orderBy: { date: 'desc' } });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex justify-end"><a href={`/desk/accounts/export?type=expenses&month=${ym}`} className="btn-secondary btn-sm">Download CSV</a></div>
        <div className="card overflow-x-auto">{list.length ? <table className="tbl min-w-[620px]"><thead><tr><th>Date</th><th>Expense</th><th>Paid by</th><th className="text-right">GST</th><th className="text-right">Amount</th>{canDelete && <th />}</tr></thead>
          <tbody>{list.map((e) => <tr key={e.id}><td>{dateShort(e.date)}</td><td><b>{e.category}</b><div className="text-sm text-ink-soft">{e.description}</div></td><td>{e.method}{e.reference ? <div className="text-xs text-ink-soft">{e.reference}</div> : null}</td><td className="num text-right">{num(e.gst) ? inr2(e.gst) : '—'}</td><td className="num text-right">{inr2(e.amount)}</td>
            {canDelete && <td><form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><SubmitButton className="btn-ghost btn-sm text-xs" confirm="Delete this expense?" pendingText="…">Delete</SubmitButton></form></td>}</tr>)}</tbody></table> : <Empty title="No expenses this month" />}</div>
      </div>
      <section className="card-pad h-fit"><h2 className="mb-3 font-semibold">Add expense</h2>
        <ActionForm action={addExpense} className="space-y-3" resetOnOk>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm"><span className="label">Date</span><input type="date" name="date" defaultValue={isoDate(new Date())} className="input" /></label><label className="text-sm"><span className="label">Type</span><select name="category" className="input">{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></label></div>
          <label className="block text-sm"><span className="label">Description</span><input name="description" required className="input" placeholder="e.g. EB bill Oct, toner black 2 nos" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm"><span className="label">Amount ₹ (total)</span><input type="number" step="0.01" min="0" name="amount" required className="input" /></label><label className="text-sm"><span className="label">GST in it ₹</span><input type="number" step="0.01" min="0" name="gst" className="input" placeholder="0" /></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm"><span className="label">Paid by</span><select name="method" className="input">{['BANK', 'UPI', 'CASH', 'CARD', 'CHEQUE'].map((m) => <option key={m}>{m}</option>)}</select></label><label className="text-sm"><span className="label">Bill / ref</span><input name="reference" className="input" /></label></div>
          <SubmitButton className="btn-primary w-full">Add expense</SubmitButton>
        </ActionForm></section>
    </div>
  );
}

async function Gst({ start, end, ym }: { start: Date; end: Date; ym: string }) {
  const g = await gstSummary(start, end);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Taxable value" value={inr2(g.taxable)} sub={`${g.invoices.length} invoices`} />
        <Stat label="CGST + SGST" value={inr2(g.cgst + g.sgst)} sub="within Tamil Nadu" />
        <Stat label="IGST" value={inr2(g.igst)} sub="other states" />
        <Stat label="Estimated payable" value={inr2(Math.max(0, g.outputTax - g.inputTax))} sub={`output ${inr(g.outputTax)} − input ${inr(g.inputTax)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto"><h2 className="border-b border-line px-5 py-3 font-semibold">By rate</h2><table className="tbl"><thead><tr><th>Rate</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead><tbody>{g.byRate.map((r) => <tr key={r.rate}><td>{r.rate}%</td><td className="num text-right">{inr2(r.taxable)}</td><td className="num text-right">{inr2(r.tax)}</td></tr>)}<tr className="font-semibold"><td>B2B (with GSTIN)</td><td className="num text-right">{inr2(g.b2b)}</td><td /></tr><tr className="font-semibold"><td>B2C</td><td className="num text-right">{inr2(g.b2c)}</td><td /></tr></tbody></table></section>
        <section className="card overflow-x-auto"><div className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">HSN summary</h2><a href={`/desk/accounts/export?type=hsn&month=${ym}`} className="btn-ghost btn-sm">CSV</a></div><table className="tbl"><thead><tr><th>HSN</th><th>Rate</th><th className="text-right">Qty</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead><tbody>{g.hsn.map((h) => <tr key={h.hsn + h.rate}><td className="mono">{h.hsn}</td><td>{h.rate}%</td><td className="num text-right">{h.qty.toLocaleString('en-IN')}</td><td className="num text-right">{inr2(h.taxable)}</td><td className="num text-right">{inr2(h.tax)}</td></tr>)}</tbody></table></section>
      </div>
      <p className="text-xs text-ink-faint">Built from invoices issued in the month (cancelled invoices excluded). Input tax counts GST entered on expenses and on received purchase orders. Share the CSVs with your CA for GSTR-1 and GSTR-3B.</p>
    </div>
  );
}

async function Margins({ start, end }: { start: Date; end: Date }) {
  const [orders, ps] = await Promise.all([
    db.order.findMany({ where: { placedAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, include: { customer: true, items: true }, orderBy: { placedAt: 'desc' } }),
    getPricing(),
  ]);
  const costed = orders.filter((o) => num(o.cost) > 0);
  const sales = costed.reduce((a, o) => a + num(o.subtotal) - num(o.discount), 0), cost = costed.reduce((a, o) => a + num(o.cost), 0);
  const m = margin(sales, cost);
  const by = new Map<string, { sales: number; cost: number; qty: number }>();
  for (const o of costed) for (const i of o.items) { if (!num(i.lineCost)) continue; const r = by.get(i.name) || { sales: 0, cost: 0, qty: 0 }; r.sales += num(i.lineTotal); r.cost += num(i.lineCost); r.qty += i.qty; by.set(i.name, r); }
  const tone = (pct: number) => (pct < ps.minMargin ? 'bad' : pct < ps.targetMargin ? 'warn' : 'good') as 'bad' | 'warn' | 'good';
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sales with costs recorded" value={inr(sales)} sub={`${costed.length} of ${orders.length} orders`} />
        <Stat label="Our cost" value={inr(cost)} />
        <Stat label="Profit before overheads" value={inr(m.amount)} />
        <Stat label="Margin" value={`${m.pct}%`} tone={m.pct < ps.minMargin ? 'bad' : m.pct < ps.targetMargin ? 'warn' : undefined} sub={`target ${ps.targetMargin}%, minimum ${ps.minMargin}%`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card overflow-x-auto"><div className="panel-head"><h2 className="text-base">By product</h2></div>
          {by.size ? <table className="tbl"><thead><tr><th>Product</th><th className="text-right">Pieces</th><th className="text-right">Sales</th><th className="text-right">Cost</th><th className="text-right">Margin</th></tr></thead>
            <tbody>{[...by.entries()].sort((a, b) => b[1].sales - a[1].sales).map(([k, v]) => { const mm = margin(v.sales, v.cost); return <tr key={k}><td>{k}</td><td className="num text-right">{v.qty.toLocaleString('en-IN')}</td><td className="num text-right">{inr(v.sales)}</td><td className="num text-right">{inr(v.cost)}</td><td className="text-right"><Badge tone={tone(mm.pct)}>{mm.pct}%</Badge></td></tr>; })}</tbody></table>
            : <Empty title="No costed orders this month" />}</section>
        <section className="card overflow-x-auto"><div className="panel-head"><h2 className="text-base">By order</h2></div>
          {costed.length ? <table className="tbl"><thead><tr><th>Order</th><th>Customer</th><th className="text-right">Sales</th><th className="text-right">Margin</th></tr></thead>
            <tbody>{costed.map((o) => { const mm = margin(num(o.subtotal) - num(o.discount), num(o.cost)); return <tr key={o.id} className="rowlink"><td><Link href={`/desk/orders/${o.number}`} className="mono hover:underline">{o.number}</Link><div className="text-xs text-ink-faint">{dateShort(o.placedAt)}</div></td><td>{o.customer.company || o.customer.name}</td><td className="num text-right">{inr(num(o.subtotal) - num(o.discount))}</td><td className="text-right"><Badge tone={tone(mm.pct)}>{mm.pct}%</Badge></td></tr>; })}</tbody></table>
            : <Empty title="No costed orders this month" />}</section>
      </div>
      <p className="text-xs text-ink-faint">Cost = materials at cost price plus printing, film, cutting, laser and setup costs from Prices, costs &amp; margins. Overheads such as rent and salaries are in Expenses. Orders made before costing was added are left out.</p>
    </div>
  );
}
