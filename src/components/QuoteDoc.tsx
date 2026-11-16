import { dateFmt, inr2, num } from '@/lib/format';
import type { Business } from '@/lib/settings';

type Q = { number: string; createdAt: Date; validUntil: Date; notes: string | null; subtotal: unknown; discount: unknown; taxable: unknown; cgst: unknown; sgst: unknown; igst: unknown; total: unknown;
  customer: { name: string; company: string | null; phone: string; gstin: string | null; city: string | null; state: string | null };
  lines: { id: string; name: string; summary: string; qty: number; unitPrice: unknown; lineTotal: unknown; hsn: string; gstRate: number }[] };

export default function QuoteDoc({ q, biz }: { q: Q; biz: Business }) {
  return (
    <article className="print-sheet mx-auto max-w-[210mm] bg-white p-8 text-[12.5px] text-ink shadow-card print:p-0 print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/brand/logo.png" alt="Paconia" className="mb-2 h-10 w-auto" />
          <div className="font-semibold">{biz.legalName} ({biz.tradeName})</div><div className="max-w-[320px] text-ink-soft">{biz.address}, {biz.city} {biz.pincode}</div><div className="text-ink-soft">{biz.phone} · {biz.email}</div><div className="font-mono text-[12px]">GSTIN {biz.gstin}</div></div>
        <div className="text-right"><h1 className="font-display text-2xl font-bold">Quotation</h1><p className="font-mono font-semibold">{q.number}</p><p className="text-ink-soft">Date {dateFmt(q.createdAt)}</p><p className="text-ink-soft">Valid until {dateFmt(q.validUntil)}</p></div>
      </header>
      <section className="py-4"><div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">For</div><div className="font-semibold">{q.customer.company || q.customer.name}</div>
        <div className="text-ink-soft">{q.customer.company ? `${q.customer.name} · ` : ''}{q.customer.phone}{q.customer.city ? ` · ${q.customer.city}` : ''}</div>{q.customer.gstin && <div className="font-mono text-[12px]">GSTIN {q.customer.gstin}</div>}</section>
      <table className="w-full border-collapse"><thead><tr className="border-y border-ink text-left text-[11px] uppercase tracking-wide"><th className="py-2 pr-2">#</th><th className="py-2 pr-2">Item</th><th className="py-2 pr-2">HSN</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Rate</th><th className="py-2 pr-2 text-right">GST</th><th className="py-2 text-right">Amount</th></tr></thead>
        <tbody>{q.lines.map((l, i) => <tr key={l.id} className="border-b border-line align-top"><td className="py-2 pr-2">{i + 1}</td><td className="py-2 pr-2"><div className="font-medium">{l.name}</div><div className="text-[11.5px] text-ink-soft">{l.summary}</div></td><td className="py-2 pr-2 font-mono">{l.hsn}</td><td className="py-2 pr-2 text-right tabular-nums">{l.qty.toLocaleString('en-IN')}</td><td className="py-2 pr-2 text-right tabular-nums">{num(l.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td><td className="py-2 pr-2 text-right">{l.gstRate}%</td><td className="py-2 text-right tabular-nums">{inr2(l.lineTotal)}</td></tr>)}</tbody></table>
      <div className="mt-4 grid grid-cols-[1fr_250px] gap-6">
        <div className="text-ink-soft">{q.notes && <p className="mb-2 whitespace-pre-line text-ink">{q.notes}</p>}<p>Prices include printing, cutting and finishing as described. Courier charged extra at actuals unless stated. Production starts after artwork approval and advance payment. Lead time is counted from proof approval.</p></div>
        <table className="w-full self-start text-right tabular-nums"><tbody>
          <tr><td className="text-ink-soft">Sub-total</td><td>{inr2(q.subtotal)}</td></tr>
          {num(q.discount) > 0 && <tr><td className="text-ink-soft">Discount</td><td>−{inr2(q.discount)}</td></tr>}
          {num(q.igst) > 0 ? <tr><td className="text-ink-soft">IGST</td><td>{inr2(q.igst)}</td></tr> : <><tr><td className="text-ink-soft">CGST</td><td>{inr2(q.cgst)}</td></tr><tr><td className="text-ink-soft">SGST</td><td>{inr2(q.sgst)}</td></tr></>}
          <tr className="border-t-2 border-ink text-[14px] font-bold"><td className="pt-1">Total</td><td className="pt-1">{inr2(q.total)}</td></tr>
        </tbody></table>
      </div>
      <footer className="mt-10 flex justify-between border-t border-line pt-3 text-[11px] text-ink-soft"><span>Thank you for considering Paconia.</span><span>For {biz.legalName}</span></footer>
    </article>
  );
}
