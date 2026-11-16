'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';

export type NavItem = { href: string; label: string; icon: string; badge?: number };

export function DeskSidebar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Desk">
      {items.map((it) => {
        const on = it.href === '/desk' ? path === '/desk' : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={on ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${on ? 'bg-ink text-white' : 'text-ink-soft hover:bg-mist hover:text-ink'}`}>
            <Icon name={it.icon} />
            <span className="flex-1">{it.label}</span>
            {!!it.badge && <span className={`num rounded-full px-1.5 text-xs ${on ? 'bg-white/20' : 'bg-leaf-100 text-leaf-800'}`}>{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function DeskTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Desk">
      {items.map((it) => {
        const on = it.href === '/desk' ? path === '/desk' : path.startsWith(it.href);
        return <Link key={it.href} href={it.href} className={`chip shrink-0 py-1 ${on ? 'chip-on' : ''}`}>{it.label}{!!it.badge && <span className="num ml-1 opacity-70">{it.badge}</span>}</Link>;
      })}
    </nav>
  );
}
