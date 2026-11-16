import { requireStaff } from '@/lib/auth';
import { lineBuilderData } from '@/lib/deskData';
import { PageHead } from '@/components/ui';
import Calculators from '@/components/desk/Calculators';
export const metadata = { title: 'Tools' };
export default async function Tools() {
  await requireStaff('tools');
  const d = await lineBuilderData();
  return <><PageHead title="Tools" sub="Calculators for the shop floor and the counter. Prices use the live rates and material costs." /><Calculators products={d.products} mats={d.mats} ps={d.ps} /></>;
}
