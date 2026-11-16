import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getSession, isStaff } from '@/lib/auth';
import { getBusiness, getInvoicePrefs } from '@/lib/settings';
import { num } from '@/lib/format';
import InvoiceDoc from '@/components/InvoiceDoc';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invoice', robots: { index: false } };

export default async function PrintInvoice({ params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) redirect(`/signin?next=/print/invoice/${params.id}`);
  const inv = await db.invoice.findUnique({ where: { id: params.id }, include: { order: true, customer: true } });
  if (!inv) notFound();
  const staff = isStaff(s.role);
  if (!staff && inv.customer.userId !== s.userId) notFound();
  const [biz, prefs] = await Promise.all([getBusiness(), getInvoicePrefs()]);
  return (
    <div className="min-h-screen bg-mist py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-2">
        <Link href={staff ? `/desk/orders/${inv.order.number}` : `/account/orders/${inv.order.number}`} className="text-sm text-ink-soft hover:text-ink">← Back to order {inv.order.number}</Link>
        <PrintButton />
      </div>
      <InvoiceDoc inv={inv} biz={biz} prefs={prefs} orderNumber={inv.order.number} paid={num(inv.order.amountPaid)} />
    </div>
  );
}
