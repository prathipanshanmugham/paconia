import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { adjustStock, saveMaterial, saveVendor } from '@/app/actions/desk-admin';

type M = { id?: string; code?: string; name?: string; category?: string; uom?: string; cost?: unknown; price?: unknown; reorderLevel?: unknown; reorderQty?: unknown; sheetW?: number | null; sheetH?: number | null; colour?: string | null; vendorId?: string | null; needsWhite?: boolean; active?: boolean; notes?: string | null };
const CATS = [['MEDIA', 'Print media (SRA3)'], ['BLANK', 'Pouch blanks'], ['LASER', 'Laser sheets'], ['TONER', 'Toner'], ['FILM', 'Lamination film'], ['CONSUMABLE', 'Consumables'], ['PACKING', 'Packing']];

export function MaterialForm({ m = {}, vendors }: { m?: M; vendors: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveMaterial} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={m.id || ''} />
      <label className="text-sm sm:col-span-2"><span className="label">Name</span><input name="name" defaultValue={m.name} required className="input" /></label>
      <label className="text-sm"><span className="label">Code</span><input name="code" defaultValue={m.code} required readOnly={!!m.id} className="input mono uppercase" /></label>
      <label className="text-sm"><span className="label">Type</span><select name="category" defaultValue={m.category || 'MEDIA'} className="input">{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="text-sm"><span className="label">Unit</span><input name="uom" defaultValue={m.uom || 'sheet'} required className="input" placeholder="sheet, pc, ml, m" /></label>
      <label className="text-sm"><span className="label">Vendor</span><select name="vendorId" defaultValue={m.vendorId || ''} className="input"><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label className="text-sm"><span className="label">Cost ₹ / unit</span><input name="cost" type="number" step="0.01" min="0" defaultValue={String(m.cost ?? 0)} className="input" /></label>
      <label className="text-sm"><span className="label">Price used in quotes ₹ / unit</span><input name="price" type="number" step="0.01" min="0" defaultValue={String(m.price ?? 0)} className="input" /></label>
      <label className="text-sm"><span className="label">Reorder when below</span><input name="reorderLevel" type="number" step="0.01" min="0" defaultValue={String(m.reorderLevel ?? 0)} className="input" /></label>
      <label className="text-sm"><span className="label">Reorder quantity</span><input name="reorderQty" type="number" step="0.01" min="0" defaultValue={String(m.reorderQty ?? 0)} className="input" /></label>
      <label className="text-sm"><span className="label">Sheet width mm</span><input name="sheetW" type="number" min="0" defaultValue={m.sheetW ?? ''} className="input" /></label>
      <label className="text-sm"><span className="label">Sheet height mm</span><input name="sheetH" type="number" min="0" defaultValue={m.sheetH ?? ''} className="input" /></label>
      <label className="text-sm"><span className="label">Swatch colour</span><input name="colour" defaultValue={m.colour || ''} className="input mono" placeholder="#FFFFFF" /></label>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="needsWhite" defaultChecked={m.needsWhite} className="h-4 w-4 accent-leaf-600" />Needs white ink underbase</label>
        {m.id && <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={m.active !== false} className="h-4 w-4 accent-leaf-600" />In use</label>}
      </div>
      <label className="text-sm sm:col-span-2"><span className="label">Notes</span><input name="notes" defaultValue={m.notes || ''} className="input" /></label>
      <div className="sm:col-span-2"><SubmitButton>{m.id ? 'Save material' : 'Add material'}</SubmitButton></div>
    </ActionForm>
  );
}

export function AdjustForm({ id, uom }: { id: string; uom: string }) {
  return (
    <ActionForm action={adjustStock} className="space-y-3" resetOnOk>
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm"><span className="label">What happened</span><select name="mode" className="input"><option value="in">Received stock (+)</option><option value="out">Used / damaged (−)</option><option value="return">Returned from a job (+)</option><option value="count">Physical count (set to)</option></select></label>
      <label className="block text-sm"><span className="label">Quantity ({uom})</span><input name="qty" type="number" step="0.01" min="0" required className="input" /></label>
      <label className="block text-sm"><span className="label">Reference</span><input name="ref" className="input" placeholder="Bill no., job no." /></label>
      <label className="block text-sm"><span className="label">Note</span><input name="note" className="input" /></label>
      <SubmitButton className="btn-secondary w-full">Record</SubmitButton>
    </ActionForm>
  );
}

type V = { id?: string; name?: string; contact?: string | null; phone?: string | null; email?: string | null; gstin?: string | null; city?: string | null; address?: string | null; notes?: string | null };
export function VendorForm({ v = {} }: { v?: V }) {
  return (
    <ActionForm action={saveVendor} className="grid gap-3 sm:grid-cols-2" resetOnOk={!v.id}>
      <input type="hidden" name="id" value={v.id || ''} />
      <label className="text-sm sm:col-span-2"><span className="label">Vendor name</span><input name="name" defaultValue={v.name} required className="input" /></label>
      <label className="text-sm"><span className="label">Contact person</span><input name="contact" defaultValue={v.contact || ''} className="input" /></label>
      <label className="text-sm"><span className="label">Phone</span><input name="phone" defaultValue={v.phone || ''} className="input" /></label>
      <label className="text-sm"><span className="label">Email</span><input name="email" defaultValue={v.email || ''} className="input" /></label>
      <label className="text-sm"><span className="label">GSTIN</span><input name="gstin" defaultValue={v.gstin || ''} className="input uppercase" maxLength={15} /></label>
      <label className="text-sm"><span className="label">City</span><input name="city" defaultValue={v.city || ''} className="input" /></label>
      <label className="text-sm"><span className="label">Address</span><input name="address" defaultValue={v.address || ''} className="input" /></label>
      <label className="text-sm sm:col-span-2"><span className="label">Supplies / notes</span><input name="notes" defaultValue={v.notes || ''} className="input" /></label>
      <div className="sm:col-span-2"><SubmitButton className="btn-secondary">{v.id ? 'Save vendor' : 'Add vendor'}</SubmitButton></div>
    </ActionForm>
  );
}
