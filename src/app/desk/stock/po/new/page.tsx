import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Empty, PageHead } from '@/components/ui';
import { num } from '@/lib/format';
import PoBuilder from '@/components/desk/PoBuilder';
export const metadata = { title: 'New purchase order' };
export default async function NewPO() {
  await requireStaff('stock');
  const [vendors, mats] = await Promise.all([db.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }), db.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } })]);
  return (
    <>
      <PageHead title="New purchase order" back={{ href: '/desk/stock?tab=purchases', label: 'Purchase orders' }} />
      {vendors.length ? <PoBuilder vendors={vendors} mats={mats.map((m) => ({ id: m.id, code: m.code, name: m.name, uom: m.uom, cost: num(m.cost), vendorId: m.vendorId, reorderQty: num(m.reorderQty), low: num(m.onHand) <= num(m.reorderLevel) }))} />
        : <div className="card"><Empty title="Add a vendor first" action={<Link href="/desk/stock?tab=vendors" className="btn-secondary">Vendors</Link>} /></div>}
    </>
  );
}
