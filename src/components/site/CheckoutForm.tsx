'use client';
import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import SubmitButton from '@/components/SubmitButton';
import { placeOrder } from '@/app/actions/shop';
import { STATES, computeTax, stateFromPin } from '@/lib/gst';
import type { Shipping } from '@/lib/settings';

type Item = { name: string; summary: string; qty: number; total: number; gstRate: number };
type Init = { name: string; phone: string; company: string; gstin: string; line1: string; line2: string; city: string; pincode: string; stateCode: string };
const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CheckoutForm({ items, shipping, pickupAddress, online, credit, initial }: { items: Item[]; shipping: Shipping; pickupAddress: string; online: boolean; credit: boolean; initial: Init }) {
  const [state, run] = useFormState(placeOrder, null);
  const [fulfilment, setFulfilment] = useState<'COURIER' | 'PICKUP'>('COURIER');
  const [pin, setPin] = useState(initial.pincode);
  const [stateCode, setStateCode] = useState(initial.stateCode || '33');
  const [pay, setPay] = useState<'ONLINE' | 'PICKUP' | 'CREDIT'>(online ? 'ONLINE' : credit ? 'CREDIT' : 'PICKUP');
  const sub = items.reduce((a, i) => a + i.total, 0);
  const shipCost = fulfilment === 'PICKUP' || sub >= shipping.freeAbove ? 0 : stateCode === '33' ? shipping.tamilNadu : shipping.otherStates;
  const tax = useMemo(() => computeTax(items.map((i) => ({ amount: i.total, gstRate: i.gstRate })), shipCost, 0, fulfilment === 'PICKUP' ? initial.stateCode || '33' : stateCode), [items, shipCost, stateCode, fulfilment, initial.stateCode]);
  const payOk = (p: string) => (p === 'ONLINE' ? online : p === 'PICKUP' ? fulfilment === 'PICKUP' : credit);
  const effectivePay = payOk(pay) ? pay : online ? 'ONLINE' : fulfilment === 'PICKUP' ? 'PICKUP' : credit ? 'CREDIT' : pay;

  return (
    <form action={run} className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="card-pad">
          <h2 className="text-lg">Your details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={initial.name} required className="input" autoComplete="name" /></div>
            <div><label className="label" htmlFor="phone">Mobile</label><input id="phone" name="phone" type="tel" defaultValue={initial.phone} required className="input" autoComplete="tel" /></div>
            <div><label className="label" htmlFor="company">Business name <span className="font-normal text-ink-faint">(optional)</span></label><input id="company" name="company" defaultValue={initial.company} className="input" autoComplete="organization" /></div>
            <div><label className="label" htmlFor="gstin">GSTIN <span className="font-normal text-ink-faint">(for a B2B invoice)</span></label><input id="gstin" name="gstin" defaultValue={initial.gstin} className="input uppercase" maxLength={15} placeholder="33ABCDE1234F1Z5" /></div>
          </div>
        </section>

        <section className="card-pad">
          <h2 className="text-lg">Delivery</h2>
          <input type="hidden" name="fulfilment" value={fulfilment} />
          <label className="mt-4 block text-sm"><span className="label">How do you want it?</span>
            <select className="input" value={fulfilment} onChange={(e) => setFulfilment(e.target.value as 'COURIER' | 'PICKUP')}>
              <option value="COURIER">Courier to my address ({shipping.tamilNadu ? `₹${shipping.tamilNadu} in Tamil Nadu, ₹${shipping.otherStates} elsewhere` : 'free'}; free above ₹{shipping.freeAbove.toLocaleString('en-IN')})</option>
              <option value="PICKUP">Pick up free from the studio</option>
            </select>
            {fulfilment === 'PICKUP' && <p className="hint">{pickupAddress}</p>}</label>
          {fulfilment === 'COURIER' && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><label className="label" htmlFor="line1">Address</label><input id="line1" name="line1" defaultValue={initial.line1} required className="input" autoComplete="address-line1" placeholder="Door no., street" /></div>
              <div className="sm:col-span-2"><input name="line2" defaultValue={initial.line2} className="input" autoComplete="address-line2" placeholder="Area, landmark (optional)" aria-label="Address line 2" /></div>
              <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={initial.city} required className="input" autoComplete="address-level2" /></div>
              <div><label className="label" htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" value={pin} required inputMode="numeric" maxLength={6} className="input" autoComplete="postal-code"
                onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setPin(v); if (v.length === 6) setStateCode(stateFromPin(v)); }} /></div>
              <div className="sm:col-span-2"><label className="label" htmlFor="stateCode">State</label>
                <select id="stateCode" name="stateCode" value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="input">{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
                <p className="hint">Sets GST: CGST + SGST within Tamil Nadu, IGST for other states.</p></div>
            </div>
          )}
        </section>

        <section className="card-pad">
          <h2 className="text-lg">Payment</h2>
          <input type="hidden" name="pay" value={effectivePay} />
          <label className="mt-4 block text-sm"><span className="label">How will you pay?</span>
            <select className="input" value={effectivePay} onChange={(e) => setPay(e.target.value as 'ONLINE' | 'PICKUP' | 'CREDIT')}>
              <option value="ONLINE" disabled={!payOk('ONLINE')}>Pay online now: UPI, cards, net banking{!online ? ' (not available yet)' : ''}</option>
              <option value="PICKUP" disabled={!payOk('PICKUP')}>Pay at pickup: cash or UPI{fulfilment !== 'PICKUP' ? ' (pickup orders only)' : ''}</option>
              <option value="CREDIT" disabled={!payOk('CREDIT')}>On account, by the invoice due date{!credit ? ' (approved businesses only)' : ''}</option>
            </select></label>
          {!online && <p className="hint mt-2">Online payment is being set up. Choose pickup, or contact us to pay by bank transfer.</p>}
          <label className="mt-4 block"><span className="label">Notes for this order <span className="font-normal text-ink-faint">(optional)</span></span><textarea name="notes" className="input min-h-[70px]" maxLength={800} placeholder="Deadline, delivery instructions…" /></label>
        </section>
      </div>

      <aside className="card-pad h-fit lg:sticky lg:top-24">
        <h2 className="text-lg">Order summary</h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {items.map((i, k) => <li key={k} className="flex justify-between gap-3 py-2"><span><b>{i.name}</b><br /><span className="text-xs text-ink-soft">{i.qty.toLocaleString('en-IN')} pcs</span></span><span className="num">{rs2(i.total)}</span></li>)}
        </ul>
        <div className="num mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{rs2(sub)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span>{shipCost ? rs2(shipCost) : 'Free'}</span></div>
          {tax.interstate ? <div className="flex justify-between text-ink-soft"><span>IGST</span><span>{rs2(tax.igst)}</span></div> : <>
            <div className="flex justify-between text-ink-soft"><span>CGST</span><span>{rs2(tax.cgst)}</span></div>
            <div className="flex justify-between text-ink-soft"><span>SGST</span><span>{rs2(tax.sgst)}</span></div></>}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-semibold"><span>Total</span><span>{rs2(tax.total)}</span></div>
        </div>
        {state?.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn-primary btn-lg mt-4 w-full" pendingText="Placing order…">{effectivePay === 'ONLINE' ? 'Place order & pay' : 'Place order'}</SubmitButton>
        <p className="mt-2 text-center text-xs text-ink-faint">We send a proof within one working day. Printing starts after you approve it.</p>
      </aside>
    </form>
  );
}
