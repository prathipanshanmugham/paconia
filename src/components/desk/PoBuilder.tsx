'use client';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import SubmitButton from '@/components/SubmitButton';
import { createPO } from '@/app/actions/desk-purchase';

type Mat = { id: string; code: string; name: string; uom: string; cost: number; vendorId: string | null; reorderQty: number; low: boolean };
type L = { key: number; materialId: string; qty: number; rate: number; gstRate: number };
const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PoBuilder({ vendors, mats }: { vendors: { id: string; name: string }[]; mats: Mat[] }) {
  const [state, run] = useFormState(createPO, null);
  const [vendorId, setVendorId] = useState(vendors[0]?.id || '');
  const [lines, setLines] = useState<L[]>([]);
  const [seq, setSeq] = useState(1);
  const [expectedDays, setExpectedDays] = useState(5);
  const [notes, setNotes] = useState('');
  const [order, setOrder] = useState(true);
  const add = (m?: Mat) => { const mm = m || mats[0]; setLines((ls) => [...ls, { key: seq + ls.length, materialId: mm.id, qty: mm.reorderQty || 1, rate: mm.cost, gstRate: 18 }]); setSeq(seq + 1); };
  const lowForVendor = mats.filter((m) => m.low && m.vendorId === vendorId && !lines.some((l) => l.materialId === m.id));
  const sub = lines.reduce((a, l) => a + l.qty * l.rate, 0), gst = lines.reduce((a, l) => a + (l.qty * l.rate * l.gstRate) / 100, 0);
  const up = (k: number, p: Partial<L>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));
  return (
    <form action={run} className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <input type="hidden" name="payload" value={JSON.stringify({ vendorId, expectedDays, notes, order, lines: lines.map(({ materialId, qty, rate, gstRate }) => ({ materialId, qty, rate, gstRate })) })} />
      <div className="space-y-4">
        <section className="card-pad grid gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-2"><span className="label">Vendor</span><select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="text-sm"><span className="label">Expected in (days)</span><input type="number" min={0} className="input" value={expectedDays} onChange={(e) => setExpectedDays(Math.max(0, Math.floor(Number(e.target.value))))} /></label>
          {lowForVendor.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm sm:col-span-3">Low stock from this vendor: {lowForVendor.map((m) => <button key={m.id} type="button" className="chip ml-1 mt-1" onClick={() => add(m)}>+ {m.name}</button>)}</div>}
        </section>
        <section className="card overflow-x-auto">
          <table className="tbl min-w-[640px]"><thead><tr><th>Material</th><th className="w-28">Qty</th><th className="w-32">Rate ₹</th><th className="w-24">GST</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>{lines.map((l) => { const m = mats.find((x) => x.id === l.materialId)!; return (
              <tr key={l.key}>
                <td><select className="input" value={l.materialId} onChange={(e) => { const nm = mats.find((x) => x.id === e.target.value)!; up(l.key, { materialId: nm.id, rate: nm.cost }); }} aria-label="Material">{mats.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></td>
                <td><input type="number" min={0} step="0.01" className="input" value={l.qty} onChange={(e) => up(l.key, { qty: Number(e.target.value) })} aria-label="Quantity" /><span className="text-xs text-ink-faint">{m.uom}</span></td>
                <td><input type="number" min={0} step="0.01" className="input" value={l.rate} onChange={(e) => up(l.key, { rate: Number(e.target.value) })} aria-label="Rate" /></td>
                <td><select className="input" value={l.gstRate} onChange={(e) => up(l.key, { gstRate: Number(e.target.value) })} aria-label="GST rate">{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</select></td>
                <td className="num text-right">{rs2(l.qty * l.rate)}</td>
                <td><button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button></td>
              </tr>); })}</tbody></table>
          <div className="p-4"><button type="button" className="btn-secondary btn-sm" onClick={() => add()}>+ Add material</button></div>
        </section>
        <label className="block text-sm"><span className="label">Notes for the vendor</span><textarea className="input min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
      <aside className="card-pad h-fit">
        <div className="num space-y-1.5 text-sm"><div className="flex justify-between"><span>Sub-total</span><span>{rs2(sub)}</span></div><div className="flex justify-between text-ink-soft"><span>GST</span><span>{rs2(gst)}</span></div><div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Total</span><span>{rs2(sub + gst)}</span></div></div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={order} onChange={(e) => setOrder(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Mark as ordered now</label>
        {state?.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn-primary mt-4 w-full" pendingText="Saving…">Save purchase order</SubmitButton>
      </aside>
    </form>
  );
}
