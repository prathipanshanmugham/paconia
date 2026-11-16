import Link from 'next/link';
import { getSession, isStaff } from '@/lib/auth';
import { readCartToken } from '@/lib/cart';
import { db } from '@/lib/db';
import { Logo, TonerStrip } from '@/components/ui';
import { FAMILIES } from '@/lib/catalog';

export default async function Header() {
  const s = await getSession();
  const token = readCartToken();
  const count = token ? await db.cartLine.count({ where: { cartToken: token } }) : 0;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur no-print">
      <TonerStrip />
      <div className="wrap flex h-16 items-center gap-6">
        <Link href="/" aria-label="Paconia home" className="shrink-0"><Logo /></Link>
        <nav className="hidden flex-1 items-center gap-1 text-sm font-medium lg:flex" aria-label="Main">
          {FAMILIES.map((f) => <Link key={f.key} href={`/shop/${f.slug}`} className="whitespace-nowrap rounded-md px-2.5 py-2 text-ink-soft hover:bg-mist hover:text-ink">{f.name.replace(/ &.*$/, "").replace("Printed pouches", "Pouches")}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link href="/quote" className="btn-ghost hidden sm:inline-flex">Bulk quote</Link>
          {s ? (
            <Link href={isStaff(s.role) ? '/desk' : '/account'} className="btn-ghost">{isStaff(s.role) ? 'Desk' : 'My orders'}</Link>
          ) : (
            <Link href="/signin" className="btn-ghost">Sign in</Link>
          )}
          <Link href="/cart" className="btn-secondary" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20.5 8H6.2" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></svg>
            Cart{count > 0 && <span className="num rounded-full bg-leaf-600 px-1.5 text-[11px] leading-5 text-white">{count}</span>}
          </Link>
        </div>
      </div>
      <nav className="wrap flex gap-1 overflow-x-auto pb-2 text-sm lg:hidden" aria-label="Products">
        {FAMILIES.map((f) => <Link key={f.key} href={`/shop/${f.slug}`} className="chip shrink-0 py-1">{f.name}</Link>)}
      </nav>
    </header>
  );
}
