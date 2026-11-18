import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Empty, PageHead, Tabs } from '@/components/ui';
import { dateShort, dateTime, inr, inr2, num, qtyFmt } from '@/lib/format';
import { VendorForm } from '@/components/desk/StockForms';
import Icon from '@/components/desk/Icon';
import TabSelect from '@/components/TabSelect';
import type { MaterialCategory } from '@/generated/prisma/client';

export const metadata = { title: 'Stock' };
const CAT: Record<MaterialCategory, string> = { MEDIA: 'Print media', BLANK: 'Pouch blanks', LASER: 'Laser sheets', TONER: 'Toner', FILM: 'Lamination film', CONSUMABLE: 'Consumables', PACKING: 'Packing' };
const PO_TONE = { DRAFT: 'muted', ORDERED: 'info', RECEIVED: 'good', CANCELLED: 'bad' } as const;

export default async function Stock({ searchParams }: { searchParams: { tab?: string; filter?: string; cat?: string } }) {
  await requireStaff('stock');
  const tab = ['materials', 'moves', 'purchases', 'vendors'].includes(searchParams.tab || '') ? searchParams.tab! : 'materials';
  const href = (t: string) => `/desk/stock${t === 'materials' ? '' : `?tab=${t}`}`;
  return (
    <>
      <PageHead title="Stock & purchases" actions={<><Link href="/desk/stock/po/new" className="btn-primary"><Icon name="plus" /> Purchase order</Link><Link href="/desk/stock/new" className="btn-secondary">Add material</Link></>} />
      <Tabs current={href(tab)} items={[{ href: href('materials'), label: 'Materials' }, { href: href('moves'), label: 'Movements' }, { href: href('purchases'), label: 'Purchase orders' }, { href: href('vendors'), label: 'Vendors' }]} />
      {tab === 'materials' && <Materials filter={searchParams.filter} cat={searchParams.cat} />}
      {tab === 'moves' && <Moves />}
      {tab === 'purchases' && <Purchases />}
      {tab === 'vendors' && <Vendors />}
    </>
  );
}

async function Materials({ filter, cat }: { filter?: string; cat?: string }) {
  const all = await db.material.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }], include: { vendor: true } });
  const low = all.filter((m) => m.active && num(m.onHand) <= num(m.reorderLevel));
  const list = all.filter((m) => (filter === 'low' ? low.includes(m) : true) && (cat ? m.category === cat : true));
  const value = all.reduce((a, m) => a + num(m.onHand) * num(m.cost), 0);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64"><span className="label">Show</span><TabSelect current={filter === 'low' ? '/desk/stock?filter=low' : cat ? `/desk/stock?cat=${cat}` : '/desk/stock'} items={[{ href: '/desk/stock', label: 'All materials' }, { href: '/desk/stock?filter=low', label: `Below reorder level (${low.length})` }, ...Object.entries(CAT).map(([k, v]) => ({ href: `/desk/stock?cat=${k}`, label: v }))]} /></div>
        <p className="ml-auto pb-2 text-sm text-ink-soft">Stock value at cost: <b className="num text-ink">{inr(value)}</b></p>
      </div>
      <div className="card overflow-x-auto">{list.length ? <table className="tbl min-w-[760px]"><thead><tr><th>Material</th><th>Type</th><th className="text-right">On hand</th><th className="text-right">Reorder at</th><th className="text-right">Cost</th><th>Vendor</th></tr></thead>
        <tbody>{list.map((m) => {
          const isLow = num(m.onHand) <= num(m.reorderLevel);
          return <tr key={m.id} className={`rowlink ${m.active ? '' : 'opacity-50'}`}>
            <td><Link href={`/desk/stock/${m.code}`} className="flex items-center gap-2 font-semibold hover:underline">{m.colour && <span className="h-4 w-4 rounded border border-line-strong" style={{ background: m.colour }} />}{m.name}</Link><div className="mono text-xs text-ink-soft">{m.code}{m.needsWhite ? ' · white ink' : ''}</div></td>
            <td className="text-sm">{CAT[m.category]}</td>
            <td className={`num text-right ${isLow ? 'font-semibold text-amber-800' : ''}`}>{qtyFmt(m.onHand, 2)} {m.uom}{isLow && m.active && <div><Badge tone="warn">Reorder {qtyFmt(m.reorderQty)}</Badge></div>}</td>
            <td className="num text-right text-ink-soft">{qtyFmt(m.reorderLevel)}</td><td className="num text-right">{inr2(m.cost)}</td><td className="text-sm">{m.vendor?.name || '—'}</td>
          </tr>;
        })}</tbody></table> : <Empty title="Nothing here" />}</div>
    </>
  );
}

async function Moves() {
  const moves = await db.stockMove.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { material: true } });
  const users = await db.user.findMany({ where: { id: { in: [...new Set(moves.map((m) => m.userId).filter(Boolean))] as string[] } }, select: { id: true, name: true } });
  return <div className="card overflow-x-auto">{moves.length ? <table className="tbl min-w-[720px]"><thead><tr><th>When</th><th>Material</th><th>Type</th><th className="text-right">Qty</th><th>Ref / note</th><th>By</th></tr></thead>
    <tbody>{moves.map((m) => <tr key={m.id}><td className="text-sm">{dateTime(m.createdAt)}</td><td><Link href={`/desk/stock/${m.material.code}`} className="hover:underline">{m.material.name}</Link></td><td><Badge tone={m.type === 'PURCHASE' ? 'good' : m.type === 'ISSUE' ? 'info' : 'muted'}>{m.type.toLowerCase()}</Badge></td><td className={`num text-right ${num(m.qty) < 0 ? 'text-rose-700' : 'text-leaf-700'}`}>{num(m.qty) > 0 ? '+' : ''}{qtyFmt(m.qty, 2)} {m.material.uom}</td><td className="text-sm">{m.ref && <span className="mono">{m.ref} </span>}<span className="text-ink-soft">{m.note}</span></td><td className="text-sm">{users.find((u) => u.id === m.userId)?.name || '—'}</td></tr>)}</tbody></table> : <Empty title="No movements yet" />}</div>;
}

async function Purchases() {
  const pos = await db.purchaseOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: { vendor: true, lines: true } });
  return <div className="card overflow-x-auto">{pos.length ? <table className="tbl min-w-[720px]"><thead><tr><th>PO</th><th>Vendor</th><th>Status</th><th>Expected</th><th className="text-right">Lines</th><th className="text-right">Total</th></tr></thead>
    <tbody>{pos.map((p) => <tr key={p.id} className="rowlink"><td><Link href={`/desk/stock/po/${p.number}`} className="mono font-semibold hover:underline">{p.number}</Link><div className="text-xs text-ink-soft">{dateShort(p.createdAt)}</div></td><td>{p.vendor.name}</td><td><Badge tone={PO_TONE[p.status]}>{p.status === 'ORDERED' && p.lines.some((l) => num(l.receivedQty) > 0) ? 'Part received' : p.status.toLowerCase()}</Badge></td><td>{dateShort(p.expectedAt)}</td><td className="num text-right">{p.lines.length}</td><td className="num text-right">{inr2(p.total)}</td></tr>)}</tbody></table>
    : <Empty title="No purchase orders" action={<Link href="/desk/stock/po/new" className="btn-secondary">Create one</Link>} />}</div>;
}

async function Vendors() {
  const vendors = await db.vendor.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { materials: true, pos: true } } } });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      <div className="space-y-3">{vendors.map((v) => (
        <details key={v.id} className="card p-4"><summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span><b>{v.name}</b> <span className="text-sm text-ink-soft">{v.city ? `· ${v.city}` : ''} · {v._count.materials} materials · {v._count.pos} POs</span></span><span className="text-sm text-ink-soft">{v.phone}</span></summary>
          <div className="mt-4 border-t border-line pt-4"><VendorForm v={v} /></div></details>
      ))}{!vendors.length && <div className="card"><Empty title="No vendors yet" /></div>}</div>
      <section className="card-pad h-fit"><h2 className="mb-3 font-semibold">Add vendor</h2><VendorForm /></section>
    </div>
  );
}
