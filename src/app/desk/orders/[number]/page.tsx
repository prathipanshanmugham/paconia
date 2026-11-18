import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { can, requireStaff, seesCost } from '@/lib/auth';
import { Badge, KV, Notice, PageHead } from '@/components/ui';
import { CHANNEL_LABEL, ORDER_STATUS_LABEL, ORDER_TONE, STAGE_LABEL, routeOf } from '@/lib/orders';
import { dateFmt, dateTime, inr2, num } from '@/lib/format';
import { margin } from '@/lib/pricing';
import { getPricing } from '@/lib/settings';
import { fileUrl, prettySize } from '@/lib/files';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import OrderFileUpload from '@/components/OrderFileUpload';
import { addPayment, approveArtwork, cancelOrder, completeOrder, dispatchOrder, makeInvoice, markReady, moveJob, saveInternalNote, sendProof } from '@/app/actions/desk-orders';

export const metadata = { title: 'Order' };

const TERMS = { PREPAID: 'Paid in advance', PAY_ON_PICKUP: 'Pay on delivery / pickup', CREDIT: 'Credit' } as const;

export default async function DeskOrder({ params, searchParams }: { params: { number: string }; searchParams: { created?: string; proof?: string; err?: string } }) {
  const s = await requireStaff('orders');
  const o = await db.order.findUnique({
    where: { number: params.number },
    include: {
      customer: true, items: { include: { job: { include: { machine: true } } } }, payments: { orderBy: { receivedAt: 'asc' } },
      proofs: { orderBy: { version: 'desc' }, include: { file: true } }, files: { where: { kind: 'ARTWORK' }, orderBy: { createdAt: 'asc' } }, invoices: { orderBy: { issuedAt: 'desc' } }, quote: true,
    },
  });
  if (!o) notFound();
  const ps = await getPricing();
  const activity = await db.activity.findMany({ where: { entity: 'order', entityId: o.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  const due = Math.max(0, num(o.total) - num(o.amountPaid));
  const inv = o.invoices.find((i) => !i.cancelled);
  const preProd = ['PLACED', 'PROOF_SENT', 'CHANGES_REQUESTED'].includes(o.status);
  const latest = o.proofs[0];
  const c = o.customer;
  const self = `/desk/orders/${o.number}`;

  return (
    <>
      <PageHead back={{ href: '/desk/orders', label: 'Orders' }}
        title={<span className="flex flex-wrap items-center gap-3"><span className="mono">{o.number}</span><Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>{o.items.some((i) => i.job?.rush) && <Badge tone="bad">Rush</Badge>}</span>}
        sub={<>{CHANNEL_LABEL[o.channel]} order · placed {dateTime(o.placedAt)}{o.dueDate ? <> · due <b>{dateFmt(o.dueDate)}</b></> : null}{o.quote ? <> · from quote <Link className="underline" href={`/desk/quotes/${o.quote.number}`}>{o.quote.number}</Link></> : null}</>}
        actions={<>
          {o.status !== 'CANCELLED' && <Link href={`/print/job/${o.number}`} className="btn-secondary btn-sm">Job tickets</Link>}
          {inv ? <Link href={`/print/invoice/${inv.id}`} className="btn-secondary btn-sm">Invoice {inv.number}</Link>
            : o.status !== 'CANCELLED' && can(s.role, 'accounts') && <form action={makeInvoice}><input type="hidden" name="number" value={o.number} /><SubmitButton className="btn-secondary btn-sm" pendingText="Creating…">Create invoice</SubmitButton></form>}
        </>} />

      <div className="space-y-3">
        {searchParams.created && <Notice tone="good">Order created. {o.status === 'PLACED' ? 'Next: send a proof, or record that the customer approved the artwork.' : 'It is on the production board.'}</Notice>}
        {searchParams.proof && <Notice tone="good">Proof sent. The customer can approve it from their account (website customers) — or record their reply here.</Notice>}
        {searchParams.err && <Notice tone="bad">{searchParams.err}</Notice>}
        {o.notes && <Notice tone="info"><b>Customer note:</b> {o.notes}</Notice>}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {preProd && (
            <section className="card overflow-hidden">
              <header className="border-b border-line bg-mist/50 px-5 py-3"><h2 className="font-semibold">{o.status === 'PROOF_SENT' ? `Proof v${latest?.version} is with the customer` : o.status === 'CHANGES_REQUESTED' ? 'Customer asked for changes' : 'Step 1 · Proof'}</h2>
                {o.status === 'CHANGES_REQUESTED' && latest?.response && <p className="mt-1 text-sm">“{latest.response}”</p>}</header>
              <div className="grid gap-6 p-5 md:grid-cols-2">
                <ActionForm action={sendProof} className="space-y-3">
                  <input type="hidden" name="number" value={o.number} />
                  <label className="block text-sm"><span className="label">{o.status === 'PLACED' ? 'Proof file' : 'Revised proof file'}</span><input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.svg" className="input py-1.5" /></label>
                  <label className="block text-sm"><span className="label">Note to customer</span><textarea name="note" className="input min-h-[70px]" placeholder="e.g. Printed size 75 × 50 mm. White ink under the logo. Please check the batch number." /></label>
                  <SubmitButton pendingText="Sending…">Send proof v{(latest?.version || 0) + 1}</SubmitButton>
                </ActionForm>
                <form action={approveArtwork} className="space-y-3 rounded-xl bg-leaf-50 p-4 text-sm">
                  <input type="hidden" name="number" value={o.number} />
                  <p><b>Approved on the phone, WhatsApp or in person?</b> Record it and the jobs move to the machines.</p>
                  <select name="how" className="input"><option>on WhatsApp</option><option>on the phone</option><option>in person at the studio</option><option>by email</option></select>
                  <SubmitButton className="btn-dark" pendingText="Starting…" confirm="Start production on this order?">Approved · start production</SubmitButton>
                </form>
              </div>
            </section>
          )}

          <section className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-line px-5 py-3"><h2 className="font-semibold">Items & jobs</h2>
              {['APPROVED', 'IN_PRODUCTION'].includes(o.status) && can(s.role, 'production') && <form action={markReady}><input type="hidden" name="number" value={o.number} /><SubmitButton className="btn-ghost btn-sm" pendingText="…" confirm="Mark every job done and the order ready?">Mark all ready</SubmitButton></form>}</header>
            <ul className="divide-y divide-line">
              {o.items.map((i) => {
                const route = routeOf(i.estimate);
                return (
                  <li key={i.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0"><p className="font-semibold">{i.name} <span className="num font-normal text-ink-soft">× {i.qty.toLocaleString('en-IN')}</span></p><p className="text-sm text-ink-soft">{i.summary}</p>
                        <p className="num mt-1 text-xs text-ink-faint">HSN {i.hsn} · GST {i.gstRate}% · {inr2(num(i.unitPrice))}/pc{i.job?.ups ? ` · ${i.job.ups} up · ${i.job.sheets} sheets` : ''}</p></div>
                      <p className="num font-semibold">{inr2(i.lineTotal)}</p>
                    </div>
                    {i.job && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="mono text-xs text-ink-soft">{i.job.number}</span>
                        {route.concat('DONE').map((st) => {
                          const cur = route.concat('DONE').indexOf(i.job!.stage), me = route.concat('DONE').indexOf(st);
                          return <span key={st} className={`rounded-full px-2 py-0.5 text-xs ${me < cur ? 'bg-leaf-100 text-leaf-800' : me === cur ? 'bg-ink text-white' : 'bg-mist text-ink-faint'}`}>{STAGE_LABEL[st]}</span>;
                        })}
                        {i.job.machine && <span className="text-xs text-ink-soft">on {i.job.machine.name}</span>}
                        {o.status === 'IN_PRODUCTION' && !['PREPRESS', 'DONE'].includes(i.job.stage) && can(s.role, 'production') && (
                          <form action={moveJob} className="ml-auto"><input type="hidden" name="jobId" value={i.job.id} /><input type="hidden" name="from" value={self} /><SubmitButton className="btn-secondary btn-sm" pendingText="…">Next stage →</SubmitButton></form>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {o.status === 'READY' && (
            <section className="card-pad border-leaf-300">
              <h2 className="font-semibold">{o.fulfilment === 'COURIER' ? 'Dispatch' : 'Hand over'}</h2>
              {due > 0.009 && o.terms !== 'CREDIT' && <p className="mt-1 text-sm text-amber-800">Collect {inr2(due)} before handing over.</p>}
              <ActionForm action={dispatchOrder} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="number" value={o.number} />
                {o.fulfilment === 'COURIER' ? <>
                  <label className="text-sm"><span className="label">Courier</span><input name="courier" className="input w-44" list="couriers" required /><datalist id="couriers"><option>DTDC</option><option>Professional Couriers</option><option>ST Courier</option><option>India Post</option><option>Delhivery</option></datalist></label>
                  <label className="text-sm"><span className="label">Tracking / AWB no.</span><input name="awb" className="input w-48" required /></label>
                  <SubmitButton pendingText="Saving…">Mark dispatched</SubmitButton>
                </> : <SubmitButton pendingText="Saving…">Customer collected it</SubmitButton>}
              </ActionForm>
            </section>
          )}
          {o.status === 'DISPATCHED' && <form action={completeOrder} className="card-pad flex flex-wrap items-center justify-between gap-3"><input type="hidden" name="number" value={o.number} /><p className="text-sm">Sent by <b>{o.courier}</b> · <span className="mono">{o.awb}</span></p><SubmitButton className="btn-secondary btn-sm">Mark delivered</SubmitButton></form>}

          <section className="card-pad">
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Customer artwork</h2>{o.status !== 'CANCELLED' && <OrderFileUpload order={o.number} label="Add file" />}</div>
            {o.files.length ? <ul className="mt-3 space-y-1.5 text-sm">{o.files.map((f) => <li key={f.id} className="flex flex-wrap gap-2"><a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="underline">{f.name}</a><span className="text-ink-faint">{prettySize(f.size)} · {dateTime(f.createdAt)}</span><a href={`${fileUrl(f.id)}?download=1`} className="text-xs text-ink-soft underline">download</a></li>)}</ul>
              : <p className="mt-2 text-sm text-amber-800">No artwork yet. Ask the customer to upload it or send it on WhatsApp.</p>}
          </section>

          {o.proofs.length > 0 && (
            <section className="card-pad">
              <h2 className="font-semibold">Proofs</h2>
              <ul className="mt-3 space-y-3 text-sm">{o.proofs.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3">
                  {p.file && /^image\//.test(p.file.mime) && /* eslint-disable-next-line @next/next/no-img-element */ <img src={fileUrl(p.file.id)} alt={`Proof v${p.version}`} className="h-16 w-24 rounded border border-line bg-white object-contain" />}
                  <div><span className="mono">v{p.version}</span> <Badge tone={p.status === 'APPROVED' ? 'good' : p.status === 'CHANGES' ? 'warn' : 'info'}>{p.status === 'APPROVED' ? 'Approved' : p.status === 'CHANGES' ? 'Changes' : 'With customer'}</Badge> <span className="text-ink-soft">{dateTime(p.createdAt)}</span>
                    {p.note && <p className="text-ink-soft">Note: {p.note}</p>}{p.response && <p>Reply: “{p.response}”</p>}{p.file && <a href={fileUrl(p.file.id)} target="_blank" rel="noreferrer" className="text-xs underline">Open file</a>}</div>
                </li>))}</ul>
            </section>
          )}

          <section className="card-pad">
            <h2 className="font-semibold">Activity</h2>
            <ul className="mt-3 space-y-1.5 text-sm">{activity.map((a) => <li key={a.id} className="flex gap-3"><span className="w-32 shrink-0 text-xs text-ink-faint">{dateTime(a.createdAt)}</span><span><b>{a.userName || 'System'}</b> {a.action}{a.detail ? <span className="text-ink-soft"> · {a.detail}</span> : null}</span></li>)}</ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card-pad">
            <h2 className="font-semibold">Money</h2>
            <div className="num mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Items</span><span>{inr2(o.subtotal)}</span></div>
              {num(o.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span>−{inr2(o.discount)}</span></div>}
              {num(o.shipping) > 0 && <div className="flex justify-between"><span>Shipping</span><span>{inr2(o.shipping)}</span></div>}
              <div className="flex justify-between text-ink-soft"><span>Taxable</span><span>{inr2(o.taxable)}</span></div>
              {num(o.igst) > 0 ? <div className="flex justify-between text-ink-soft"><span>IGST</span><span>{inr2(o.igst)}</span></div> : <><div className="flex justify-between text-ink-soft"><span>CGST</span><span>{inr2(o.cgst)}</span></div><div className="flex justify-between text-ink-soft"><span>SGST</span><span>{inr2(o.sgst)}</span></div></>}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span>{inr2(o.total)}</span></div>
              <div className="flex justify-between"><span>Received</span><span>{inr2(o.amountPaid)}</span></div>
              {due > 0.009 && <div className="flex justify-between font-semibold text-amber-800"><span>Balance</span><span>{inr2(due)}</span></div>}
            </div>
            {num(o.cost) > 0 && seesCost(s.role) && (() => { const mm = margin(num(o.subtotal) - num(o.discount), num(o.cost)); return <div className="num mt-3 flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm"><span className="text-ink-soft">Cost {inr2(o.cost)}, profit {inr2(mm.amount)}</span><Badge tone={mm.pct < ps.minMargin ? 'bad' : mm.pct < ps.targetMargin ? 'warn' : 'good'}>{mm.pct}% margin</Badge></div>; })()}
            <p className="mt-2 text-xs text-ink-soft">{TERMS[o.terms]}{o.terms === 'CREDIT' && c.creditDays ? ` · ${c.creditDays} days` : ''}</p>
            {o.payments.length > 0 && <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">{o.payments.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="text-ink-soft"><span className="mono">{p.number}</span> · {dateFmt(p.receivedAt)} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span><span className="num">{inr2(p.amount)}</span></li>)}</ul>}
            {due > 0.009 && o.status !== 'CANCELLED' && (
              <ActionForm action={addPayment} className="mt-4 space-y-2 border-t border-line pt-4" resetOnOk>
                <input type="hidden" name="number" value={o.number} />
                <div className="flex gap-2"><input name="amount" type="number" step="0.01" min="0" defaultValue={due.toFixed(2)} className="input" aria-label="Amount" /><select name="method" className="input w-28" aria-label="Method">{['UPI', 'CASH', 'CARD', 'BANK', 'CHEQUE'].map((m) => <option key={m}>{m}</option>)}</select></div>
                <input name="reference" placeholder="UTR / cheque no. (optional)" className="input" />
                <SubmitButton className="btn-secondary w-full" pendingText="Recording…">Record payment</SubmitButton>
              </ActionForm>
            )}
          </section>

          <section className="card-pad">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Customer</h2>{can(s.role, 'customers') && <Link href={`/desk/customers/${c.code}`} className="text-sm text-ink-soft hover:text-ink">Open →</Link>}</div>
            <KV rows={[['Name', <>{c.company ? <><b>{c.company}</b><br /></> : null}{c.name}</>], ['Phone', <a key="p" href={`tel:${c.phone}`} className="underline">{c.phone}</a>], ...(c.email ? [['Email', c.email] as [string, string]] : []), ...(c.gstin ? [['GSTIN', <span key="g" className="mono">{c.gstin}</span>] as [string, JSX.Element]] : [])]} />
            <a href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}?text=${encodeURIComponent(`Hello ${c.name}, this is Paconia about your order ${o.number}.`)}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-3">WhatsApp customer</a>
          </section>

          <section className="card-pad">
            <h2 className="mb-3 font-semibold">{o.fulfilment === 'PICKUP' ? 'Pickup at studio' : 'Courier'}</h2>
            {o.fulfilment === 'COURIER' ? <p className="text-sm">{o.shipName}<br />{[o.shipLine1, o.shipLine2, o.shipCity].filter(Boolean).join(', ')}<br />{o.shipState} {o.shipPincode}<br /><span className="text-ink-soft">{o.shipPhone}</span></p> : <p className="text-sm text-ink-soft">Customer collects from the studio.</p>}
          </section>

          <section className="card-pad">
            <h2 className="mb-2 font-semibold">Team notes</h2>
            <ActionForm action={saveInternalNote} className="space-y-2"><input type="hidden" name="number" value={o.number} /><textarea name="internalNotes" defaultValue={o.internalNotes || ''} className="input min-h-[80px]" placeholder="Only staff see this" /><SubmitButton className="btn-ghost btn-sm">Save note</SubmitButton></ActionForm>
          </section>

          {!['DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(o.status) && ['OWNER', 'MANAGER', 'ACCOUNTS'].includes(s.role) && (
            <details className="card-pad text-sm"><summary className="cursor-pointer font-semibold text-rose-700">Cancel order</summary>
              <form action={cancelOrder} className="mt-3 space-y-2"><input type="hidden" name="number" value={o.number} /><input name="reason" required className="input" placeholder="Reason" />
                {num(o.amountPaid) > 0 && <p className="text-xs text-amber-800">{inr2(o.amountPaid)} was received. Refund it separately and note it here.</p>}
                <SubmitButton className="btn-danger btn-sm" confirm="Cancel this order? This cannot be undone." pendingText="Cancelling…">Cancel order</SubmitButton></form></details>
          )}
        </aside>
      </div>
    </>
  );
}
