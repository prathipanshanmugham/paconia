'use client';
import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import SubmitButton from '@/components/SubmitButton';
import type { FormResult } from '@/components/FormMessage';
import { FINISH_LABEL, price, type MaterialInfo, type PricingSettings, type ProductConfig, type Spec } from '@/lib/pricing';
import { STATES, checkGstin, computeTax, stateFromPin } from '@/lib/gst';

export type ProductLite = { id: string; name: string; family: string; model: 'SHEET' | 'POUCH' | 'LASER'; hsn: string; gstRate: number; leadDays: number; config: ProductConfig };
export type CustomerLite = { id: string; code: string; name: string; company: string | null; phone: string; gstin: string | null; stateCode: string | null; creditDays: number; line1: string | null; city: string | null; pincode: string | null };
type ShippingRates = { tamilNadu: number; otherStates: number; freeAbove: number };

type PLine = { key: number; kind: 'product'; productId: string; spec: Spec; override: string; note: string };
type CLine = { key: number; kind: 'custom'; name: string; summary: string; hsn: string; gstRate: number; qty: number; rate: number };
type Line = PLine | CLine;

const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitFmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 3 : 2 });
const FAMILY: Record<string, string> = { LABELS: 'Labels & stickers', PACKAGING: 'Boxes & packaging', POUCHES: 'Pouches', CARDS: 'Cards & invitations', LASER: 'Laser cut' };

function matLabel(code: string, mats: Record<string, MaterialInfo>) {
  if (mats[code]) return mats[code].name;
  const any = Object.values(mats).find((m) => m.code.startsWith(code + '-'));
  return any ? any.name.replace(/\s*\(.*\)\s*$/, '') : code;
}
function defaultSpec(cfg: ProductConfig, mats: Record<string, MaterialInfo>): Spec {
  const mat = cfg.materials.find((c) => mats[c] || Object.keys(mats).some((k) => k.startsWith(c + '-'))) || cfg.materials[0];
  return { size: Math.min(1, cfg.sizes.length - 1), material: mat, finish: cfg.finishes[0], sides: 1, extras: [], qty: cfg.qtyTiers[Math.min(1, cfg.qtyTiers.length - 1)] };
}

export default function LineBuilder({ mode, products, mats, ps, customers, shipping, action, preset }: {
  mode: 'order' | 'quote'; products: ProductLite[]; mats: Record<string, MaterialInfo>; ps: PricingSettings; customers: CustomerLite[]; shipping: ShippingRates;
  action: (p: FormResult, fd: FormData) => Promise<FormResult>;
  preset?: { customerId?: string; newCustomer?: { name: string; phone: string; company: string; email: string }; enquiryId?: string; notes?: string };
}) {
  const [state, run] = useFormState(action, null);
  const [seq, setSeq] = useState(2);
  const [lines, setLines] = useState<Line[]>(() => products.length ? [{ key: 1, kind: 'product', productId: products[0].id, spec: defaultSpec(products[0].config, mats), override: '', note: '' }] : []);
  const [custId, setCustId] = useState(preset?.customerId || '');
  const [query, setQuery] = useState('');
  const [isNew, setIsNew] = useState(!!preset?.newCustomer);
  const [nc, setNc] = useState({ name: preset?.newCustomer?.name || '', phone: preset?.newCustomer?.phone || '', company: preset?.newCustomer?.company || '', email: preset?.newCustomer?.email || '', gstin: '', line1: '', city: '', pincode: '' });
  const [channel, setChannel] = useState<'COUNTER' | 'B2B'>('COUNTER');
  const [fulfilment, setFulfilment] = useState<'PICKUP' | 'COURIER'>('PICKUP');
  const [terms, setTerms] = useState<'PREPAID' | 'PAY_ON_PICKUP' | 'CREDIT'>('PAY_ON_PICKUP');
  const [skipProof, setSkipProof] = useState(false);
  const [rush, setRush] = useState(false);
  const [discount, setDiscount] = useState('');
  const [shipOverride, setShipOverride] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [payMethod, setPayMethod] = useState('UPI');
  const [ship, setShip] = useState({ line1: '', city: '', pincode: '', stateCode: '33' });
  const [notes, setNotes] = useState(preset?.notes || '');
  const [validDays, setValidDays] = useState('15');

  const cust = customers.find((c) => c.id === custId) || null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers.filter((c) => [c.name, c.company, c.phone, c.code, c.gstin].some((v) => v && v.toLowerCase().includes(q))).slice(0, 8);
  }, [query, customers]);

  const priced = lines.map((l) => {
    if (l.kind === 'custom') return { ok: true as const, unit: l.rate, total: Math.round(l.qty * l.rate * 100) / 100, gstRate: l.gstRate, error: '' };
    const p = products.find((x) => x.id === l.productId)!;
    const r = price(p.model, p.config, l.spec, mats, ps);
    if (!r.ok) return { ok: false as const, unit: 0, total: 0, gstRate: p.gstRate, error: r.error };
    const ov = Number(l.override);
    return ov > 0 ? { ok: true as const, unit: ov, total: Math.round(ov * r.qty * 100) / 100, gstRate: p.gstRate, error: '', engine: r.unit, ups: r.ups, sheets: r.sheets } : { ok: true as const, unit: r.unit, total: r.total, gstRate: p.gstRate, error: '', engine: r.unit, ups: r.ups, sheets: r.sheets };
  });
  const sub = priced.reduce((a, p) => a + p.total, 0);
  const buyerState = fulfilment === 'COURIER' && mode === 'order' ? ship.stateCode : (cust?.stateCode || (nc.gstin.length >= 2 ? nc.gstin.slice(0, 2) : nc.pincode.length === 6 ? stateFromPin(nc.pincode) : '33'));
  const autoShip = mode === 'order' && fulfilment === 'COURIER' && sub > 0 && sub < shipping.freeAbove ? (buyerState === '33' ? shipping.tamilNadu : shipping.otherStates) : 0;
  const shipCost = shipOverride !== '' ? Math.max(0, Number(shipOverride) || 0) : autoShip;
  const disc = Math.min(Math.max(0, Number(discount) || 0), sub);
  const tax = computeTax(priced.map((p) => ({ amount: p.total, gstRate: p.gstRate })), shipCost, disc, buyerState);

  function pickCustomer(c: CustomerLite) {
    setCustId(c.id); setIsNew(false); setQuery('');
    if (c.creditDays > 0) { setChannel('B2B'); setTerms('CREDIT'); }
    setShip({ line1: c.line1 || '', city: c.city || '', pincode: c.pincode || '', stateCode: c.stateCode || '33' });
  }
  const update = (key: number, patch: Partial<PLine> | Partial<CLine>) => setLines((ls) => ls.map((l) => (l.key === key ? ({ ...l, ...patch } as Line) : l)));
  const updateSpec = (key: number, patch: Partial<Spec>) => setLines((ls) => ls.map((l) => (l.key === key && l.kind === 'product' ? { ...l, spec: { ...l.spec, ...patch } } : l)));
  const addProduct = () => { setLines((ls) => [...ls, { key: seq, kind: 'product', productId: products[0].id, spec: defaultSpec(products[0].config, mats), override: '', note: '' }]); setSeq(seq + 1); };
  const addCustom = () => { setLines((ls) => [...ls, { key: seq, kind: 'custom', name: '', summary: '', hsn: '4911', gstRate: 18, qty: 1, rate: 0 }]); setSeq(seq + 1); };

  const gstOk = !nc.gstin || checkGstin(nc.gstin).ok;
  const payload = JSON.stringify({
    customer: isNew ? { new: nc } : { id: custId },
    lines: lines.map((l) => (l.kind === 'product' ? { kind: 'product', productId: l.productId, spec: l.spec, unitOverride: Number(l.override) > 0 ? Number(l.override) : null, note: l.note || undefined } : { kind: 'custom', name: l.name, summary: l.summary, hsn: l.hsn, gstRate: l.gstRate, qty: l.qty, rate: l.rate })),
    discount: disc, notes,
    ...(mode === 'order' ? { channel, fulfilment, terms, skipProof, rush, shipping: shipCost, ship: fulfilment === 'COURIER' ? ship : null, paidNow: Number(paidNow) || 0, payMethod } : { validDays: Number(validDays) || 15, enquiryId: preset?.enquiryId }),
  });

  return (
    <form action={run} className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <input type="hidden" name="payload" value={payload} />
      <div className="space-y-6">
        <section className="card-pad">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Customer</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setIsNew(!isNew); setCustId(''); }}>{isNew ? 'Pick an existing customer' : '+ New customer'}</button></div>
          {isNew ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {([['name', 'Name', 'name'], ['phone', 'Mobile', 'tel'], ['company', 'Business name', 'organization'], ['email', 'Email', 'email'], ['gstin', 'GSTIN', 'off'], ['pincode', 'Pincode', 'postal-code'], ['line1', 'Address', 'address-line1'], ['city', 'City', 'address-level2']] as const).map(([k, l, ac]) => (
                <label key={k} className="text-sm"><span className="label">{l}{['name', 'phone'].includes(k) ? '' : ' (optional)'}</span>
                  <input className={`input ${k === 'gstin' ? 'uppercase' : ''}`} autoComplete={ac} value={nc[k]} onChange={(e) => setNc({ ...nc, [k]: k === 'gstin' ? e.target.value.toUpperCase() : e.target.value })} /></label>
              ))}
              {!gstOk && <p className="text-sm text-rose-700 sm:col-span-2">{checkGstin(nc.gstin).error}</p>}
            </div>
          ) : cust ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-mist/60 p-3 text-sm">
              <div><b>{cust.company || cust.name}</b> <span className="mono text-xs text-ink-soft">{cust.code}</span><br /><span className="text-ink-soft">{cust.company ? cust.name + ' · ' : ''}{cust.phone}{cust.gstin ? ` · GSTIN ${cust.gstin}` : ''}</span>{cust.creditDays > 0 && <><br /><span className="text-leaf-700">{cust.creditDays}-day credit account</span></>}</div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setCustId('')}>Change</button>
            </div>
          ) : (
            <div>
              <input className="input" placeholder="Search name, business, phone, GSTIN or code" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {matches.map((c) => <li key={c.id}><button type="button" onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-mist"><span><b>{c.company || c.name}</b>{c.company && <span className="text-ink-soft"> · {c.name}</span>}</span><span className="text-xs text-ink-soft">{c.phone}</span></button></li>)}
                {!matches.length && <li className="px-3 py-2 text-sm text-ink-soft">No match. Use “New customer”.</li>}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Items</h2>
            <div className="flex gap-2"><button type="button" className="btn-secondary btn-sm" onClick={addProduct}>+ Product</button><button type="button" className="btn-ghost btn-sm" onClick={addCustom}>+ Custom item</button></div></div>
          {lines.map((l, idx) => {
            const pr = priced[idx];
            if (l.kind === 'custom') return (
              <div key={l.key} className="card p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Item {idx + 1} · custom</span><button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button></div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <label className="text-sm sm:col-span-3"><span className="label">Item name</span><input className="input" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="e.g. Design charge, sample kit" /></label>
                  <label className="text-sm sm:col-span-3"><span className="label">Details</span><input className="input" value={l.summary} onChange={(e) => update(l.key, { summary: e.target.value })} /></label>
                  <label className="text-sm"><span className="label">HSN/SAC</span><input className="input" value={l.hsn} onChange={(e) => update(l.key, { hsn: e.target.value.replace(/\D/g, '') })} /></label>
                  <label className="text-sm"><span className="label">GST %</span><select className="input" value={l.gstRate} onChange={(e) => update(l.key, { gstRate: Number(e.target.value) })}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</select></label>
                  <label className="text-sm"><span className="label">Qty</span><input type="number" min={1} className="input" value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} /></label>
                  <label className="text-sm"><span className="label">Rate ₹</span><input type="number" min={0} step="0.01" className="input" value={l.rate || ''} onChange={(e) => update(l.key, { rate: Number(e.target.value) })} /></label>
                  <div className="num self-end pb-2 text-right font-semibold sm:col-span-2">{rs2(pr.total)}</div>
                </div>
              </div>
            );
            const p = products.find((x) => x.id === l.productId)!;
            const cfg = p.config;
            return (
              <div key={l.key} className="card p-4">
                <div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Item {idx + 1}</span>{lines.length > 1 && <button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button>}</div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <label className="text-sm sm:col-span-3"><span className="label">Product</span>
                    <select className="input" value={l.productId} onChange={(e) => { const np = products.find((x) => x.id === e.target.value)!; update(l.key, { productId: np.id, spec: defaultSpec(np.config, mats), override: '' }); }}>
                      {Object.entries(FAMILY).map(([f, label]) => <optgroup key={f} label={label}>{products.filter((x) => x.family === f).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
                    </select></label>
                  <label className="text-sm sm:col-span-3"><span className="label">Size</span>
                    <select className="input" value={String(l.spec.size)} onChange={(e) => updateSpec(l.key, e.target.value === 'custom' ? { size: 'custom', w: cfg.sizes[0].w, h: cfg.sizes[0].h, d: cfg.sizes[0].d } : { size: Number(e.target.value), w: undefined, h: undefined, d: undefined })}>
                      {cfg.sizes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}{cfg.custom && <option value="custom">Custom size…</option>}
                    </select></label>
                  {l.spec.size === 'custom' && (['w', 'h', ...(cfg.form !== 'flat' ? ['d'] : [])] as ('w' | 'h' | 'd')[]).map((k) => (
                    <label key={k} className="text-sm sm:col-span-2"><span className="label">{k === 'w' ? (cfg.form === 'flat' ? 'Width' : 'Length') : k === 'h' ? 'Height' : 'Depth'} mm</span><input type="number" className="input" value={l.spec[k] ?? ''} onChange={(e) => updateSpec(l.key, { [k]: Number(e.target.value) })} /></label>
                  ))}
                  <label className="text-sm sm:col-span-2"><span className="label">Material</span>
                    <select className="input" value={l.spec.material} onChange={(e) => updateSpec(l.key, { material: e.target.value })}>{cfg.materials.map((c) => <option key={c} value={c}>{matLabel(c, mats)}</option>)}</select></label>
                  <label className="text-sm sm:col-span-2"><span className="label">Finish</span>
                    <select className="input" value={l.spec.finish} onChange={(e) => updateSpec(l.key, { finish: e.target.value })}>{cfg.finishes.map((f) => <option key={f} value={f}>{FINISH_LABEL[f] || f}</option>)}</select></label>
                  {cfg.sides ? <label className="text-sm"><span className="label">Sides</span><select className="input" value={l.spec.sides || 1} onChange={(e) => updateSpec(l.key, { sides: Number(e.target.value) as 1 | 2 })}><option value={1}>One</option><option value={2}>Both</option></select></label> : null}
                  <label className="text-sm"><span className="label">Qty</span><input type="number" min={1} className="input" value={l.spec.qty} onChange={(e) => updateSpec(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} /></label>
                  {cfg.extras?.length ? <div className="flex flex-wrap gap-2 sm:col-span-6">{cfg.extras.map((x) => { const on = l.spec.extras?.includes(x.code); return <button key={x.code} type="button" className={`chip ${on ? 'chip-on' : ''}`} onClick={() => updateSpec(l.key, { extras: on ? l.spec.extras!.filter((c) => c !== x.code) : [...(l.spec.extras || []), x.code] })}>{on ? '✓ ' : '+ '}{x.label}</button>; })}</div> : null}
                  <label className="text-sm sm:col-span-3"><span className="label">Note on this item (optional)</span><input className="input" value={l.note} onChange={(e) => update(l.key, { note: e.target.value })} placeholder="e.g. 3 designs, 100 each" /></label>
                  <label className="text-sm sm:col-span-1"><span className="label">Special rate</span><input type="number" min={0} step="0.01" className="input" value={l.override} placeholder="₹/pc" onChange={(e) => update(l.key, { override: e.target.value })} /></label>
                  <div className="text-right sm:col-span-2 sm:self-end">
                    {pr.ok ? <><div className="num font-semibold">{rs2(pr.total)}</div><div className="num text-xs text-ink-soft">{unitFmt(pr.unit)}/pc{'engine' in pr && Number(l.override) > 0 ? ` (list ${unitFmt(pr.engine as number)})` : ''}{'ups' in pr && pr.ups ? ` · ${pr.ups} up, ${pr.sheets} sheets` : ''}</div></>
                      : <div className="text-xs text-amber-800">{pr.error}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card-pad">
          <h2 className="mb-3 font-semibold">{mode === 'order' ? 'Order details' : 'Quote details'}</h2>
          {mode === 'order' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><span className="label">Type</span><div className="flex gap-2">{([['COUNTER', 'Walk-in'], ['B2B', 'B2B account']] as const).map(([v, t]) => <button key={v} type="button" className={`chip ${channel === v ? 'chip-on' : ''}`} onClick={() => setChannel(v)}>{t}</button>)}</div></div>
              <div><span className="label">Delivery</span><div className="flex gap-2">{([['PICKUP', 'Pickup'], ['COURIER', 'Courier']] as const).map(([v, t]) => <button key={v} type="button" className={`chip ${fulfilment === v ? 'chip-on' : ''}`} onClick={() => setFulfilment(v)}>{t}</button>)}</div></div>
              {fulfilment === 'COURIER' && <div className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
                <label className="text-sm sm:col-span-2"><span className="label">Ship to address</span><input className="input" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} /></label>
                <label className="text-sm"><span className="label">City</span><input className="input" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Pincode</span><input className="input" inputMode="numeric" maxLength={6} value={ship.pincode} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setShip({ ...ship, pincode: v, ...(v.length === 6 ? { stateCode: stateFromPin(v) } : {}) }); }} /></label>
                <label className="text-sm sm:col-span-2"><span className="label">State</span><select className="input" value={ship.stateCode} onChange={(e) => setShip({ ...ship, stateCode: e.target.value })}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
              </div>}
              <div className="sm:col-span-2"><span className="label">Payment terms</span><div className="flex flex-wrap gap-2">{([['PAY_ON_PICKUP', 'Pay on delivery/pickup'], ['PREPAID', 'Paid in advance'], ['CREDIT', 'Credit (invoice)']] as const).map(([v, t]) => <button key={v} type="button" className={`chip ${terms === v ? 'chip-on' : ''}`} onClick={() => setTerms(v)}>{t}</button>)}</div>
                {terms === 'CREDIT' && !(cust && cust.creditDays > 0) && <p className="hint text-amber-800">This customer has no credit set. Set credit days on their customer page, or the order uses the default credit period.</p>}</div>
              <label className="text-sm"><span className="label">Received now ₹</span><input type="number" min={0} step="0.01" className="input" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="Advance or full payment" /></label>
              <label className="text-sm"><span className="label">Paid by</span><select className="input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>{['UPI', 'CASH', 'CARD', 'BANK', 'CHEQUE'].map((m) => <option key={m}>{m}</option>)}</select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={skipProof} onChange={(e) => setSkipProof(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Customer approved the artwork here (skip proof)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rush} onChange={(e) => setRush(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Rush job</label>
            </div>
          ) : (
            <label className="text-sm"><span className="label">Valid for (days)</span><input type="number" min={1} max={90} className="input w-32" value={validDays} onChange={(e) => setValidDays(e.target.value)} /></label>
          )}
          <label className="mt-4 block text-sm"><span className="label">Notes {mode === 'quote' ? '(printed on the quote)' : '(for the team)'}</span><textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </section>
      </div>

      <aside className="card-pad h-fit xl:sticky xl:top-6">
        <h2 className="font-semibold">Summary</h2>
        <div className="num mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><span>Items ({lines.length})</span><span>{rs2(sub)}</span></div>
          <label className="flex items-center justify-between gap-3"><span>Discount ₹</span><input type="number" min={0} step="0.01" className="input w-28 py-1 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
          {mode === 'order' && <label className="flex items-center justify-between gap-3"><span>Shipping ₹</span><input type="number" min={0} step="0.01" className="input w-28 py-1 text-right" value={shipOverride !== '' ? shipOverride : String(autoShip)} onChange={(e) => setShipOverride(e.target.value)} /></label>}
          <div className="flex justify-between text-ink-soft"><span>Taxable</span><span>{rs2(tax.taxable)}</span></div>
          {tax.interstate ? <div className="flex justify-between text-ink-soft"><span>IGST</span><span>{rs2(tax.igst)}</span></div> : <>
            <div className="flex justify-between text-ink-soft"><span>CGST</span><span>{rs2(tax.cgst)}</span></div>
            <div className="flex justify-between text-ink-soft"><span>SGST</span><span>{rs2(tax.sgst)}</span></div></>}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Total</span><span>{rs2(tax.total)}</span></div>
          {mode === 'order' && Number(paidNow) > 0 && <div className="flex justify-between text-ink-soft"><span>Balance after payment</span><span>{rs2(Math.max(0, tax.total - Number(paidNow)))}</span></div>}
        </div>
        {state?.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn-primary mt-4 w-full" pendingText="Saving…">{mode === 'order' ? 'Create order' : 'Save quote'}</SubmitButton>
      </aside>
    </form>
  );
}
