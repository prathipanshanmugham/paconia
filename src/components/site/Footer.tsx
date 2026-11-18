import Link from 'next/link';
import { getBusiness } from '@/lib/settings';
import { FAMILIES } from '@/lib/catalog';
import { Logo } from '@/components/ui';

export default async function Footer() {
  const b = await getBusiness();
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo className="h-14" />
          <p className="mt-4 max-w-xs text-sm text-ink-soft">Custom labels, boxes, pouches, cards and laser-cut pieces, printed in small runs at our studio in Perundurai.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Products</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">{FAMILIES.map((f) => <li key={f.key}><Link href={`/shop/${f.slug}`} className="hover:text-ink">{f.name}</Link></li>)}</ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Help</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li><Link href="/quote" className="hover:text-ink">Bulk and custom quotes</Link></li>
            <li><Link href="/track" className="hover:text-ink">Track an order</Link></li>
            <li><Link href="/artwork-guide" className="hover:text-ink">Artwork guide</Link></li>
            <li><Link href="/account" className="hover:text-ink">My orders and invoices</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Studio</h2>
          <address className="mt-3 text-sm not-italic text-ink-soft">{b.address}, {b.city} {b.pincode}<br />{b.hours}</address>
          <p className="mt-2 text-sm"><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="font-semibold hover:underline">{b.phone}</a></p>
          <p className="text-sm"><a href={`https://wa.me/${b.whatsapp}`} className="text-sky-700 hover:underline">WhatsApp us</a></p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-ink-faint">
          <span>{b.legalName}. GSTIN {b.gstin}</span>
          <nav className="flex flex-wrap gap-4" aria-label="Policies"><Link href="/policies/terms" className="hover:text-ink">Terms</Link><Link href="/policies/privacy" className="hover:text-ink">Privacy</Link><Link href="/policies/refunds" className="hover:text-ink">Refunds</Link><Link href="/policies/shipping" className="hover:text-ink">Shipping</Link></nav>
        </div>
      </div>
    </footer>
  );
}
