import { requireStaff } from '@/lib/auth';
import { lineBuilderData } from '@/lib/deskData';
import { PageHead } from '@/components/ui';
import Calculators from '@/components/desk/Calculators';
export const metadata = { title: 'Calculators' };
export default async function Tools() {
  const s = await requireStaff('tools');
  const d = await lineBuilderData(s.role);
  return <><PageHead title="Calculators" sub="Calculators for the shop floor and the counter. Prices use the live rates and material costs." /><Calculators products={d.products} mats={d.mats} ps={d.ps} /></>;
}
