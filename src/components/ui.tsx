import Link from 'next/link';
import type { ReactNode } from 'react';

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
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <Link key={t.href} href={t.href} className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${current === t.href ? 'border-leaf-600 text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-mist px-1.5 py-0.5 text-xs text-ink-soft">{t.count}</span>}
        </Link>
      ))}
    </div>
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

export const TonerStrip = ({ className = '' }: { className?: string }) => (
  <div className={`flex h-1 w-full ${className}`} aria-hidden>
    <span className="flex-1 bg-toner-c" /><span className="flex-1 bg-toner-m" /><span className="flex-1 bg-toner-y" /><span className="flex-1 bg-toner-k" /><span className="flex-1 bg-white" />
  </div>
);

export const Logo = ({ small = false }: { small?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <span className="inline-flex items-center gap-2"><img src="/brand/mark.png" alt="" className={small ? 'h-6 w-auto' : 'h-8 w-auto'} /><img src="/brand/wordmark.png" alt="Paconia" className={small ? 'h-4 w-auto' : 'h-5 w-auto'} /></span>
);
