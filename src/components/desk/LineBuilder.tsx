'use client';
import { useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import SubmitButton from '@/components/SubmitButton';
import type { FormResult } from '@/components/FormMessage';
import { FINISH_LABEL, margin, price, priceForMargin, type MaterialInfo, type PricingSettings, type ProductConfig, type Spec } from '@/lib/pricing';
import { STATES, checkGstin, computeTax, stateFromPin } from '@/lib/gst';
import SheetLayout from './SheetLayout';

export type ProductLite = { id: string; name: string; family: string; model: 'SHEET' | 'POUCH' | 'LASER'; hsn: string; gstRate: number; leadDays: number; config: ProductConfig };
export type CustomerLite = { id: string; code: string; name: string; company: string | null; phone: string; gstin: string | null; stateCode: string | null; creditDays: number; line1: string | null; city: string | null; pincode: string | null };
type ShippingRates = { tamilNadu: number; otherStates: number; freeAbove: number };

type PLine = { key: number; kind: 'product'; productId: string; spec: Spec; override: string; note: string };
type CLine = { key: number; kind: 'custom'; name: string; summary: string; hsn: string; gstRate: number; qty: number; rate: number; cost: number };
type Line = PLine | CLine;

const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rs0 = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const unitFmt = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: n < 10 ? 3 : 2 });
const FAMILY: Record<string, string> = { LABELS: 'Labels & stickers', PACKAGING: 'Boxes & packaging', POUCHES: 'Pouches', CARDS: 'Cards & invitations', LASER: 'Laser cut' };
const MARGIN_STEPS = [20, 25, 30, 35, 40, 45, 50, 55, 60];

function matLabel(code: string, mats: Record<string, MaterialInfo>) {
  if (mats[code]) return mats[code].name;
  const any = Object.values(mats).find((m) => m.code.startsWith(code + '-'));
  return any ? any.name.replace(/\s*\(.*\)\s*$/, '') : code;
}
function defaultSpec(cfg: ProductConfig, mats: Record<string, MaterialInfo>): Spec {
  const mat = cfg.materials.find((c) => mats[c] || Object.keys(mats).some((k) => k.startsWith(c + '-'))) || cfg.materials[0];
  return { size: Math.min(1, cfg.sizes.length - 1), material: mat, finish: cfg.finishes[0], sides: 1, extras: [], qty: cfg.qtyTiers[Math.min(1, cfg.qtyTiers.length - 1)] };
}
function MarginTag({ pct, ps }: { pct: number; ps: PricingSettings }) {
  const tone = pct < ps.minMargin ? 'tone-bad' : pct < ps.targetMargin ? 'tone-warn' : 'tone-good';
  return <span className={`badge ${tone}`}>{pct.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% margin</span>;
}
const Sel = ({ label, value, onChange, children, className = '' }: { label: string; value: string | number; onChange: (v: string) => void; children: React.ReactNode; className?: string }) => (
  <label className={`text-sm ${className}`}><span className="label">{label}</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>
);

export default function LineBuilder({ mode, products, mats, ps, customers, shipping, action, preset, showCost = true }: {
  mode: 'order' | 'quote'; products: ProductLite[]; mats: Record<string, MaterialInfo>; ps: PricingSettings; customers: CustomerLite[]; shipping: ShippingRates; showCost?: boolean;
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
  const [costOpen, setCostOpen] = useState<number | null>(null);

  const cust = customers.find((c) => c.id === custId) || null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 6);
    return customers.filter((c) => [c.name, c.company, c.phone, c.code, c.gstin].some((v) => v && v.toLowerCase().includes(q))).slice(0, 8);
  }, [query, customers]);

  const priced = lines.map((l) => {
    if (l.kind === 'custom') { const total = Math.round(l.qty * l.rate * 100) / 100; return { ok: true as const, unit: l.rate, total, cost: Math.round(l.qty * l.cost * 100) / 100, gstRate: l.gstRate, error: '', r: null }; }
    const p = products.find((x) => x.id === l.productId)!;
    const r = price(p.model, p.config, l.spec, mats, ps);
    if (!r.ok) return { ok: false as const, unit: 0, total: 0, cost: 0, gstRate: p.gstRate, error: r.error, r: null };
    const ov = Number(l.override);
    return { ok: true as const, unit: ov > 0 ? ov : r.unit, total: ov > 0 ? Math.round(ov * r.qty * 100) / 100 : r.total, cost: r.cost, gstRate: p.gstRate, error: '', r };
  });
  const sub = priced.reduce((a, p) => a + p.total, 0);
  const costTotal = priced.reduce((a, p) => a + p.cost, 0);
  const buyerState = fulfilment === 'COURIER' && mode === 'order' ? ship.stateCode : (cust?.stateCode || (nc.gstin.length >= 2 ? nc.gstin.slice(0, 2) : nc.pincode.length === 6 ? stateFromPin(nc.pincode) : '33'));
  const autoShip = mode === 'order' && fulfilment === 'COURIER' && sub > 0 && sub < shipping.freeAbove ? (buyerState === '33' ? shipping.tamilNadu : shipping.otherStates) : 0;
  const shipCost = shipOverride !== '' ? Math.max(0, Number(shipOverride) || 0) : autoShip;
  const disc = Math.min(Math.max(0, Number(discount) || 0), sub);
  const tax = computeTax(priced.map((p) => ({ amount: p.total, gstRate: p.gstRate })), shipCost, disc, buyerState);
  const overall = margin(sub - disc, costTotal);

  function pickCustomer(c: CustomerLite) {
    setCustId(c.id); setIsNew(false); setQuery('');
    if (c.creditDays > 0) { setChannel('B2B'); setTerms('CREDIT'); }
    setShip({ line1: c.line1 || '', city: c.city || '', pincode: c.pincode || '', stateCode: c.stateCode || '33' });
  }
  const update = (key: number, patch: Partial<PLine> | Partial<CLine>) => setLines((ls) => ls.map((l) => (l.key === key ? ({ ...l, ...patch } as Line) : l)));
  const updateSpec = (key: number, patch: Partial<Spec>) => setLines((ls) => ls.map((l) => (l.key === key && l.kind === 'product' ? { ...l, spec: { ...l.spec, ...patch } } : l)));
  const addProduct = () => { setLines((ls) => [...ls, { key: seq, kind: 'product', productId: products[0].id, spec: defaultSpec(products[0].config, mats), override: '', note: '' }]); setSeq(seq + 1); };
  const addCustom = () => { setLines((ls) => [...ls, { key: seq, kind: 'custom', name: '', summary: '', hsn: '4911', gstRate: 18, qty: 1, rate: 0, cost: 0 }]); setSeq(seq + 1); };

  const gstOk = !nc.gstin || checkGstin(nc.gstin).ok;
  const payload = JSON.stringify({
    customer: isNew ? { new: nc } : { id: custId },
    lines: lines.map((l) => (l.kind === 'product' ? { kind: 'product', productId: l.productId, spec: l.spec, unitOverride: Number(l.override) > 0 ? Number(l.override) : null, note: l.note || undefined } : { kind: 'custom', name: l.name, summary: l.summary, hsn: l.hsn, gstRate: l.gstRate, qty: l.qty, rate: l.rate, cost: l.cost })),
    discount: disc, notes,
    ...(mode === 'order' ? { channel, fulfilment, terms, skipProof, rush, shipping: shipCost, ship: fulfilment === 'COURIER' ? ship : null, paidNow: Number(paidNow) || 0, payMethod } : { validDays: Number(validDays) || 15, enquiryId: preset?.enquiryId }),
  });

  return (
    <form action={run} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <input type="hidden" name="payload" value={payload} />
      <div className="space-y-6">
        <section className="card-pad">
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg">Customer</h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setIsNew(!isNew); setCustId(''); }}>{isNew ? 'Pick an existing customer' : 'Add a new customer'}</button></div>
          {isNew ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {([['name', 'Name', 'name'], ['phone', 'Mobile', 'tel'], ['company', 'Business name', 'organization'], ['email', 'Email', 'email'], ['gstin', 'GSTIN', 'off'], ['pincode', 'Pincode', 'postal-code'], ['line1', 'Address', 'address-line1'], ['city', 'City', 'address-level2']] as const).map(([k, l, ac]) => (
                <label key={k} className="text-sm"><span className="label">{l}{['name', 'phone'].includes(k) ? '' : <span className="font-normal text-ink-faint"> (optional)</span>}</span>
                  <input className={`input ${k === 'gstin' ? 'uppercase' : ''}`} autoComplete={ac} value={nc[k]} onChange={(e) => setNc({ ...nc, [k]: k === 'gstin' ? e.target.value.toUpperCase() : e.target.value })} /></label>
              ))}
              {!gstOk && <p className="text-sm text-rose-700 sm:col-span-2">{checkGstin(nc.gstin).error}</p>}
            </div>
          ) : cust ? (
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-paper p-3.5 text-sm">
              <div><b className="text-[15px]">{cust.company || cust.name}</b> <span className="text-xs text-ink-faint">{cust.code}</span><br /><span className="text-ink-soft">{cust.company ? `${cust.name}, ` : ''}{cust.phone}{cust.gstin ? `, GSTIN ${cust.gstin}` : ''}</span>{cust.creditDays > 0 && <><br /><span className="text-leaf-700">{cust.creditDays}-day credit account</span></>}</div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setCustId('')}>Change</button>
            </div>
          ) : (
            <div>
              <input className="input" placeholder="Search by name, business, phone, GSTIN or code" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search customers" />
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {matches.map((c) => <li key={c.id}><button type="button" onClick={() => pickCustomer(c)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-sky-50"><span><b>{c.company || c.name}</b>{c.company && <span className="text-ink-soft">, {c.name}</span>}</span><span className="text-xs text-ink-soft">{c.phone}</span></button></li>)}
                {!matches.length && <li className="px-3.5 py-2.5 text-sm text-ink-soft">No match. Use “Add a new customer”.</li>}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg">Items</h2>
            <div className="flex gap-2"><button type="button" className="btn-secondary btn-sm" onClick={addProduct}>Add product</button><button type="button" className="btn-ghost btn-sm" onClick={addCustom}>Add custom item</button></div></div>
          {lines.map((l, idx) => {
            const pr = priced[idx];
            const m = margin(pr.total, pr.cost);
            if (l.kind === 'custom') return (
              <div key={l.key} className="card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-ink-soft">Item {idx + 1}: custom</span><button type="button" className="text-sm text-rose-700 hover:underline" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button></div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <label className="text-sm sm:col-span-3"><span className="label">Item</span><input className="input" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="Design charge, sample kit, outside job" /></label>
                  <label className="text-sm sm:col-span-3"><span className="label">Details</span><input className="input" value={l.summary} onChange={(e) => update(l.key, { summary: e.target.value })} /></label>
                  <label className="text-sm"><span className="label">HSN / SAC</span><input className="input" value={l.hsn} onChange={(e) => update(l.key, { hsn: e.target.value.replace(/\D/g, '') })} /></label>
                  <Sel label="GST" value={l.gstRate} onChange={(v) => update(l.key, { gstRate: Number(v) })}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</Sel>
                  <label className="text-sm"><span className="label">Qty</span><input type="number" min={1} className="input" value={l.qty} onChange={(e) => update(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} /></label>
                  <label className="text-sm"><span className="label">Rate ₹</span><input type="number" min={0} step="0.01" className="input" value={l.rate || ''} onChange={(e) => update(l.key, { rate: Number(e.target.value) })} /></label>
                  {showCost && <label className="text-sm"><span className="label">Our cost ₹</span><input type="number" min={0} step="0.01" className="input" value={l.cost || ''} placeholder="per piece" onChange={(e) => update(l.key, { cost: Number(e.target.value) })} /></label>}
                  <div className="text-right sm:self-end"><div className="num font-semibold">{rs2(pr.total)}</div>{showCost && pr.total > 0 && l.cost > 0 && <MarginTag pct={m.pct} ps={ps} />}</div>
                </div>
              </div>
            );
            const p = products.find((x) => x.id === l.productId)!;
            const cfg = p.config;
            const r = pr.r;
            return (
              <div key={l.key} className="card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-ink-soft">Item {idx + 1}</span>{lines.length > 1 && <button type="button" className="text-sm text-rose-700 hover:underline" onClick={() => setLines(lines.filter((x) => x.key !== l.key))}>Remove</button>}</div>
                <div className="grid gap-3 sm:grid-cols-6">
                  <Sel className="sm:col-span-3" label="Product" value={l.productId} onChange={(v) => { const np = products.find((x) => x.id === v)!; update(l.key, { productId: np.id, spec: defaultSpec(np.config, mats), override: '' }); }}>
                    {Object.entries(FAMILY).map(([f, label]) => <optgroup key={f} label={label}>{products.filter((x) => x.family === f).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
                  </Sel>
                  <Sel className="sm:col-span-3" label="Size" value={String(l.spec.size)} onChange={(v) => updateSpec(l.key, v === 'custom' ? { size: 'custom', w: cfg.sizes[0].w, h: cfg.sizes[0].h, d: cfg.sizes[0].d } : { size: Number(v), w: undefined, h: undefined, d: undefined })}>
                    {cfg.sizes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}{cfg.custom && <option value="custom">Custom size…</option>}
                  </Sel>
                  {l.spec.size === 'custom' && (['w', 'h', ...(cfg.form !== 'flat' ? ['d'] : [])] as ('w' | 'h' | 'd')[]).map((k) => (
                    <label key={k} className="text-sm sm:col-span-2"><span className="label">{k === 'w' ? (cfg.form === 'flat' ? 'Width' : 'Length') : k === 'h' ? 'Height' : 'Depth'} (mm)</span><input type="number" className="input" value={l.spec[k] ?? ''} onChange={(e) => updateSpec(l.key, { [k]: Number(e.target.value) })} /></label>
                  ))}
                  <Sel className="sm:col-span-2" label="Material" value={l.spec.material} onChange={(v) => updateSpec(l.key, { material: v })}>{cfg.materials.map((c) => <option key={c} value={c}>{matLabel(c, mats)}</option>)}</Sel>
                  <Sel className="sm:col-span-2" label="Finish" value={l.spec.finish} onChange={(v) => updateSpec(l.key, { finish: v })}>{cfg.finishes.map((f) => <option key={f} value={f}>{FINISH_LABEL[f] || f}</option>)}</Sel>
                  {cfg.sides ? <Sel label="Sides" value={l.spec.sides || 1} onChange={(v) => updateSpec(l.key, { sides: Number(v) as 1 | 2 })}><option value={1}>One side</option><option value={2}>Both sides</option></Sel> : null}
                  <label className="text-sm"><span className="label">Qty</span><input type="number" min={1} className="input" value={l.spec.qty} onChange={(e) => updateSpec(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value))) })} list={`tiers-${l.key}`} /><datalist id={`tiers-${l.key}`}>{cfg.qtyTiers.map((q) => <option key={q} value={q} />)}</datalist></label>
                  {cfg.extras?.length ? <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm sm:col-span-6">{cfg.extras.map((x) => { const on = !!l.spec.extras?.includes(x.code); return <label key={x.code} className="flex items-center gap-2"><input type="checkbox" className="check" checked={on} onChange={() => updateSpec(l.key, { extras: on ? l.spec.extras!.filter((c) => c !== x.code) : [...(l.spec.extras || []), x.code] })} />{x.label}</label>; })}</div> : null}
                  <label className="text-sm sm:col-span-6"><span className="label">Note on this item <span className="font-normal text-ink-faint">(optional)</span></span><input className="input" value={l.note} onChange={(e) => update(l.key, { note: e.target.value })} placeholder="e.g. 3 designs, 100 each" /></label>
                </div>
                {pr.ok && r ? (
                  <div className="mt-4 grid gap-4 rounded-xl bg-paper p-3.5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                    {r.ups ? <SheetLayout sw={p.model === 'LASER' ? 600 : ps.sheet.w} sh={p.model === 'LASER' ? 400 : ps.sheet.h} pw={r.piece.w} ph={r.piece.h} n={r.ups} className="h-20 w-auto" /> : <div className="hidden sm:block" />}
                    <div className="text-sm">
                      <p className="num">{r.ups ? <>{r.ups} per sheet, {r.sheets} sheets{r.white ? ', white ink' : ''}</> : null}{r.minutes ? <>{r.ups ? ', ' : ''}{r.minutes} min laser</> : null}{!r.ups && !r.minutes ? 'Printed on blanks' : ''}</p>
                      {showCost && <p className="num text-ink-soft">Cost {rs2(pr.cost)} <button type="button" className="text-xs text-sky-700 underline" onClick={() => setCostOpen(costOpen === l.key ? null : l.key)}>{costOpen === l.key ? 'hide' : 'details'}</button></p>}
                      {showCost && costOpen === l.key && <ul className="num mt-1 space-y-0.5 text-xs text-ink-soft">{r.costLines.map((c, i) => <li key={i} className="flex justify-between gap-3"><span>{c.label}</span><span>{rs2(c.amount)}</span></li>)}</ul>}
                    </div>
                    <div className={`grid items-end gap-2 ${showCost ? 'grid-cols-2 sm:w-[320px]' : 'sm:w-[160px]'}`}>
                      {showCost && <Sel label="Margin" value={MARGIN_STEPS.find((pct) => Number(l.override) === priceForMargin(pr.cost, r.qty, pct)) ?? (Number(l.override) > 0 ? 'own' : 'list')}
                        onChange={(v) => update(l.key, { override: v === 'list' ? '' : v === 'own' ? l.override : String(priceForMargin(pr.cost, r.qty, Number(v))) })}>
                        <option value="list">List price</option>
                        {MARGIN_STEPS.map((pct) => <option key={pct} value={pct}>{pct}% margin</option>)}
                        {Number(l.override) > 0 && !MARGIN_STEPS.some((pct) => Number(l.override) === priceForMargin(pr.cost, r.qty, pct)) && <option value="own">Own rate</option>}
                      </Sel>}
                      <label className="text-sm"><span className="label">Rate ₹/pc</span><input type="number" min={0} step="0.01" className="input" value={l.override} placeholder={String(r.unit)} onChange={(e) => update(l.key, { override: e.target.value })} /></label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 sm:col-span-3">
                      <span className="num text-sm text-ink-soft">{unitFmt(pr.unit)} each{Number(l.override) > 0 ? ` (list ${unitFmt(r.unit)})` : ''}</span>
                      <span className="flex items-center gap-2">{showCost && <MarginTag pct={m.pct} ps={ps} />}<b className="num text-[15px]">{rs2(pr.total)}</b></span>
                    </div>
                  </div>
                ) : <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{pr.error}</p>}
              </div>
            );
          })}
        </section>

        <section className="card-pad">
          <h2 className="mb-4 text-lg">{mode === 'order' ? 'Order details' : 'Quote details'}</h2>
          {mode === 'order' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Sel label="Order type" value={channel} onChange={(v) => setChannel(v as 'COUNTER')}><option value="COUNTER">Walk-in</option><option value="B2B">B2B account</option></Sel>
              <Sel label="Delivery" value={fulfilment} onChange={(v) => setFulfilment(v as 'PICKUP')}><option value="PICKUP">Pickup from studio</option><option value="COURIER">Courier</option></Sel>
              <Sel label="Payment" value={terms} onChange={(v) => setTerms(v as 'PREPAID')}><option value="PAY_ON_PICKUP">Pay on delivery or pickup</option><option value="PREPAID">Paid in advance</option><option value="CREDIT">Credit (invoice)</option></Sel>
              {terms === 'CREDIT' && !(cust && cust.creditDays > 0) && <p className="hint text-amber-800 sm:col-span-3">This customer has no credit set. Set credit days on their customer page, or the default credit period applies.</p>}
              {fulfilment === 'COURIER' && <>
                <label className="text-sm sm:col-span-3"><span className="label">Ship to address</span><input className="input" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} /></label>
                <label className="text-sm"><span className="label">City</span><input className="input" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} /></label>
                <label className="text-sm"><span className="label">Pincode</span><input className="input" inputMode="numeric" maxLength={6} value={ship.pincode} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setShip({ ...ship, pincode: v, ...(v.length === 6 ? { stateCode: stateFromPin(v) } : {}) }); }} /></label>
                <Sel label="State" value={ship.stateCode} onChange={(v) => setShip({ ...ship, stateCode: v })}>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</Sel>
              </>}
              <label className="text-sm"><span className="label">Received now ₹</span><input type="number" min={0} step="0.01" className="input" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} placeholder="Advance or full" /></label>
              <Sel label="Paid by" value={payMethod} onChange={setPayMethod}>{[['UPI', 'UPI'], ['CASH', 'Cash'], ['CARD', 'Card'], ['BANK', 'Bank transfer'], ['CHEQUE', 'Cheque']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Sel>
              <Sel label="Proof" value={skipProof ? 'skip' : 'send'} onChange={(v) => setSkipProof(v === 'skip')}><option value="send">Send a proof first</option><option value="skip">Artwork approved here, start printing</option></Sel>
              <Sel label="Priority" value={rush ? 'rush' : 'normal'} onChange={(v) => setRush(v === 'rush')}><option value="normal">Normal</option><option value="rush">Rush job</option></Sel>
            </div>
          ) : (
            <Sel className="block max-w-xs" label="Valid for" value={validDays} onChange={setValidDays}>{[7, 15, 30, 45, 60].map((d) => <option key={d} value={d}>{d} days, then expires automatically</option>)}</Sel>
          )}
          <label className="mt-4 block text-sm"><span className="label">Notes {mode === 'quote' ? <span className="font-normal text-ink-faint">(printed on the quote)</span> : <span className="font-normal text-ink-faint">(for the team)</span>}</span><textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </section>
      </div>

      <aside className="card-pad h-fit xl:sticky xl:top-20">
        <h2 className="text-lg">Summary</h2>
        <div className="num mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><span>Items ({lines.length})</span><span>{rs2(sub)}</span></div>
          <label className="flex items-center justify-between gap-3"><span>Discount ₹</span><input type="number" min={0} step="0.01" className="input w-28 py-1.5 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} /></label>
          {mode === 'order' && <label className="flex items-center justify-between gap-3"><span>Shipping ₹</span><input type="number" min={0} step="0.01" className="input w-28 py-1.5 text-right" value={shipOverride !== '' ? shipOverride : String(autoShip)} onChange={(e) => setShipOverride(e.target.value)} /></label>}
          <div className="flex justify-between text-ink-soft"><span>Taxable value</span><span>{rs2(tax.taxable)}</span></div>
          {tax.interstate ? <div className="flex justify-between text-ink-soft"><span>IGST</span><span>{rs2(tax.igst)}</span></div> : <>
            <div className="flex justify-between text-ink-soft"><span>CGST</span><span>{rs2(tax.cgst)}</span></div>
            <div className="flex justify-between text-ink-soft"><span>SGST</span><span>{rs2(tax.sgst)}</span></div></>}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Total</span><span>{rs2(tax.total)}</span></div>
          {mode === 'order' && Number(paidNow) > 0 && <div className="flex justify-between text-ink-soft"><span>Balance after payment</span><span>{rs2(Math.max(0, tax.total - Number(paidNow)))}</span></div>}
        </div>
        {showCost && sub > 0 && (
          <div className="mt-4 rounded-xl bg-paper p-3.5 text-sm">
            <div className="flex items-center justify-between"><span className="font-semibold">Margin</span><MarginTag pct={overall.pct} ps={ps} /></div>
            <div className="num mt-2 space-y-1 text-ink-soft">
              <div className="flex justify-between"><span>Our cost</span><span>{rs0(costTotal)}</span></div>
              <div className="flex justify-between"><span>Profit before overheads</span><span className="font-semibold text-ink">{rs0(overall.amount)}</span></div>
            </div>
            {overall.pct < ps.minMargin && <p className="mt-2 text-xs text-rose-700">Below your {ps.minMargin}% minimum. Check the rates or the discount.</p>}
            <p className="mt-2 text-xs text-ink-faint">Only staff see this. It never prints on the quote or invoice.</p>
          </div>
        )}
        {state?.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn-primary btn-lg mt-4 w-full" pendingText="Saving…">{mode === 'order' ? 'Create order' : 'Save quote'}</SubmitButton>
      </aside>
    </form>
  );
}
