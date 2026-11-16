import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { saveCustomer } from '@/app/actions/desk-admin';
import { STATES } from '@/lib/gst';

type C = { id?: string; name?: string; phone?: string; company?: string | null; email?: string | null; gstin?: string | null; line1?: string | null; line2?: string | null; city?: string | null; pincode?: string | null; stateCode?: string | null; notes?: string | null; creditDays?: number; creditLimit?: unknown };

export default function CustomerForm({ c = {}, money }: { c?: C; money: boolean }) {
  return (
    <ActionForm action={saveCustomer} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={c.id || ''} />
      <div><label className="label" htmlFor="name">Contact name</label><input id="name" name="name" defaultValue={c.name} required className="input" /></div>
      <div><label className="label" htmlFor="phone">Mobile</label><input id="phone" name="phone" defaultValue={c.phone} required className="input" /></div>
      <div><label className="label" htmlFor="company">Business name</label><input id="company" name="company" defaultValue={c.company || ''} className="input" /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={c.email || ''} className="input" /></div>
      <div><label className="label" htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" defaultValue={c.gstin || ''} maxLength={15} className="input uppercase" /></div>
      <div><label className="label" htmlFor="stateCode">State</label><select id="stateCode" name="stateCode" defaultValue={c.stateCode || '33'} className="input">{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select><p className="hint">Taken from the GSTIN when there is one.</p></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="line1">Address</label><input id="line1" name="line1" defaultValue={c.line1 || ''} className="input" /></div>
      <div className="sm:col-span-2"><input name="line2" defaultValue={c.line2 || ''} className="input" aria-label="Address line 2" placeholder="Area, landmark" /></div>
      <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={c.city || ''} className="input" /></div>
      <div><label className="label" htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" defaultValue={c.pincode || ''} maxLength={6} inputMode="numeric" className="input" /></div>
      {money && <>
        <div><label className="label" htmlFor="creditDays">Credit days</label><input id="creditDays" name="creditDays" type="number" min={0} max={120} defaultValue={c.creditDays ?? 0} className="input" /><p className="hint">0 = no credit. Above 0 lets them order on account.</p></div>
        <div><label className="label" htmlFor="creditLimit">Credit limit ₹</label><input id="creditLimit" name="creditLimit" type="number" min={0} defaultValue={String(c.creditLimit ?? 0)} className="input" /><p className="hint">0 = no limit.</p></div>
      </>}
      <div className="sm:col-span-2"><label className="label" htmlFor="notes">Notes</label><textarea id="notes" name="notes" defaultValue={c.notes || ''} className="input min-h-[70px]" placeholder="Brand colours, preferred stock, who approves proofs…" /></div>
      <div className="sm:col-span-2"><SubmitButton>{c.id ? 'Save customer' : 'Add customer'}</SubmitButton></div>
    </ActionForm>
  );
}
