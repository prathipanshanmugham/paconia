import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { STAGE_LABEL, routeOf } from '@/lib/orders';
import { dateFmt, dateTime, qtyFmt } from '@/lib/format';
import { fileUrl } from '@/lib/files';
import PrintButton from '@/components/PrintButton';
import { FINISH_LABEL, type Spec } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Job tickets', robots: { index: false } };

export default async function JobTickets({ params }: { params: { number: string } }) {
  await requireStaff('production');
  const o = await db.order.findUnique({
    where: { number: params.number },
    include: { customer: true, items: { include: { job: { include: { machine: true } } } }, proofs: { where: { status: 'APPROVED' }, orderBy: { version: 'desc' }, take: 1, include: { file: true } }, files: { where: { kind: 'ARTWORK' } } },
  });
  if (!o) notFound();
  const mats = await db.material.findMany({ select: { code: true, name: true, uom: true } });
  const matName = (c: string) => mats.find((m) => m.code === c);
  const proof = o.proofs[0];
  return (
    <div className="min-h-screen bg-mist py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2"><Link href={`/desk/orders/${o.number}`} className="text-sm text-ink-soft hover:text-ink">← Order {o.number}</Link><PrintButton label="Print tickets" /></div>
      {o.items.map((it) => {
        const j = it.job;
        if (!j) return null;
        const spec = (it.spec || {}) as Partial<Spec>;
        const est = (it.estimate || {}) as { materials?: { code: string; qty: number }[]; minutes?: number };
        return (
          <article key={it.id} className="print-sheet mx-auto mb-6 max-w-[210mm] break-after-page bg-white p-8 text-[13px] shadow-card print:mb-0 print:shadow-none">
            <header className="flex items-start justify-between border-b-2 border-ink pb-3">
              <div><p className="text-xs uppercase tracking-[0.2em] text-ink-faint">Paconia job ticket</p><h1 className="mono text-3xl font-bold">{j.number}</h1><p className="mono">Order {o.number}</p></div>
              <div className="text-right">{j.rush && <p className="mb-1 inline-block rounded bg-ink px-2 py-0.5 text-sm font-bold text-white">RUSH</p>}<p className="text-ink-soft">Due</p><p className="text-xl font-bold">{dateFmt(j.dueDate)}</p></div>
            </header>
            <section className="grid grid-cols-2 gap-6 py-4">
              <div><p className="text-xs uppercase text-ink-faint">Customer</p><p className="text-lg font-semibold">{o.customer.company || o.customer.name}</p><p>{o.customer.phone}</p><p className="mt-2 text-xs uppercase text-ink-faint">Delivery</p><p>{o.fulfilment === 'PICKUP' ? 'Pickup at studio' : `Courier · ${o.shipCity || ''} ${o.shipPincode || ''}`}</p></div>
              <div><p className="text-xs uppercase text-ink-faint">Product</p><p className="text-lg font-semibold">{it.name}</p><p className="text-2xl font-bold">{qtyFmt(it.qty)} pcs</p></div>
            </section>
            <table className="w-full border-collapse text-left"><tbody>
              {[
                ['Specification', it.summary],
                ['Size', spec.size === 'custom' ? `Custom ${spec.w} × ${spec.h}${spec.d ? ` × ${spec.d}` : ''} mm` : it.summary.split(' · ')[0]],
                ['Material', spec.material ? (matName(spec.material)?.name || spec.material) : '—'],
                ['Finish', spec.finish ? FINISH_LABEL[spec.finish] || spec.finish : '—'],
                ...(spec.sides ? [['Print sides', spec.sides === 2 ? 'Both sides' : 'One side']] : []),
                ...(j.sheets ? [['Sheets', `${j.sheets} SRA3 sheets · ${j.ups} up (incl. setup and waste)`]] : []),
                ...(est.minutes ? [['Laser time', `about ${Math.ceil(est.minutes)} min`]] : []),
              ].map(([k, v]) => <tr key={k} className="border-b border-line"><th className="w-40 py-2 pr-4 align-top font-medium text-ink-soft">{k}</th><td className="py-2">{v}</td></tr>)}
            </tbody></table>
            <section className="mt-5 grid grid-cols-2 gap-6">
              <div><p className="mb-2 text-xs uppercase text-ink-faint">Route</p><ol className="space-y-2">{routeOf(it.estimate).filter((s) => s !== 'PREPRESS').map((s) => <li key={s} className="flex items-center gap-3"><span className="h-5 w-5 border-2 border-ink" /><span className="font-medium">{STAGE_LABEL[s]}</span><span className="flex-1 border-b border-dotted border-ink-faint" /><span className="text-xs text-ink-faint">sign / time</span></li>)}</ol></div>
              <div><p className="mb-2 text-xs uppercase text-ink-faint">Materials to issue</p><ul className="space-y-1">{(est.materials || []).map((m) => <li key={m.code} className="flex justify-between gap-3"><span>{matName(m.code)?.name || m.code}</span><span className="num">{qtyFmt(m.qty, 2)} {matName(m.code)?.uom}</span></li>)}</ul>{j.materialsIssued && <p className="mt-2 text-xs text-leaf-700">Issued from stock</p>}</div>
            </section>
            <section className="mt-5 grid grid-cols-[1fr_200px] gap-6 border-t border-line pt-4">
              <div><p className="text-xs uppercase text-ink-faint">Artwork files</p><ul className="mt-1 text-xs">{o.files.filter((f) => !f.orderItemId || f.orderItemId === it.id).map((f) => <li key={f.id}>{f.name}</li>)}</ul>
                {o.notes && <><p className="mt-3 text-xs uppercase text-ink-faint">Customer note</p><p>{o.notes}</p></>}
                {o.internalNotes && <><p className="mt-3 text-xs uppercase text-ink-faint">Team note</p><p>{o.internalNotes}</p></>}</div>
              {proof?.file && /^image\//.test(proof.file.mime) && <div><p className="text-xs uppercase text-ink-faint">Approved proof v{proof.version}</p>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={fileUrl(proof.file.id)} alt="Approved proof" className="mt-1 w-full border border-line" /></div>}
            </section>
            <p className="mt-6 text-[10px] text-ink-faint">Printed {dateTime(new Date())}</p>
          </article>
        );
      })}
    </div>
  );
}
