import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getBusiness } from '@/lib/settings';
import QuoteDoc from '@/components/QuoteDoc';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Quotation', robots: { index: false } };

export default async function PrintQuote({ params }: { params: { number: string } }) {
  await requireStaff('quotes');
  const q = await db.quote.findUnique({ where: { number: params.number }, include: { customer: true, lines: { orderBy: { sort: 'asc' } } } });
  if (!q) notFound();
  return (
    <div className="min-h-screen bg-mist py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2"><Link href={`/desk/quotes/${q.number}`} className="text-sm text-ink-soft hover:text-ink">← Quote {q.number}</Link><PrintButton /></div>
      <QuoteDoc q={q} biz={await getBusiness()} />
    </div>
  );
}
