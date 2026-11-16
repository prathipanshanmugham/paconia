import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { Badge, KV, Notice } from '@/components/ui';
import { ORDER_STATUS_LABEL, ORDER_TONE, STAGE_LABEL } from '@/lib/orders';
import { dateFmt, dateTime, inr2, num } from '@/lib/format';
import { fileUrl, prettySize } from '@/lib/files';
import { respondToProof } from '@/app/actions/shop';
import SubmitButton from '@/components/SubmitButton';
import OrderFileUpload from '@/components/OrderFileUpload';
import type { OrderStatus } from '@/generated/prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Order' };

const STEPS: { label: string; done: OrderStatus[] }[] = [
  { label: 'Order placed', done: ['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED', 'APPROVED', 'IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED'] },
  { label: 'Proof approved', done: ['APPROVED', 'IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED'] },
  { label: 'Printing', done: ['IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED'] },
  { label: 'Ready', done: ['READY', 'DISPATCHED', 'COMPLETED'] },
  { label: 'Delivered', done: ['COMPLETED'] },
];

export default async function OrderPage({ params, searchParams }: { params: { number: string }; searchParams: { placed?: string; paid?: string; need?: string } }) {
  const s = await requireUser(`/account/orders/${params.number}`);
  const o = await db.order.findUnique({
    where: { number: params.number },
    include: {
      customer: true, items: { include: { job: true } }, payments: { orderBy: { receivedAt: 'asc' } },
      proofs: { orderBy: { version: 'desc' }, include: { file: true } }, files: { where: { kind: 'ARTWORK' }, orderBy: { createdAt: 'asc' } },
      invoices: { where: { cancelled: false } },
    },
  });
  if (!o || o.customer.userId !== s.userId) notFound();
  const due = Math.max(0, num(o.total) - num(o.amountPaid));
  const latest = o.proofs[0];
  const reviewing = o.status === 'PROOF_SENT' && latest?.status === 'SENT';
  const inv = o.invoices[0];
  const doneSteps = STEPS.filter((st) => st.done.includes(o.status)).length;

  return (
    <div className="space-y-6">
      {searchParams.placed && <Notice tone="good"><b>Thank you, your order is placed.</b> We will send a proof within one working day{o.files.length ? '' : '. Upload your artwork below if you have not sent it yet'}.</Notice>}
      {searchParams.paid && <Notice tone="good"><b>Payment received.</b> Thank you.</Notice>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/account" className="text-sm text-ink-soft hover:text-ink">← All orders</Link>
          <h1 className="mt-1 text-2xl font-bold">Order <span className="mono">{o.number}</span></h1>
          <p className="text-sm text-ink-soft">Placed {dateTime(o.placedAt)}{o.dueDate ? ` · ready by ${dateFmt(o.dueDate)}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></div>
      </div>

      {o.status !== 'CANCELLED' && (
        <ol className="card grid grid-cols-5 gap-1 p-4 text-center text-xs sm:text-sm" aria-label="Order progress">
          {STEPS.map((st, i) => (
            <li key={st.label} className="flex flex-col items-center gap-2">
              <span className={`h-1.5 w-full rounded-full ${i < doneSteps ? 'bg-leaf-500' : 'bg-mist'}`} />
              <span className={i < doneSteps ? 'font-semibold' : 'text-ink-faint'}>{st.label}</span>
            </li>
          ))}
        </ol>
      )}

      {reviewing && latest && (
        <section className="card overflow-hidden border-sky-400">
          <div className="border-b border-line bg-sky-50 px-5 py-3"><h2 className="font-semibold">Please check your proof (version {latest.version})</h2><p className="text-sm text-ink-soft">Check spelling, numbers, colours and size. We print exactly what you approve.</p></div>
          <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_1fr]">
            {latest.file && (/^image\//.test(latest.file.mime)
              // eslint-disable-next-line @next/next/no-img-element
              ? <a href={fileUrl(latest.file.id)} target="_blank" rel="noreferrer"><img src={fileUrl(latest.file.id)} alt={`Proof version ${latest.version}`} className="w-full rounded-lg border border-line bg-white" /></a>
              : <a href={fileUrl(latest.file.id)} target="_blank" rel="noreferrer" className="btn-secondary">Open proof ({latest.file.name})</a>)}
            <form action={respondToProof} className="space-y-3">
              <input type="hidden" name="number" value={o.number} />
              {latest.note && <p className="rounded-lg bg-mist p-3 text-sm"><b>From our designer:</b> {latest.note}</p>}
              <label className="block"><span className="label">Comments</span><textarea name="comment" className="input min-h-[90px]" placeholder="Needed only if you want changes" /></label>
              {searchParams.need === 'comment' && <p role="alert" className="text-sm text-rose-700">Tell us what to change.</p>}
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="decision" value="approve" className="btn-primary" pendingText="Approving…" confirm="Approve this proof? Printing starts after approval.">Approve & print</SubmitButton>
                <SubmitButton name="decision" value="changes" className="btn-secondary" pendingText="Sending…">Request changes</SubmitButton>
              </div>
            </form>
          </div>
        </section>
      )}
      {o.status === 'CHANGES_REQUESTED' && <Notice tone="info">We are making your changes and will send a new proof shortly.</Notice>}
      {o.status === 'READY' && <Notice tone="good">{o.fulfilment === 'PICKUP' ? 'Your order is ready to collect from the studio.' : 'Your order is packed and will be handed to the courier shortly.'}</Notice>}
      {o.status === 'DISPATCHED' && <Notice tone="good">Sent by {o.courier || 'courier'}{o.awb ? <> · tracking number <b className="mono">{o.awb}</b></> : ''}.</Notice>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-5 py-3 font-semibold">Items</h2>
            <ul className="divide-y divide-line">
              {o.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0"><p className="font-semibold">{i.name}</p><p className="text-sm text-ink-soft">{i.summary}</p><p className="num mt-1 text-sm">{i.qty.toLocaleString('en-IN')} pcs · HSN {i.hsn} · GST {i.gstRate}%</p></div>
                  <div className="text-right"><p className="num font-semibold">{inr2(i.lineTotal)}</p>{i.job && o.status === 'IN_PRODUCTION' && <Badge tone="info">{STAGE_LABEL[i.job.stage]}</Badge>}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Your artwork</h2>
              {['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED'].includes(o.status) && <OrderFileUpload order={o.number} label={o.files.length ? 'Add files' : 'Upload artwork'} />}</div>
            {o.files.length ? <ul className="mt-3 space-y-1.5 text-sm">{o.files.map((f) => <li key={f.id}><a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="underline">{f.name}</a> <span className="text-ink-faint">· {prettySize(f.size)}</span></li>)}</ul>
              : <p className="mt-2 text-sm text-ink-soft">No files yet. Send a print-ready PDF or your logo, or <Link href="/artwork-guide" className="underline">read the artwork guide</Link>.</p>}
          </section>

          {o.proofs.length > (reviewing ? 1 : 0) && (
            <section className="card-pad">
              <h2 className="font-semibold">Proof history</h2>
              <ul className="mt-3 space-y-2 text-sm">{o.proofs.slice(reviewing ? 1 : 0).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="mono">v{p.version}</span>
                  <Badge tone={p.status === 'APPROVED' ? 'good' : p.status === 'CHANGES' ? 'warn' : 'info'}>{p.status === 'APPROVED' ? 'Approved' : p.status === 'CHANGES' ? 'Changes asked' : 'Sent'}</Badge>
                  <span className="text-ink-soft">{dateFmt(p.createdAt)}</span>
                  {p.file && <a href={fileUrl(p.file.id)} target="_blank" rel="noreferrer" className="underline">View</a>}
                  {p.response && <span className="w-full pl-8 text-ink-soft">“{p.response}”</span>}
                </li>
              ))}</ul>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card-pad">
            <h2 className="font-semibold">Payment</h2>
            <div className="num mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Items</span><span>{inr2(o.subtotal)}</span></div>
              {num(o.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>−{inr2(o.discount)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span>{num(o.shipping) ? inr2(o.shipping) : 'Free'}</span></div>
              {num(o.igst) > 0 ? <div className="flex justify-between text-ink-soft"><span>IGST</span><span>{inr2(o.igst)}</span></div> : <>
                <div className="flex justify-between text-ink-soft"><span>CGST</span><span>{inr2(o.cgst)}</span></div>
                <div className="flex justify-between text-ink-soft"><span>SGST</span><span>{inr2(o.sgst)}</span></div></>}
              <div className="flex justify-between border-t border-line pt-2 font-semibold"><span>Total</span><span>{inr2(o.total)}</span></div>
              <div className="flex justify-between text-ink-soft"><span>Paid</span><span>{inr2(o.amountPaid)}</span></div>
              {due > 0.009 && <div className="flex justify-between font-semibold text-amber-800"><span>Balance</span><span>{inr2(due)}</span></div>}
            </div>
            {due > 0.009 && o.status !== 'CANCELLED' && o.terms === 'PREPAID' && <Link href={`/pay/${o.number}`} className="btn-primary mt-4 w-full">Pay {inr2(due)}</Link>}
            {due > 0.009 && o.terms === 'PAY_ON_PICKUP' && <p className="mt-3 text-xs text-ink-soft">Pay by cash or UPI when you collect.</p>}
            {o.payments.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-ink-soft">{o.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{dateFmt(p.receivedAt)} · {p.method === 'RAZORPAY' ? 'Online' : p.method.toLowerCase()}</span><span className="num">{inr2(p.amount)}</span></li>)}</ul>}
            {inv && <a href={`/print/invoice/${inv.id}`} className="btn-secondary mt-4 w-full">GST invoice {inv.number}</a>}
          </section>
          <section className="card-pad">
            <h2 className="mb-3 font-semibold">{o.fulfilment === 'PICKUP' ? 'Pickup' : 'Delivery'}</h2>
            {o.fulfilment === 'PICKUP' ? <p className="text-sm text-ink-soft">Collect from our studio at Perundurai. We will message you when it is ready.</p>
              : <KV rows={[['Ship to', <>{o.shipName}<br />{[o.shipLine1, o.shipLine2, o.shipCity].filter(Boolean).join(', ')}<br />{o.shipState} {o.shipPincode}</>], ['Phone', o.shipPhone || '—'], ...(o.awb ? [['Tracking', <span key="a" className="mono">{o.courier} {o.awb}</span>] as [string, JSX.Element]] : [])]} />}
          </section>
        </aside>
      </div>
    </div>
  );
}
