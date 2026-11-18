import Link from 'next/link';
import type { ReactNode } from 'react';
import { can, requireStaff, ROLE_LABEL, type Area, type Role } from '@/lib/auth';
import { db } from '@/lib/db';
import { expireQuotes } from '@/lib/quotes';
import { signOut } from '@/app/actions/auth';
import { Logo } from '@/components/ui';
import Menu, { MobileMenu, type MenuItem } from '@/components/Menu';
import DeskActive from '@/components/desk/DeskActive';

export const dynamic = 'force-dynamic';
export const metadata = { title: { default: 'Desk', template: '%s · Paconia Desk' }, robots: { index: false } };

type Item = { href: string; label: string; hint?: string; area: Area };
type Group = { key: string; label: string; items: Item[] };

const GROUPS = (badges: { proofs: number; enquiries: number; expiring: number }): Group[] => [
  { key: 'sales', label: 'Sales', items: [
    { href: '/desk/orders', label: 'Orders', hint: badges.proofs ? `${badges.proofs} need a proof` : 'Website, walk-in and B2B', area: 'orders' },
    { href: '/desk/orders/new', label: 'New order', area: 'orders' },
    { href: '/desk/quotes', label: 'Quotes', hint: badges.expiring ? `${badges.expiring} expire within 3 days` : 'With margins and expiry', area: 'quotes' },
    { href: '/desk/quotes/new', label: 'New quote', area: 'quotes' },
    { href: '/desk/quotes?tab=enquiries', label: 'Website enquiries', hint: badges.enquiries ? `${badges.enquiries} new` : undefined, area: 'quotes' },
    { href: '/desk/customers', label: 'Customers', area: 'customers' },
  ] },
  { key: 'production', label: 'Production', items: [
    { href: '/desk/production', label: 'Production board', hint: 'Jobs by stage and machine', area: 'production' },
    { href: '/desk/settings?tab=machines', label: 'Machines', hint: 'Status and service dates', area: 'settings' },
  ] },
  { key: 'stock', label: 'Stock', items: [
    { href: '/desk/stock', label: 'Materials', area: 'stock' },
    { href: '/desk/stock?filter=low', label: 'Below reorder level', area: 'stock' },
    { href: '/desk/stock?tab=moves', label: 'Stock movements', area: 'stock' },
    { href: '/desk/stock?tab=purchases', label: 'Purchase orders', area: 'stock' },
    { href: '/desk/stock/po/new', label: 'New purchase order', area: 'stock' },
    { href: '/desk/stock?tab=vendors', label: 'Vendors', area: 'stock' },
  ] },
  { key: 'accounts', label: 'Accounts', items: [
    { href: '/desk/accounts', label: 'Overview', area: 'accounts' },
    { href: '/desk/accounts?tab=margins', label: 'Margins', hint: 'Profit by order and product', area: 'accounts' },
    { href: '/desk/accounts?tab=invoices', label: 'Invoices', area: 'accounts' },
    { href: '/desk/accounts?tab=payments', label: 'Payments', area: 'accounts' },
    { href: '/desk/accounts?tab=receivables', label: 'Money to collect', area: 'accounts' },
    { href: '/desk/accounts?tab=expenses', label: 'Expenses', area: 'accounts' },
    { href: '/desk/accounts?tab=gst', label: 'GST summary', area: 'accounts' },
  ] },
  { key: 'setup', label: 'Setup', items: [
    { href: '/desk/catalogue', label: 'Products', area: 'catalogue' },
    { href: '/desk/catalogue/rates', label: 'Prices, costs & margins', area: 'catalogue' },
    { href: '/desk/tools', label: 'Calculators', area: 'tools' },
    { href: '/desk/settings', label: 'Business details', area: 'settings' },
    { href: '/desk/settings?tab=team', label: 'Team & logins', area: 'users' },
    { href: '/desk/settings?tab=ai', label: 'AI & API access', hint: 'Connect Claude to Paconia', area: 'users' },
  ] },
];

const NEW: { href: string; label: string; area: Area }[] = [
  { href: '/desk/orders/new', label: 'Order', area: 'orders' },
  { href: '/desk/quotes/new', label: 'Quote', area: 'quotes' },
  { href: '/desk/customers/new', label: 'Customer', area: 'customers' },
  { href: '/desk/stock/po/new', label: 'Purchase order', area: 'stock' },
  { href: '/desk/accounts?tab=expenses', label: 'Expense', area: 'accounts' },
];

export default async function DeskLayout({ children }: { children: ReactNode }) {
  const s = await requireStaff('today');
  await expireQuotes();
  const [proofs, enquiries, expiring] = await Promise.all([
    db.order.count({ where: { status: { in: ['PLACED', 'CHANGES_REQUESTED'] } } }),
    db.enquiry.count({ where: { status: 'NEW' } }),
    db.quote.count({ where: { status: { in: ['DRAFT', 'SENT'] }, validUntil: { lt: new Date(Date.now() + 3 * 86400000) } } }),
  ]);
  const role = s.role as Role;
  const groups = GROUPS({ proofs, enquiries, expiring })
    .map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.area)) }))
    .filter((g) => g.items.length);
  const newItems = NEW.filter((n) => can(role, n.area));
  const signout = <form action={signOut}><button className="btn-ghost btn-sm">Sign out</button></form>;

  return (
    <div className="min-h-screen bg-paper">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link href="/desk" className="mr-3 flex shrink-0 items-center gap-2" aria-label="Desk home"><Logo variant="mark" className="h-8" /><span className="hidden text-sm font-bold text-ink sm:inline">Desk</span></Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Desk">
            <DeskActive href="/desk" exact className="rounded-lg px-3 py-2 text-sm font-semibold">Today</DeskActive>
            {groups.map((g) => <Menu key={g.key} label={g.label} items={g.items.map(({ href, label, hint }) => ({ href, label, hint })) as MenuItem[]} />)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {newItems.length > 0 && <div className="hidden sm:block"><Menu label="New" align="right" items={newItems.map((n) => ({ href: n.href, label: n.label }))} button={<span className="text-sky-700">+ New</span>} /></div>}
            <div className="hidden text-right leading-tight lg:block"><p className="text-sm font-semibold">{s.name}</p><p className="text-xs text-ink-faint">{ROLE_LABEL[role]}</p></div>
            <div className="hidden lg:block">{signout}</div>
            <div className="lg:hidden"><MobileMenu groups={[{ label: 'Desk', items: [{ href: '/desk', label: 'Today' }] }, ...groups.map((g) => ({ label: g.label, items: g.items }))]}
              footer={<div className="flex items-center justify-between rounded-xl bg-paper p-4"><div><p className="font-semibold">{s.name}</p><p className="text-sm text-ink-soft">{ROLE_LABEL[role]}</p></div>{signout}</div>} /></div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
