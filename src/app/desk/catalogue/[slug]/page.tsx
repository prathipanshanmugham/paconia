import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { saveProduct } from '@/app/actions/desk-admin';

export const metadata = { title: 'Product' };

export default async function ProductEdit({ params }: { params: { slug: string } }) {
  await requireStaff('catalogue');
  const p = await db.product.findUnique({ where: { slug: params.slug } });
  if (!p) notFound();
  const codes = await db.material.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { code: 'asc' } });
  return (
    <>
      <PageHead back={{ href: '/desk/catalogue', label: 'Catalogue' }} title={p.name} sub={`${p.model === 'SHEET' ? 'Priced by SRA3 sheet' : p.model === 'POUCH' ? 'Priced per pouch blank' : 'Priced by laser time and sheet'} · /p/${p.slug}`} actions={<Link href={`/p/${p.slug}`} className="btn-secondary btn-sm" target="_blank">View on website</Link>} />
      <ActionForm action={saveProduct} className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <input type="hidden" name="id" value={p.id} />
        <section className="card-pad space-y-4">
          <label className="block text-sm"><span className="label">Name</span><input name="name" defaultValue={p.name} className="input" /></label>
          <label className="block text-sm"><span className="label">Tagline</span><input name="tagline" defaultValue={p.tagline} className="input" /></label>
          <label className="block text-sm"><span className="label">Description</span><textarea name="description" defaultValue={p.description} className="input min-h-[90px]" /></label>
          <label className="block text-sm"><span className="label">Options (sizes, materials, finishes, quantity tiers, add-ons)</span>
            <textarea name="config" defaultValue={JSON.stringify(p.config, null, 2)} className="input mono min-h-[420px] text-xs" spellCheck={false} /></label>
          <p className="hint">Saved only if a test price works. Sizes are in mm. Materials use the codes on the right.</p>
        </section>
        <aside className="space-y-4">
          <section className="card-pad grid grid-cols-2 gap-3">
            <label className="text-sm"><span className="label">HSN</span><input name="hsn" defaultValue={p.hsn} className="input mono" /></label>
            <label className="text-sm"><span className="label">GST %</span><select name="gstRate" defaultValue={p.gstRate} className="input">{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</select></label>
            <label className="text-sm"><span className="label">Lead days</span><input name="leadDays" type="number" min={1} max={30} defaultValue={p.leadDays} className="input" /></label>
            <label className="text-sm"><span className="label">Sort order</span><input name="sort" type="number" defaultValue={p.sort} className="input" /></label>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-leaf-600" />Show on website</label>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={p.featured} className="h-4 w-4 accent-leaf-600" />Feature on home page</label>
            <div className="col-span-2"><SubmitButton className="btn-primary w-full">Save product</SubmitButton></div>
          </section>
          <section className="card-pad text-xs"><h2 className="mb-2 text-sm font-semibold">Material codes</h2><ul className="max-h-[360px] space-y-0.5 overflow-y-auto">{codes.map((c) => <li key={c.code}><span className="mono">{c.code}</span> <span className="text-ink-soft">{c.name}</span></li>)}</ul></section>
        </aside>
      </ActionForm>
    </>
  );
}
