import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireStaff } from '@/lib/auth';
import { getBusiness } from '@/lib/settings';
import { Badge, Notice, PageHead } from '@/components/ui';
import { dateFmt, inr2 } from '@/lib/format';
import QuoteDoc from '@/components/QuoteDoc';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { convertQuote, setQuoteStatus } from '@/app/actions/desk-quotes';

export const metadata = { title: 'Quote' };

export default async function QuotePage({ params, searchParams }: { params: { number: string }; searchParams: { created?: string } }) {
  const s = await requireStaff('quotes');
  const q = await db.quote.findUnique({ where: { number: params.number }, include: { customer: true, lines: { orderBy: { sort: 'asc' } }, order: true } });
  if (!q) notFound();
  const biz = await getBusiness();
  const expired = q.status !== 'ACCEPTED' && q.validUntil < new Date();
  const wa = `https://wa.me/${q.customer.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(
    `Hello ${q.customer.name}, here is Paconia quotation ${q.number}:\n` + q.lines.map((l) => `• ${l.name} × ${l.qty.toLocaleString('en-IN')} — ${inr2(l.lineTotal)}`).join('\n') + `\nTotal incl. GST: ${inr2(q.total)}\nValid until ${dateFmt(q.validUntil)}. Reply to confirm and we will send a proof.`)}`;
  return (
    <>
      <PageHead back={{ href: '/desk/quotes', label: 'Quotes' }} title={<span className="flex items-center gap-3"><span className="mono">{q.number}</span><Badge tone={q.status === 'ACCEPTED' ? 'good' : expired ? 'muted' : q.status === 'SENT' ? 'info' : q.status === 'DECLINED' ? 'bad' : 'muted'}>{expired ? 'Expired' : q.status.charAt(0) + q.status.slice(1).toLowerCase()}</Badge></span>}
        sub={`${q.customer.company || q.customer.name} · ${inr2(q.total)} · valid until ${dateFmt(q.validUntil)}`}
        actions={<><Link href={`/print/quote/${q.number}`} className="btn-secondary btn-sm">Print / PDF</Link><a href={wa} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">Send on WhatsApp</a></>} />
      {searchParams.created && <div className="mb-4"><Notice tone="good">Quote saved. Print it or send it on WhatsApp, then mark it sent.</Notice></div>}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto"><QuoteDoc q={q} biz={biz} /></div>
        <aside className="space-y-4">
          {q.order ? <div className="card-pad text-sm">Converted to order <Link href={`/desk/orders/${q.order.number}`} className="mono font-semibold underline">{q.order.number}</Link>.</div> : <>
            {can(s.role, 'orders') && <section className="card-pad">
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
              {q.status !== 'SENT' && <form action={setQuoteStatus}><input type="hidden" name="number" value={q.number} /><input type="hidden" name="status" value="SENT" /><SubmitButton className="btn-secondary btn-sm">Mark sent</SubmitButton></form>}
              {q.status !== 'DECLINED' && <form action={setQuoteStatus}><input type="hidden" name="number" value={q.number} /><input type="hidden" name="status" value="DECLINED" /><SubmitButton className="btn-ghost btn-sm">Mark declined</SubmitButton></form>}
              <Link href={`/desk/quotes/new?customer=${q.customerId}`} className="btn-ghost btn-sm">New quote for this customer</Link>
            </section>
          </>}
        </aside>
      </div>
    </>
  );
}
