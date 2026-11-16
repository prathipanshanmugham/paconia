import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Empty, PageHead, Tabs } from '@/components/ui';
import { ago, dateShort, inr2 } from '@/lib/format';
import SubmitButton from '@/components/SubmitButton';
import { setEnquiryStatus } from '@/app/actions/desk-quotes';
import Icon from '@/components/desk/Icon';

export const metadata = { title: 'Quotes' };
const QTONE = { DRAFT: 'muted', SENT: 'info', ACCEPTED: 'good', DECLINED: 'bad', EXPIRED: 'muted' } as const;
const ETONE = { NEW: 'warn', CONTACTED: 'info', QUOTED: 'good', CLOSED: 'muted' } as const;

export default async function Quotes({ searchParams }: { searchParams: { tab?: string } }) {
  await requireStaff('quotes');
  const tab = searchParams.tab === 'enquiries' ? 'enquiries' : 'quotes';
  const [quotes, enquiries, newCount] = await Promise.all([
    tab === 'quotes' ? db.quote.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { customer: true, lines: { select: { name: true } }, order: { select: { number: true } } } }) : [],
    tab === 'enquiries' ? db.enquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }) : [],
    db.enquiry.count({ where: { status: 'NEW' } }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHead title="Quotes & enquiries" actions={<Link href="/desk/quotes/new" className="btn-primary"><Icon name="plus" /> New quote</Link>} />
      <Tabs current={`/desk/quotes${tab === 'enquiries' ? '?tab=enquiries' : ''}`} items={[{ href: '/desk/quotes', label: 'Quotes' }, { href: '/desk/quotes?tab=enquiries', label: 'Website enquiries', count: newCount }]} />
      {tab === 'quotes' ? (
        <div className="card overflow-x-auto">{quotes.length ? (
          <table className="tbl min-w-[760px]"><thead><tr><th>Quote</th><th>Customer</th><th>Items</th><th>Status</th><th>Valid until</th><th className="text-right">Total</th></tr></thead>
            <tbody>{quotes.map((q) => {
              const expired = q.status !== 'ACCEPTED' && q.validUntil < now;
              return <tr key={q.id} className="rowlink">
                <td><Link href={`/desk/quotes/${q.number}`} className="mono font-semibold hover:underline">{q.number}</Link><div className="text-xs text-ink-soft">{dateShort(q.createdAt)}</div></td>
                <td>{q.customer.company || q.customer.name}</td>
                <td className="max-w-[240px] truncate text-sm">{q.lines.map((l) => l.name).join(', ')}</td>
                <td>{expired ? <Badge tone="muted">Expired</Badge> : <Badge tone={QTONE[q.status]}>{q.status === 'ACCEPTED' ? `Order ${q.order?.number || ''}` : q.status.charAt(0) + q.status.slice(1).toLowerCase()}</Badge>}</td>
                <td className={expired ? 'text-ink-faint' : ''}>{dateShort(q.validUntil)}</td>
                <td className="num text-right">{inr2(q.total)}</td>
              </tr>;
            })}</tbody></table>) : <Empty title="No quotes yet" action={<Link href="/desk/quotes/new" className="btn-secondary">New quote</Link>} />}</div>
      ) : (
        <div className="space-y-3">{enquiries.length ? enquiries.map((e) => (
          <article key={e.id} className="card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold">{e.company ? `${e.company} · ` : ''}{e.name} <Badge tone={ETONE[e.status]}>{e.status.charAt(0) + e.status.slice(1).toLowerCase()}</Badge></p>
                <p className="text-sm text-ink-soft"><a href={`tel:${e.phone}`} className="underline">{e.phone}</a>{e.email ? ` · ${e.email}` : ''} · {ago(e.createdAt)}</p></div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/desk/quotes/new?enquiry=${e.id}`} className="btn-primary btn-sm">Make quote</Link>
                {(['CONTACTED', 'CLOSED'] as const).filter((st) => st !== e.status).map((st) => <form key={st} action={setEnquiryStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={st} /><SubmitButton className="btn-ghost btn-sm" pendingText="…">{st === 'CONTACTED' ? 'Mark contacted' : 'Close'}</SubmitButton></form>)}
              </div>
            </div>
            <p className="mt-2 text-sm"><b>{e.product}</b> · {e.qty}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{e.details}</p>
          </article>
        )) : <div className="card"><Empty title="No enquiries">Enquiries from the website’s bulk quote form land here.</Empty></div>}</div>
      )}
    </>
  );
}
