import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireStaff, seesCost } from '@/lib/auth';
import { getBusiness } from '@/lib/settings';
import { Badge, Notice, PageHead } from '@/components/ui';
import { dateFmt, inr2 } from '@/lib/format';
import QuoteDoc from '@/components/QuoteDoc';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { convertQuote, renewQuoteAction, setQuoteStatus } from '@/app/actions/desk-quotes';
import { getPricing } from '@/lib/settings';
import { margin } from '@/lib/pricing';
import { num } from '@/lib/format';

export const metadata = { title: 'Quote' };

export default async function QuotePage({ params, searchParams }: { params: { number: string }; searchParams: { created?: string; renewed?: string; repriced?: string } }) {
  const s = await requireStaff('quotes');
  const q = await db.quote.findUnique({ where: { number: params.number }, include: { customer: true, lines: { orderBy: { sort: 'asc' } }, order: true } });
  if (!q) notFound();
  const biz = await getBusiness();
  const expired = q.status === 'EXPIRED' || (q.status !== 'ACCEPTED' && !q.orderId && q.validUntil < new Date());
  const ps = await getPricing();
  const m = margin(num(q.subtotal) - num(q.discount), num(q.cost));
  const daysLeft = Math.ceil((q.validUntil.getTime() - Date.now()) / 86400000);
  const renewForm = (
    <ActionForm action={renewQuoteAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="number" value={q.number} />
      <label className="text-sm"><span className="label">Renew for</span><select name="days" defaultValue="15" className="input w-36">{[7, 15, 30, 45, 60].map((d) => <option key={d} value={d}>{d} days</option>)}</select></label>
      <SubmitButton className="btn-secondary" pendingText="Renewing…">Renew at today’s rates</SubmitButton>
    </ActionForm>
  );
  const wa = `https://wa.me/${q.customer.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(
    `Hello ${q.customer.name}, here is Paconia quotation ${q.number}:\n` + q.lines.map((l) => `• ${l.name} × ${l.qty.toLocaleString('en-IN')} — ${inr2(l.lineTotal)}`).join('\n') + `\nTotal incl. GST: ${inr2(q.total)}\nValid until ${dateFmt(q.validUntil)}. Reply to confirm and we will send a proof.`)}`;
  return (
    <>
      <PageHead back={{ href: '/desk/quotes', label: 'Quotes' }} title={<span className="flex items-center gap-3"><span className="mono">{q.number}</span><Badge tone={q.status === 'ACCEPTED' ? 'good' : expired ? 'muted' : q.status === 'SENT' ? 'info' : q.status === 'DECLINED' ? 'bad' : 'muted'}>{expired ? 'Expired' : q.status.charAt(0) + q.status.slice(1).toLowerCase()}</Badge></span>}
        sub={`${q.customer.company || q.customer.name} · ${inr2(q.total)} · valid until ${dateFmt(q.validUntil)}`}
        actions={<><Link href={`/print/quote/${q.number}`} className="btn-secondary btn-sm">Print / PDF</Link><a href={wa} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Send on WhatsApp</a></>} />
      {searchParams.created && <div className="mb-4"><Notice tone="good">Quote saved. Print it or send it on WhatsApp, then mark it sent. It expires on its own on {dateFmt(q.validUntil)}.</Notice></div>}
      {searchParams.renewed && !expired && <div className="mb-4"><Notice tone="good">Renewed for {searchParams.renewed} days, until {dateFmt(q.validUntil)}. {Number(searchParams.repriced) ? `${searchParams.repriced} line${Number(searchParams.repriced) > 1 ? 's were' : ' was'} re-priced at today’s rates.` : 'Prices are unchanged.'}</Notice></div>}
      {expired && !q.order && <div className="mb-4"><Notice tone="warn"><b>This quote expired on {dateFmt(q.validUntil)}.</b> Renew it to re-price the items at today’s rates before turning it into an order.{renewForm}</Notice></div>}
      {!expired && !q.order && daysLeft <= 3 && <div className="mb-4"><Notice tone="info">This quote expires {daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}. Follow up with the customer, or renew it.</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto"><QuoteDoc q={q} biz={biz} /></div>
        <aside className="space-y-4">
          {seesCost(s.role) && <section className="card-pad text-sm">
            <div className="flex items-center justify-between"><h2 className="text-base">Margin</h2><span className={`badge ${m.pct < ps.minMargin ? 'tone-bad' : m.pct < ps.targetMargin ? 'tone-warn' : 'tone-good'}`}>{m.pct}%</span></div>
            <div className="num mt-3 space-y-1.5">
              <div className="flex justify-between"><span className="text-ink-soft">Selling (before GST)</span><span>{inr2(num(q.subtotal) - num(q.discount))}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Our cost</span><span>{inr2(q.cost)}</span></div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold"><span>Profit before overheads</span><span>{inr2(m.amount)}</span></div>
            </div>
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">{q.lines.map((l) => { const lm = margin(num(l.lineTotal), num(l.lineCost)); return <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="num shrink-0">{num(l.lineCost) ? `${lm.pct}%` : '—'}</span></li>; })}</ul>
            <p className="mt-2 text-xs text-ink-faint">Staff only. Not printed on the quote.</p>
          </section>}
          {q.order ? <div className="card-pad text-sm">Converted to order <Link href={`/desk/orders/${q.order.number}`} className="mono font-semibold underline">{q.order.number}</Link>.</div> : <>
            {can(s.role, 'orders') && !expired && <section className="card-pad">
              <h2 className="font-semibold">Customer accepted?</h2>
              <p className="mt-1 text-sm text-ink-soft">Create the order at these prices.</p>
              <ActionForm action={convertQuote} className="mt-3 space-y-3 text-sm">
                <input type="hidden" name="number" value={q.number} />
                <label className="block"><span className="label">Delivery</span><select name="fulfilment" className="input"><option value="PICKUP">Pickup</option><option value="COURIER">Courier to saved address</option></select></label>
                <label className="block"><span className="label">Payment</span><select name="terms" className="input" defaultValue={q.customer.creditDays > 0 ? 'CREDIT' : 'PAY_ON_PICKUP'}><option value="PAY_ON_PICKUP">Pay on delivery / pickup</option><option value="PREPAID">Paid in advance</option><option value="CREDIT">Credit</option></select></label>
                <label className="flex items-center gap-2"><input type="checkbox" name="skipProof" className="h-4 w-4 accent-leaf-600" />Artwork already approved</label>
                <SubmitButton className="btn-primary w-full" pendingText="Creating…">Create order</SubmitButton>
              </ActionForm>
            </section>}
            <section className="card-pad flex flex-wrap gap-2">
              {!expired && q.status !== 'SENT' && <form action={setQuoteStatus}><input type="hidden" name="number" value={q.number} /><input type="hidden" name="status" value="SENT" /><SubmitButton className="btn-secondary btn-sm">Mark sent</SubmitButton></form>}
              {!expired && q.status !== 'DECLINED' && <form action={setQuoteStatus}><input type="hidden" name="number" value={q.number} /><input type="hidden" name="status" value="DECLINED" /><SubmitButton className="btn-ghost btn-sm">Mark declined</SubmitButton></form>}
              <Link href={`/desk/quotes/new?customer=${q.customerId}`} className="btn-ghost btn-sm">New quote for this customer</Link>
            </section>
            {!expired && <section className="card-pad"><h2 className="text-base">Validity</h2><p className="mt-1 text-sm text-ink-soft">Valid until {dateFmt(q.validUntil)}{q.renewedAt ? `, renewed ${dateFmt(q.renewedAt)}` : ''}. It expires on its own after that.</p>{renewForm}</section>}
          </>}
        </aside>
      </div>
    </>
  );
}
