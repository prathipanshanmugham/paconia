import { amountInWords, dateFmt, inr2, num, round2 } from '@/lib/format';
import type { Business, InvoicePrefs } from '@/lib/settings';
import type { InvoiceLine } from '@/lib/orders';

type Inv = {
  number: string; issuedAt: Date; dueDate: Date; placeOfSupply: string; interstate: boolean; billName: string; billGstin: string | null; billAddress: string;
  lines: unknown; taxable: unknown; cgst: unknown; sgst: unknown; igst: unknown; total: unknown; cancelled: boolean;
};

/** A GST tax invoice laid out for A4. Used by the customer account and the Desk. */
export default function InvoiceDoc({ inv, biz, prefs, orderNumber, paid }: { inv: Inv; biz: Business; prefs: InvoicePrefs; orderNumber: string; paid: number }) {
  const lines = inv.lines as InvoiceLine[];
  const gross = lines.reduce((a, l) => a + l.amount, 0);
  const taxable = num(inv.taxable), total = num(inv.total);
  const discount = round2(gross - taxable);
  const factor = gross ? taxable / gross : 1;
  const groups = new Map<string, { hsn: string; rate: number; taxable: number }>();
  for (const l of lines) {
    const k = `${l.hsn}|${l.gstRate}`;
    const g = groups.get(k) || { hsn: l.hsn, rate: l.gstRate, taxable: 0 };
    g.taxable += l.amount * factor;
    groups.set(k, g);
  }
  const due = round2(total - paid);
  return (
    <article className="print-sheet relative mx-auto max-w-[210mm] bg-white p-8 text-[12.5px] leading-snug text-ink shadow-card print:p-0 print:shadow-none">
      {inv.cancelled && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold text-rose-600/20">CANCELLED</div>}
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="Paconia" className="mb-2 h-10 w-auto" />
          <div className="font-semibold">{biz.legalName}{biz.tradeName ? ` (${biz.tradeName})` : ''}</div>
          <div className="max-w-[320px] text-ink-soft">{biz.address}, {biz.city} {biz.pincode}, {biz.state}</div>
          <div className="text-ink-soft">{biz.phone} · {biz.email}</div>
          <div className="mt-1 font-mono text-[12px]">GSTIN {biz.gstin}</div>
        </div>
        <div className="text-right">
          <h1 className="font-display text-2xl font-bold">Tax Invoice</h1>
          <table className="ml-auto mt-2 text-right"><tbody>
            <tr><td className="pr-3 text-ink-soft">Invoice no.</td><td className="font-mono font-semibold">{inv.number}</td></tr>
            <tr><td className="pr-3 text-ink-soft">Date</td><td>{dateFmt(inv.issuedAt)}</td></tr>
            <tr><td className="pr-3 text-ink-soft">Order</td><td className="font-mono">{orderNumber}</td></tr>
            <tr><td className="pr-3 text-ink-soft">Due</td><td>{dateFmt(inv.dueDate)}</td></tr>
          </tbody></table>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-6 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Bill to</div>
          <div className="mt-1 font-semibold">{inv.billName}</div>
          <div className="text-ink-soft">{inv.billAddress}</div>
          {inv.billGstin && <div className="mt-1 font-mono text-[12px]">GSTIN {inv.billGstin}</div>}
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Place of supply</div>
          <div className="mt-1">{inv.placeOfSupply}</div>
          <div className="text-ink-soft">{inv.interstate ? 'Inter-state supply · IGST' : 'Intra-state supply · CGST + SGST'}</div>
        </div>
      </section>
      <table className="w-full border-collapse">
        <thead><tr className="border-y border-ink text-left text-[11px] uppercase tracking-wide">
          <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Description</th><th className="py-2 pr-2">HSN</th><th className="py-2 pr-2 text-right">Qty</th><th className="py-2 pr-2 text-right">Rate</th><th className="py-2 pr-2 text-right">GST</th><th className="py-2 text-right">Amount</th>
        </tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="py-2 pr-2">{i + 1}</td>
              <td className="py-2 pr-2"><div className="font-medium">{l.name}</div><div className="text-[11.5px] text-ink-soft">{l.summary}</div></td>
              <td className="py-2 pr-2 font-mono">{l.hsn}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{l.qty.toLocaleString('en-IN')}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{l.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{l.gstRate}%</td>
              <td className="py-2 text-right tabular-nums">{inr2(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section className="mt-4 grid grid-cols-[1fr_260px] gap-6">
        <div>
          <table className="w-full text-[11.5px]">
            <thead><tr className="border-b border-line text-left text-ink-faint"><th className="py-1">HSN</th><th className="py-1 text-right">Taxable</th>{inv.interstate ? <th className="py-1 text-right">IGST</th> : <><th className="py-1 text-right">CGST</th><th className="py-1 text-right">SGST</th></>}</tr></thead>
            <tbody>{[...groups.values()].map((g) => {
              const t = g.taxable * g.rate / 100;
              return <tr key={g.hsn + g.rate} className="border-b border-line/60"><td className="py-1 font-mono">{g.hsn}</td><td className="py-1 text-right tabular-nums">{inr2(g.taxable)}</td>
                {inv.interstate ? <td className="py-1 text-right tabular-nums">{g.rate}% · {inr2(t)}</td> : <><td className="py-1 text-right tabular-nums">{g.rate / 2}% · {inr2(t / 2)}</td><td className="py-1 text-right tabular-nums">{g.rate / 2}% · {inr2(t / 2)}</td></>}</tr>;
            })}</tbody>
          </table>
          <p className="mt-3"><span className="text-ink-soft">Amount in words:</span> <b>{amountInWords(total)}</b></p>
        </div>
        <table className="w-full self-start text-right tabular-nums"><tbody>
          <tr><td className="py-0.5 text-ink-soft">Sub-total</td><td>{inr2(gross)}</td></tr>
          {discount > 0 && <tr><td className="py-0.5 text-ink-soft">Less discount</td><td>−{inr2(discount)}</td></tr>}
          <tr><td className="py-0.5 text-ink-soft">Taxable value</td><td>{inr2(taxable)}</td></tr>
          {inv.interstate ? <tr><td className="py-0.5 text-ink-soft">IGST</td><td>{inr2(inv.igst)}</td></tr> : <>
            <tr><td className="py-0.5 text-ink-soft">CGST</td><td>{inr2(inv.cgst)}</td></tr>
            <tr><td className="py-0.5 text-ink-soft">SGST</td><td>{inr2(inv.sgst)}</td></tr></>}
          <tr className="border-t-2 border-ink text-[14px] font-bold"><td className="pt-1.5">Total</td><td className="pt-1.5">{inr2(total)}</td></tr>
          {paid > 0 && <tr><td className="py-0.5 text-ink-soft">Received</td><td>{inr2(paid)}</td></tr>}
          {paid > 0 && <tr className="font-semibold"><td className="py-0.5">Balance due</td><td>{inr2(Math.max(0, due))}</td></tr>}
        </tbody></table>
      </section>
      <footer className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-4 text-[11.5px]">
        <div>
          {(biz.bankAccount || biz.upiId) && <>
            <div className="font-semibold">Pay to</div>
            {biz.bankAccount && <div className="text-ink-soft">{biz.bankName} · A/c {biz.bankAccount} · IFSC {biz.bankIfsc}{biz.bankBranch ? ` · ${biz.bankBranch}` : ''}</div>}
            {biz.upiId && <div className="text-ink-soft">UPI {biz.upiId}</div>}
          </>}
          <p className="mt-2 text-ink-soft">{prefs.terms}</p>
        </div>
        <div className="text-right">
          <div className="text-ink-soft">For {biz.legalName}</div>
          <div className="mt-10 border-t border-line pt-1 text-ink-soft">Authorised signatory</div>
          <p className="mt-2 text-[10.5px] text-ink-faint">This is a computer-generated invoice.</p>
        </div>
      </footer>
    </article>
  );
}
