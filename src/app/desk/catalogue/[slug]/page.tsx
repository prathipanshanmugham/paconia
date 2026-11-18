import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { PageHead } from '@/components/ui';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { saveProduct } from '@/app/actions/desk-admin';
import { addProductPhotos, makeCoverPhoto, removeProductPhoto } from '@/app/actions/desk-photos';
import { fileUrl } from '@/lib/files';

export const metadata = { title: 'Product' };

export default async function ProductEdit({ params }: { params: { slug: string } }) {
  await requireStaff('catalogue');
  const p = await db.product.findUnique({ where: { slug: params.slug }, include: { photos: { where: { kind: 'PRODUCT' }, orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } } });
  if (!p) notFound();
  const codes = await db.material.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { code: 'asc' } });
  return (
    <>
      <PageHead back={{ href: '/desk/catalogue', label: 'Catalogue' }} title={p.name} sub={`${p.model === 'SHEET' ? 'Priced by SRA3 sheet' : p.model === 'POUCH' ? 'Priced per pouch blank' : 'Priced by laser time and sheet'} · /p/${p.slug}`} actions={<Link href={`/p/${p.slug}`} className="btn-secondary btn-sm" target="_blank">View on website</Link>} />
      <section className="card mb-6">
        <div className="panel-head"><h2>Photos</h2><span className="text-sm text-ink-soft">{p.photos.length} of 8</span></div>
        <div className="p-5">
          <p className="mb-4 max-w-[70ch] text-sm text-ink-soft">Real photos of this product. They show next to the live 3D preview on the website, and the first one is the picture on product cards. Without photos the website uses the 3D render.</p>
          {p.photos.length > 0 && (
            <ul className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {p.photos.map((f, i) => (
                <li key={f.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                  <div className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(f.id)} alt={f.name} className="h-full w-full object-cover" />
                    {i === 0 && <span className="badge absolute left-2 top-2 bg-white/95 text-ink">Cover</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                    {i > 0 ? <form action={makeCoverPhoto}><input type="hidden" name="id" value={f.id} /><button className="text-sky-700 hover:underline">Make cover</button></form> : <span className="text-ink-soft">On cards</span>}
                    <form action={removeProductPhoto}><input type="hidden" name="id" value={f.id} /><button className="text-rose-700 hover:underline">Remove</button></form>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {p.photos.length < 8 && (
            <ActionForm action={addProductPhotos} resetOnOk>
              <input type="hidden" name="productId" value={p.id} />
              <div className="flex flex-wrap items-center gap-3">
                <input type="file" name="photos" multiple accept="image/jpeg,image/png,image/webp" className="input max-w-sm py-2 text-sm" aria-label="Product photos" />
                <SubmitButton className="btn-secondary">Upload photos</SubmitButton>
                <span className="hint">JPG, PNG or WebP, up to 8 MB each. Square photos look best.</span>
              </div>
            </ActionForm>
          )}
        </div>
      </section>
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
