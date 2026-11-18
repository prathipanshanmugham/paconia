import Link from 'next/link';
import { getSession, isStaff } from '@/lib/auth';
import { readCartToken } from '@/lib/cart';
import { db } from '@/lib/db';
import { FAMILIES } from '@/lib/catalog';
import { Logo } from '@/components/ui';
import Menu, { MobileMenu } from '@/components/Menu';

export default async function Header() {
  const s = await getSession();
  const token = readCartToken();
  const count = token ? await db.cartLine.count({ where: { cartToken: token } }) : 0;
  const products = [{ href: '/shop', label: 'All products', hint: '14 products, priced instantly' }, ...FAMILIES.map((f) => ({ href: `/shop/${f.slug}`, label: f.name }))];
  const account = s ? (isStaff(s.role) ? { href: '/desk', label: 'Desk' } : { href: '/account', label: 'My orders' }) : { href: '/signin', label: 'Sign in' };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="wrap flex items-center gap-3 py-2.5">
        <Link href="/" aria-label="Paconia home" className="mr-4 shrink-0"><Logo className="h-12 sm:h-14" /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          <Menu label="Products" items={products} />
          <Link href="/quote" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-mist hover:text-ink">Bulk quote</Link>
          <Link href="/track" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-mist hover:text-ink">Track order</Link>
          <Link href="/contact" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-mist hover:text-ink">Visit us</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href={account.href} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-mist hover:text-ink sm:inline-flex">{account.label}</Link>
          <Link href="/cart" className="btn-secondary btn-sm py-2" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
            Cart{count > 0 && <span className="num rounded-full bg-sky-600 px-1.5 text-xs text-white">{count}</span>}
          </Link>
          <div className="md:hidden"><MobileMenu groups={[{ label: 'Products', items: products }, { label: 'Paconia', items: [{ href: '/quote', label: 'Bulk quote' }, { href: '/track', label: 'Track an order' }, { href: '/contact', label: 'Visit or contact us' }, { href: '/artwork-guide', label: 'Artwork guide' }, account] }]} /></div>
        </div>
      </div>
    </header>
  );
}
