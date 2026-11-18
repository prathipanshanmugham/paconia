'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useRef, useState, type ReactNode } from 'react';

export type MenuItem = { href: string; label: string; hint?: string } | { divider: true } | { heading: string };

/** A dropdown navigation menu: opens on click, closes on Escape, outside click or navigation. */
type MenuProps = { label: string; items: MenuItem[]; active?: boolean; align?: 'left' | 'right'; button?: ReactNode };

export default function Menu(props: MenuProps) {
  const fallback = <span className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft">{props.button || props.label}</span>;
  return <Suspense fallback={fallback}><MenuInner {...props} /></Suspense>;
}

function MenuInner({ label, items, active, align = 'left', button }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => setOpen(false), [path]);
  const matches = (href: string) => {
    const [base, q] = href.split('?');
    if (!q) return path === base || (base !== '/desk' && path.startsWith(base + '/')) || (path === base && !search.get('tab'));
    return path === base && [...new URLSearchParams(q)].every(([k, v]) => search.get(k) === v);
  };
  const here = active ?? items.some((it) => 'href' in it && matches(it.href));
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${here || open ? 'bg-sky-50 text-sky-700' : 'text-ink-soft hover:bg-mist hover:text-ink'}`}>
        {button || label}
        <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path d="M5.5 8l4.5 4.5L14.5 8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div id={id} className={`absolute top-full z-50 mt-2 min-w-[240px] rounded-xl bg-white p-1.5 shadow-menu ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {items.map((it, i) =>
            'divider' in it ? <div key={i} className="my-1.5 border-t border-line" />
              : 'heading' in it ? <div key={i} className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-faint">{it.heading}</div>
                : <Link key={it.href} href={it.href} className={`block rounded-lg px-3 py-2 text-sm hover:bg-sky-50 ${path === it.href.split('?')[0] ? 'font-semibold text-sky-700' : 'text-ink'}`}>
                    {it.label}{it.hint && <span className="block text-xs font-normal text-ink-faint">{it.hint}</span>}
                  </Link>,
          )}
        </div>
      )}
    </div>
  );
}

/** Full-screen grouped menu for phones. */
export function MobileMenu({ groups, footer }: { groups: { label: string; items: { href: string; label: string }[] }[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  return (
    <>
      <button type="button" className="btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button>
      {open && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-white p-5" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mb-4 flex justify-end"><button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Close</button></div>
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="mb-1 text-xs font-semibold text-ink-faint">{g.label}</h2>
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {g.items.map((it) => <li key={it.href}><Link href={it.href} className={`block px-4 py-3 text-[15px] ${path === it.href.split('?')[0] ? 'font-semibold text-sky-700' : ''}`}>{it.label}</Link></li>)}
                </ul>
              </section>
            ))}
          </div>
          {footer && <div className="mt-6">{footer}</div>}
        </div>
      )}
    </>
  );
}
