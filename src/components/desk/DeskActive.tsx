'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export default function DeskActive({ href, exact, className = '', children }: { href: string; exact?: boolean; className?: string; children: ReactNode }) {
  const path = usePathname();
  const on = exact ? path === href : path.startsWith(href);
  return <Link href={href} aria-current={on ? 'page' : undefined} className={`${className} ${on ? 'bg-sky-50 text-sky-700' : 'text-ink-soft hover:bg-mist hover:text-ink'}`}>{children}</Link>;
}
