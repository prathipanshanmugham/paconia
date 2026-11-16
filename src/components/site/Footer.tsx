import Link from 'next/link';
import { getBusiness } from '@/lib/settings';
import { FAMILIES } from '@/lib/catalog';
import { Logo, TonerStrip } from '@/components/ui';

export default async function Footer() {
  const b = await getBusiness();
  return (
    <footer className="mt-20 border-t border-line bg-white no-print">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 text-sm text-ink-soft">
          <Logo />
          <p>{b.tradeName}, a unit of {b.legalName}.<br />{b.address}, {b.city} {b.pincode}</p>
          <p className="mono">GSTIN {b.gstin}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Shop</h3>
          <ul className="space-y-2 text-sm text-ink-soft">{FAMILIES.map((f) => <li key={f.key}><Link href={`/shop/${f.slug}`} className="hover:text-ink">{f.name}</Link></li>)}</ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Help</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li><Link href="/quote" className="hover:text-ink">Bulk & custom quotes</Link></li>
            <li><Link href="/track" className="hover:text-ink">Track an order</Link></li>
            <li><Link href="/artwork-guide" className="hover:text-ink">Artwork guide</Link></li>
            <li><Link href="/contact" className="hover:text-ink">Contact us</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">Visit or call</h3>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>{b.hours}</li>
            <li>Phone / WhatsApp: <span className="text-ink">{b.phone}</span></li>
            <li className="break-all">{b.email}</li>
          </ul>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
            <li><Link href="/policies/terms" className="hover:text-ink">Terms</Link></li>
            <li><Link href="/policies/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/policies/refunds" className="hover:text-ink">Refunds & cancellations</Link></li>
            <li><Link href="/policies/shipping" className="hover:text-ink">Shipping & delivery</Link></li>
          </ul>
        </div>
      </div>
      <TonerStrip />
    </footer>
  );
}
