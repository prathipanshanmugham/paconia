import Link from 'next/link';
import { notFound } from 'next/navigation';
import { POLICIES } from '@/lib/policies';
import { getBusiness } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export function generateMetadata({ params }: { params: { slug: string } }) { return { title: POLICIES[params.slug]?.title || 'Policy' }; }

export default async function Policy({ params }: { params: { slug: string } }) {
  const p = POLICIES[params.slug];
  if (!p) notFound();
  const b = await getBusiness();
  return (
    <div className="wrap max-w-3xl py-12">
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">{Object.entries(POLICIES).map(([k, v]) => <Link key={k} href={`/policies/${k}`} className={`chip ${k === params.slug ? 'chip-on' : ''}`}>{v.title}</Link>)}</nav>
      <h1 className="text-4xl font-bold">{p.title}</h1>
      <div className="mt-8 space-y-6">{p.body(b).map(([h, t]) => <section key={h}><h2 className="text-lg font-semibold">{h}</h2><p className="prose-p mt-1 text-ink-soft">{t}</p></section>)}</div>
    </div>
  );
}
