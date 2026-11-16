'use client';
import { useFormState } from 'react-dom';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { sendEnquiry, trackOrder } from '@/app/actions/public';

export function EnquiryForm({ products, initial }: { products: string[]; initial: { name: string; phone: string; email: string; company: string } }) {
  return (
    <ActionForm action={sendEnquiry} className="grid gap-4 sm:grid-cols-2" resetOnOk>
      <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={initial.name} required className="input" autoComplete="name" /></div>
      <div><label className="label" htmlFor="company">Business</label><input id="company" name="company" defaultValue={initial.company} className="input" autoComplete="organization" /></div>
      <div><label className="label" htmlFor="phone">Mobile / WhatsApp</label><input id="phone" name="phone" type="tel" defaultValue={initial.phone} required className="input" autoComplete="tel" /></div>
      <div><label className="label" htmlFor="email">Email <span className="font-normal text-ink-faint">(optional)</span></label><input id="email" name="email" type="email" defaultValue={initial.email} className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="product">What do you need?</label>
        <select id="product" name="product" required className="input" defaultValue=""><option value="" disabled>Choose…</option>{products.map((p) => <option key={p}>{p}</option>)}<option>Something else</option></select></div>
      <div><label className="label" htmlFor="qty">Quantity</label><input id="qty" name="qty" required className="input" placeholder="e.g. 5,000 or 2,000 per month" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="details">Details</label><textarea id="details" name="details" required className="input min-h-[120px]" placeholder="Size, material, finish, number of designs, deadline. Mention if it is a repeat order." /></div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="sm:col-span-2"><SubmitButton className="btn-primary" pendingText="Sending…">Send enquiry</SubmitButton></div>
    </ActionForm>
  );
}

export function TrackForm() {
  const [state, run] = useFormState(trackOrder, null);
  return (
    <div>
      <form action={run} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><label className="label" htmlFor="number">Order number</label><input id="number" name="number" required className="input uppercase" placeholder="PAC-1001" /></div>
        <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" name="phone" type="tel" required className="input" /></div>
        <SubmitButton className="btn-primary" pendingText="Checking…">Track</SubmitButton>
      </form>
      {state?.error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.order && (
        <div className="mt-6 rounded-xl border border-line bg-white p-5" role="status">
          <p className="mono text-sm text-ink-soft">{state.order.number} · placed {state.order.placed}</p>
          <p className="mt-1 font-display text-2xl font-bold">{state.order.status}</p>
          {state.order.ready && <p className="text-sm text-ink-soft">Expected ready by {state.order.ready}</p>}
          {state.order.stages.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{state.order.stages.map((s) => <li key={s}>{s}</li>)}</ul>}
          {state.order.awb && <p className="mt-3 text-sm">Courier: <b>{state.order.courier}</b> · tracking <b className="mono">{state.order.awb}</b></p>}
        </div>
      )}
    </div>
  );
}
