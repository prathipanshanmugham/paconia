import Link from 'next/link';
import type { ReactNode } from 'react';
import TabSelect from './TabSelect';

export type Tone = 'good' | 'warn' | 'bad' | 'info' | 'muted';
export const Badge = ({ tone = 'muted', children }: { tone?: Tone; children: ReactNode }) => <span className={`badge tone-${tone}`}>{children}</span>;

export function PageHead({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">← {back.label}</Link>}
        <h1 className="text-2xl font-bold sm:text-[1.75rem]">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, href }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; href?: string }) {
  const ring = tone === 'bad' ? 'border-rose-200' : tone === 'warn' ? 'border-amber-200' : 'border-line';
  const body = (
    <div className={`card h-full p-4 ${ring} ${href ? 'transition hover:shadow-lift' : ''}`}>
      <div className="text-xs font-medium text-ink-soft">{label}</div>
      <div className={`num mt-1 font-display text-2xl font-bold ${tone === 'bad' ? 'text-rose-700' : tone === 'warn' ? 'text-amber-800' : ''}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export const Empty = ({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) => (
  <div className="px-6 py-12 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink-faint">○</div>
    <p className="font-medium">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{children}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Field = ({ label, name, hint, children, className = '' }: { label: string; name?: string; hint?: ReactNode; children: ReactNode; className?: string }) => (
  <div className={className}>
    <label className="label" htmlFor={name}>{label}</label>
    {children}
    {hint && <p className="hint">{hint}</p>}
  </div>
);

export function Tabs({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <>
      <div className="mb-5 sm:hidden"><TabSelect items={items} current={current} /></div>
      <div className="mb-5 hidden gap-1 overflow-x-auto border-b border-line sm:flex" role="tablist">
        {items.map((t) => (
          <Link key={t.href} href={t.href} role="tab" aria-selected={current === t.href} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${current === t.href ? 'border-sky-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            {t.label}{t.count !== undefined && <span className="num ml-1.5 rounded-full bg-mist px-1.5 py-0.5 text-xs text-ink-soft">{t.count}</span>}
          </Link>
        ))}
      </div>
    </>
  );
}

export const Notice = ({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) => (
  <div className={`rounded-xl px-4 py-3 text-sm tone-${tone}`}>{children}</div>
);

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,40%)_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents"><dt className="text-ink-soft">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>
      ))}
    </dl>
  );
}

/** The exact Paconia logo, cut from the original artwork. `lockup` = P mark above the wordmark; `mark` = P only. */
export const Logo = ({ variant = 'lockup', className = '' }: { variant?: 'lockup' | 'mark'; className?: string; small?: boolean }) =>
  variant === 'mark'
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src="/brand/mark.png" srcSet="/brand/mark.png 1x, /brand/mark@2x.png 2x" alt="Paconia" width={252} height={201} className={`h-8 w-auto ${className}`} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src="/brand/logo.png" srcSet="/brand/logo.png 1x, /brand/logo@2x.png 2x" alt="Paconia" width={256} height={180} className={`h-12 w-auto ${className}`} />;
