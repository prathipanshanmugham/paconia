import Link from 'next/link';
import { getBusiness } from '@/lib/settings';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact' };
export default async function Contact() {
  const b = await getBusiness();
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.address}, ${b.city} ${b.pincode}`)}`;
  return (
    <div className="wrap py-12">
      <h1 className="text-4xl font-bold">Visit or message us</h1>
      <p className="mt-2 max-w-xl text-ink-soft">Walk in with your logo on a pen drive or phone. We print samples in front of you when the machine is free.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <div className="card-pad"><p className="kicker">Studio</p><p className="mt-2 font-semibold">{b.tradeName} · {b.legalName}</p><p className="mt-1 text-sm text-ink-soft">{b.address}<br />{b.city} {b.pincode}<br />{b.state}</p><a href={map} target="_blank" rel="noreferrer" className="btn-secondary btn-sm mt-4">Open in Maps</a></div>
        <div className="card-pad"><p className="kicker">Talk to us</p><p className="mt-2"><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="font-display text-2xl font-bold hover:underline">{b.phone}</a></p><p className="mt-1 text-sm text-ink-soft">{b.hours}</p><div className="mt-4 flex flex-wrap gap-2"><a href={`https://wa.me/${b.whatsapp}`} className="btn-primary btn-sm">WhatsApp</a><a href={`mailto:${b.email}`} className="btn-secondary btn-sm">Email</a></div></div>
        <div className="card-pad"><p className="kicker">Already ordered?</p><p className="mt-2 text-sm text-ink-soft">Check progress, approve proofs and download GST invoices from your account.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/account" className="btn-secondary btn-sm">My orders</Link><Link href="/track" className="btn-ghost btn-sm">Track without signing in</Link></div></div>
      </div>
      <p className="mt-8 text-xs text-ink-faint">GSTIN {b.gstin}</p>
    </div>
  );
}
