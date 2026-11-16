import { db } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { getBusiness } from '@/lib/settings';
import { EnquiryForm } from '@/components/site/PublicForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk & custom quote', description: 'Ask Paconia for a quote on large runs, custom boxes, mixed designs or monthly orders.' };

export default async function Quote() {
  const s = await getSession();
  const c = s ? await db.customer.findUnique({ where: { userId: s.userId } }) : null;
  const products = (await db.product.findMany({ where: { active: true }, orderBy: { sort: 'asc' }, select: { name: true } })).map((p) => p.name);
  const b = await getBusiness();
  return (
    <div className="wrap grid gap-10 py-12 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="kicker">Bulk & custom</p>
        <h1 className="mt-2 text-4xl font-bold">Tell us what you are packing.</h1>
        <p className="mt-4 text-ink-soft">Use this for runs over 5,000, custom box sizes, many designs at once, or regular monthly supply. We reply with a quote and a sample plan within one working day.</p>
        <ul className="mt-6 space-y-3 text-sm">
          <li className="flex gap-3"><span className="text-leaf-600">●</span>Business accounts can get 15-day credit after the first few orders.</li>
          <li className="flex gap-3"><span className="text-leaf-600">●</span>A printed sample before a big run, on request.</li>
          <li className="flex gap-3"><span className="text-leaf-600">●</span>GST invoice on every order. Your GSTIN goes on the bill.</li>
        </ul>
        <p className="mt-8 text-sm text-ink-soft">Prefer to talk? Call <a href={`tel:${b.phone.replace(/\s/g, '')}`} className="font-semibold text-ink underline">{b.phone}</a> or <a href={`https://wa.me/${b.whatsapp}`} className="font-semibold text-ink underline">WhatsApp us</a>.</p>
      </div>
      <div className="card-pad"><EnquiryForm products={products} initial={{ name: c?.name || s?.name || '', phone: c?.phone || '', email: c?.email || s?.email || '', company: c?.company || '' }} /></div>
    </div>
  );
}
