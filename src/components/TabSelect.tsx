'use client';
import { useRouter } from 'next/navigation';

/** Tabs shown as one dropdown on phones. */
export default function TabSelect({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  const router = useRouter();
  return (
    <select className="input font-semibold" value={current} onChange={(e) => router.push(e.target.value)} aria-label="Section">
      {items.map((t) => <option key={t.href} value={t.href}>{t.label}{t.count !== undefined ? ` (${t.count})` : ''}</option>)}
    </select>
  );
}
