import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBusiness } from '@/lib/settings';
import { Badge, PageHead } from '@/components/ui';
import { dateFmt, inr2, num, qtyFmt } from '@/lib/format';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import PrintButton from '@/components/PrintButton';
import { receivePO, setPoStatus } from '@/app/actions/desk-purchase';

export const metadata = { title: 'Purchase order' };

export default async function PoPage({ params }: { params: { number: string } }) {
  await requireStaff('stock');
  const po = await db.purchaseOrder.findUnique({ where: { number: params.number }, include: { vendor: true, lines: { include: { material: true } } } });
  if (!po) notFound();
  const biz = await getBusiness();
  return (
    <>
      <div className="no-print"><PageHead back={{ href: '/desk/stock?tab=purchases', label: 'Purchase orders' }} title={<span className="flex items-center gap-3"><span className="mono">{po.number}</span><Badge tone={po.status === 'RECEIVED' ? 'good' : po.status === 'ORDERED' ? 'info' : po.status === 'CANCELLED' ? 'bad' : 'muted'}>{po.status.toLowerCase()}</Badge></span>} sub={`${po.vendor.name} · expected ${dateFmt(po.expectedAt)}`}
        actions={<><PrintButton label="Print PO" />{po.status === 'DRAFT' && <form action={setPoStatus}><input type="hidden" name="number" value={po.number} /><input type="hidden" name="status" value="ORDERED" /><SubmitButton className="btn-primary btn-sm">Mark ordered</SubmitButton></form>}
          {['DRAFT', 'ORDERED'].includes(po.status) && <form action={setPoStatus}><input type="hidden" name="number" value={po.number} /><input type="hidden" name="status" value="CANCELLED" /><SubmitButton className="btn-ghost btn-sm" confirm="Cancel this purchase order?">Cancel PO</SubmitButton></form>}</>} /></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <article className="print-sheet card p-6 print:border-0 print:shadow-none">
          <header className="flex flex-wrap justify-between gap-4 border-b border-line pb-4"><div><p className="font-display text-xl font-bold">Purchase order {po.number}</p><p className="text-sm text-ink-soft">{biz.legalName} ({biz.tradeName}) · GSTIN {biz.gstin}<br />{biz.address}, {biz.city} {biz.pincode} · {biz.phone}</p></div>
            <div className="text-sm"><p className="font-semibold">To: {po.vendor.name}</p><p className="text-ink-soft">{[po.vendor.address, po.vendor.city].filter(Boolean).join(', ')}{po.vendor.gstin ? <><br />GSTIN {po.vendor.gstin}</> : null}<br />Date {dateFmt(po.orderedAt || po.createdAt)}</p></div></header>
          <table className="tbl mt-2"><thead><tr><th>Material</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">GST</th><th className="text-right">Amount</th><th className="text-right no-print">Received</th></tr></thead>
            <tbody>{po.lines.map((l) => <tr key={l.id}><td>{l.material.name}<div className="mono text-xs text-ink-soft">{l.material.code}</div></td><td className="num text-right">{qtyFmt(l.qty, 2)} {l.material.uom}</td><td className="num text-right">{inr2(l.rate)}</td><td className="text-right">{l.gstRate}%</td><td className="num text-right">{inr2(num(l.qty) * num(l.rate))}</td><td className="no-print num text-right">{qtyFmt(l.receivedQty, 2)}</td></tr>)}</tbody></table>
          <div className="num ml-auto mt-3 w-64 space-y-1 text-sm"><div className="flex justify-between"><span>Sub-total</span><span>{inr2(po.subtotal)}</span></div><div className="flex justify-between"><span>GST</span><span>{inr2(po.gst)}</span></div><div className="flex justify-between border-t border-line pt-1 font-bold"><span>Total</span><span>{inr2(po.total)}</span></div></div>
          {po.notes && <p className="mt-4 text-sm"><b>Notes:</b> {po.notes}</p>}
        </article>
        {po.status === 'RECEIVED' && <section className="no-print card-pad h-fit text-sm"><h2 className="font-semibold">All goods received</h2><p className="mt-1 text-ink-soft">Received on {dateFmt(po.receivedAt)}. Stock and material costs were updated.</p></section>}
        {po.status === 'ORDERED' && (
          <section className="no-print card-pad h-fit"><h2 className="font-semibold">Receive goods</h2><p className="mt-1 text-sm text-ink-soft">Enter what arrived. Stock goes up and the cost updates to this rate.</p>
            <ActionForm action={receivePO} className="mt-3 space-y-3">
              <input type="hidden" name="number" value={po.number} />
              {po.lines.map((l) => { const left = Math.max(0, num(l.qty) - num(l.receivedQty)); return <label key={l.id} className="block text-sm"><span className="label">{l.material.name} <span className="font-normal text-ink-faint">({qtyFmt(left, 2)} {l.material.uom} due)</span></span><input type="number" step="0.01" min="0" max={left} name={`qty_${l.id}`} defaultValue={left || ''} className="input" /></label>; })}
              <label className="block text-sm"><span className="label">Vendor bill no.</span><input name="ref" className="input" /></label>
              <SubmitButton className="btn-primary w-full" pendingText="Updating stock…">Receive into stock</SubmitButton>
            </ActionForm></section>
        )}
      </div>
    </>
  );
}
