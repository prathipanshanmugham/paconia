import { requireStaff } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import CustomerForm from '@/components/desk/CustomerForm';
export const metadata = { title: 'Add customer' };
export default async function NewCustomer() {
  const s = await requireStaff('customers');
  return <><PageHead title="Add customer" back={{ href: '/desk/customers', label: 'Customers' }} /><div className="card-pad max-w-3xl"><CustomerForm money={['OWNER', 'MANAGER', 'ACCOUNTS'].includes(s.role)} /></div></>;
}
