import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth';
import { signOut } from '@/app/actions/auth';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const s = await requireUser('/account');
  return (
    <div className="wrap py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div><p className="kicker">My account</p><p className="font-display text-xl font-bold">{s.name}</p></div>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/account" className="btn-ghost btn-sm">Orders</Link>
          <Link href="/account/profile" className="btn-ghost btn-sm">Details</Link>
          <form action={signOut}><button className="btn-ghost btn-sm">Sign out</button></form>
        </nav>
      </div>
      {children}
    </div>
  );
}
