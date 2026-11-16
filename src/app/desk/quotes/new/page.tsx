import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { lineBuilderData } from '@/lib/deskData';
import { Notice, PageHead } from '@/components/ui';
import LineBuilder from '@/components/desk/LineBuilder';
import { createQuote } from '@/app/actions/desk-quotes';

export const metadata = { title: 'New quote' };

export default async function NewQuote({ searchParams }: { searchParams: { enquiry?: string; customer?: string } }) {
  await requireStaff('quotes');
  const d = await lineBuilderData();
  const e = searchParams.enquiry ? await db.enquiry.findUnique({ where: { id: searchParams.enquiry } }) : null;
  const match = e ? d.customers.find((c) => e.customerId === c.id || c.phone.replace(/\D/g, '').slice(-10) === e.phone.replace(/\D/g, '').slice(-10)) : null;
  return (
    <>
      <PageHead title="New quote" sub="Build the quote with live prices, then print it or send it on WhatsApp." back={{ href: '/desk/quotes', label: 'Quotes' }} />
      {e && <div className="mb-5"><Notice tone="info"><b>From enquiry:</b> {e.product} · {e.qty} — {e.details}</Notice></div>}
      <LineBuilder mode="quote" {...d} action={createQuote}
        preset={{ customerId: match?.id || searchParams.customer, newCustomer: e && !match ? { name: e.name, phone: e.phone, company: e.company || '', email: e.email || '' } : undefined, enquiryId: e?.id, notes: e ? `For your enquiry: ${e.product}, ${e.qty}.` : undefined }} />
    </>
  );
}
