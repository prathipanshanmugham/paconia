import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import { MaterialForm } from '@/components/desk/StockForms';
export const metadata = { title: 'Add material' };
export default async function NewMaterial() {
  await requireStaff('stock');
  const vendors = await db.vendor.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return <><PageHead title="Add material" back={{ href: '/desk/stock', label: 'Stock' }} /><div className="card-pad max-w-3xl"><MaterialForm vendors={vendors} /></div></>;
}
