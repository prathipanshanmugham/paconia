import Link from 'next/link';
import type { ReactNode } from 'react';
import { can, requireStaff, ROLE_LABEL, type Area } from '@/lib/auth';
import { db } from '@/lib/db';
import { signOut } from '@/app/actions/auth';
import { DeskSidebar, DeskTabs, type NavItem } from '@/components/desk/DeskNav';
import { Logo, TonerStrip } from '@/components/ui';
import Icon from '@/components/desk/Icon';

export const dynamic = 'force-dynamic';
export const metadata = { title: { default: 'Desk', template: '%s · Paconia Desk' }, robots: { index: false } };

const NAV: (NavItem & { area: Area })[] = [
  { href: '/desk', label: 'Today', icon: 'today', area: 'today' },
  { href: '/desk/orders', label: 'Orders', icon: 'orders', area: 'orders' },
  { href: '/desk/production', label: 'Production', icon: 'production', area: 'production' },
  { href: '/desk/quotes', label: 'Quotes', icon: 'quotes', area: 'quotes' },
  { href: '/desk/customers', label: 'Customers', icon: 'customers', area: 'customers' },
  { href: '/desk/accounts', label: 'Accounts', icon: 'accounts', area: 'accounts' },
  { href: '/desk/stock', label: 'Stock', icon: 'stock', area: 'stock' },
  { href: '/desk/catalogue', label: 'Catalogue', icon: 'catalogue', area: 'catalogue' },
  { href: '/desk/tools', label: 'Tools', icon: 'tools', area: 'tools' },
  { href: '/desk/settings', label: 'Settings', icon: 'settings', area: 'settings' },
];

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const s = await requireStaff('today');
  const [proofs, enquiries] = await Promise.all([
    db.order.count({ where: { status: { in: ['PLACED', 'CHANGES_REQUESTED'] } } }),
    db.enquiry.count({ where: { status: 'NEW' } }),
  ]);
  const items = NAV.filter((n) => can(s.role, n.area)).map((n) => ({ ...n, badge: n.area === 'orders' ? proofs : n.area === 'quotes' ? enquiries : undefined }));
  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[232px_1fr]">
      <div className="no-print hidden border-r border-line bg-white lg:block">
      <aside className="sticky top-0 flex h-screen flex-col">
        <TonerStrip />
        <div className="px-5 pb-4 pt-5"><Link href="/desk"><Logo small /></Link><p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Desk</p></div>
        <div className="flex-1 overflow-y-auto px-3"><DeskSidebar items={items} /></div>
        <div className="border-t border-line p-4 text-sm">
          <p className="font-semibold">{s.name}</p><p className="text-xs text-ink-soft">{ROLE_LABEL[s.role]}</p>
          <div className="mt-3 flex gap-2"><Link href="/" className="btn-ghost btn-sm px-2" title="Open the shop"><Icon name="shop" /> Shop</Link><form action={signOut}><button className="btn-ghost btn-sm">Sign out</button></form></div>
        </div>
      </aside>
      </div>
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur lg:hidden">
          <TonerStrip />
          <div className="flex items-center justify-between px-4 py-3"><Link href="/desk"><Logo small /></Link><form action={signOut}><button className="btn-ghost btn-sm">Sign out</button></form></div>
          <DeskTabs items={items} />
        </header>
        <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
