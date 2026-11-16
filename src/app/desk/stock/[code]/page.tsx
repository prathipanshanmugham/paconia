import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, PageHead, Stat } from '@/components/ui';
import { dateTime, inr, inr2, num, qtyFmt } from '@/lib/format';
import { AdjustForm, MaterialForm } from '@/components/desk/StockForms';

export const metadata = { title: 'Material' };

export default async function MaterialPage({ params }: { params: { code: string } }) {
  await requireStaff('stock');
  const m = await db.material.findUnique({ where: { code: decodeURIComponent(params.code) }, include: { moves: { orderBy: { createdAt: 'desc' }, take: 50 }, vendor: true } });
  if (!m) notFound();
  const vendors = await db.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const used30 = -m.moves.filter((x) => x.type === 'ISSUE' && x.createdAt > new Date(Date.now() - 30 * 86400000)).reduce((a, x) => a + num(x.qty), 0);
  return (
    <>
      <PageHead back={{ href: '/desk/stock', label: 'Stock' }} title={m.name} sub={<><span className="mono">{m.code}</span>{m.vendor ? ` · from ${m.vendor.name}` : ''}</>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="On hand" value={`${qtyFmt(m.onHand, 2)} ${m.uom}`} tone={num(m.onHand) <= num(m.reorderLevel) ? 'warn' : undefined} sub={`reorder below ${qtyFmt(m.reorderLevel)}`} />
        <Stat label="Used in last 30 days" value={`${qtyFmt(used30, 1)} ${m.uom}`} sub={used30 > 0 ? `about ${Math.max(0, Math.floor(num(m.onHand) / (used30 / 30)))} days left` : undefined} />
        <Stat label="Cost / unit" value={inr2(m.cost)} sub={`quote price ${inr2(m.price)}`} />
        <Stat label="Stock value" value={inr(num(m.onHand) * num(m.cost))} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="card overflow-x-auto"><h2 className="border-b border-line px-5 py-3 font-semibold">Movements</h2>
            <table className="tbl"><tbody>{m.moves.map((x) => <tr key={x.id}><td className="text-sm">{dateTime(x.createdAt)}</td><td><Badge tone={x.type === 'PURCHASE' ? 'good' : x.type === 'ISSUE' ? 'info' : 'muted'}>{x.type.toLowerCase()}</Badge></td><td className={`num text-right ${num(x.qty) < 0 ? 'text-rose-700' : 'text-leaf-700'}`}>{num(x.qty) > 0 ? '+' : ''}{qtyFmt(x.qty, 2)}</td><td className="text-sm">{x.ref && <span className="mono">{x.ref} </span>}<span className="text-ink-soft">{x.note}</span></td></tr>)}</tbody></table>
            {!m.moves.length && <p className="px-5 py-6 text-sm text-ink-soft">No movements yet.</p>}</section>
          <section className="card-pad"><h2 className="mb-4 font-semibold">Details</h2><MaterialForm m={m} vendors={vendors} /></section>
        </div>
        <section className="card-pad h-fit"><h2 className="mb-3 font-semibold">Adjust stock</h2><AdjustForm id={m.id} uom={m.uom} /></section>
      </div>
    </>
  );
}
