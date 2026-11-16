import { requireStaff } from '@/lib/auth';
import { lineBuilderData } from '@/lib/deskData';
import { PageHead } from '@/components/ui';
import LineBuilder from '@/components/desk/LineBuilder';
import { createDeskOrder } from '@/app/actions/desk-orders';

export const metadata = { title: 'New order' };

export default async function NewOrder({ searchParams }: { searchParams: { customer?: string } }) {
  await requireStaff('orders');
  const d = await lineBuilderData();
  return (
    <>
      <PageHead title="New order" sub="Walk-in or B2B order. Prices come from the same engine as the website; enter a special rate to override." back={{ href: '/desk/orders', label: 'Orders' }} />
      <LineBuilder mode="order" {...d} action={createDeskOrder} preset={{ customerId: searchParams.customer }} />
    </>
  );
}
