import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, PageHead } from '@/components/ui';
import { FAMILIES, materialsFor } from '@/lib/catalog';
import { getPricing } from '@/lib/settings';
import { price, type ProductConfig } from '@/lib/pricing';
import { unitPrice } from '@/components/site/money';

export const metadata = { title: 'Catalogue' };

export default async function Catalogue() {
  await requireStaff('catalogue');
  const [products, ps] = await Promise.all([db.product.findMany({ orderBy: [{ family: 'asc' }, { sort: 'asc' }], include: { _count: { select: { orderItems: true } } } }), getPricing()]);
  const rows = await Promise.all(products.map(async (p) => {
    const cfg = p.config as unknown as ProductConfig;
    const mats = await materialsFor(cfg);
    const q = cfg.qtyTiers[cfg.qtyTiers.length - 1];
    const r = price(p.model, cfg, { size: 0, material: cfg.materials[0], finish: cfg.finishes[0], qty: q, sides: 1, extras: [] }, mats, ps);
    return { p, cfg, from: r.ok ? r.unit : null, q };
  }));
  return (
    <>
      <PageHead title="Catalogue" sub="Products on the website and in the Desk. Prices come from the rates and material costs." actions={<Link href="/desk/catalogue/rates" className="btn-secondary">Pricing rates</Link>} />
      {FAMILIES.map((f) => (
        <section key={f.key} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-faint">{f.name}</h2>
          <div className="card overflow-x-auto"><table className="tbl min-w-[720px]"><tbody>{rows.filter((r) => r.p.family === f.key).map(({ p, cfg, from, q }) => (
            <tr key={p.id} className={`rowlink ${p.active ? '' : 'opacity-50'}`}>
              <td><Link href={`/desk/catalogue/${p.slug}`} className="font-semibold hover:underline">{p.name}</Link><div className="text-xs text-ink-soft">{p.tagline}</div></td>
              <td className="text-sm">{cfg.sizes.length} sizes · {cfg.materials.length} materials</td>
              <td className="text-sm">HSN {p.hsn} · {p.gstRate}%</td>
              <td className="text-sm">{p.leadDays} days</td>
              <td className="num text-right text-sm">{from !== null ? <>{unitPrice(from)}<div className="text-xs text-ink-faint">at {q.toLocaleString('en-IN')}</div></> : '—'}</td>
              <td className="text-right">{!p.active && <Badge tone="muted">Hidden</Badge>}{p.featured && <Badge tone="good">Featured</Badge>}<div className="text-xs text-ink-faint">{p._count.orderItems} sold</div></td>
            </tr>))}</tbody></table></div>
        </section>
      ))}
    </>
  );
}
