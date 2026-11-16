'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { blankSize, fitUps, price, tierPrices, FINISH_LABEL, type MaterialInfo, type PricingSettings, type Spec } from '@/lib/pricing';
import type { ProductLite } from './LineBuilder';

const rs = (n: number, d = 2) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const f1 = (n: number, d = 1) => n.toLocaleString('en-IN', { maximumFractionDigits: d });
const TOOLS = [
  ['quick', 'Quick price', 'Any product, any spec'],
  ['ups', 'Sheet layout', 'Pieces per SRA3 and sheets needed'],
  ['box', 'Box blank', 'Flat size of a tuck-end box'],
  ['laser', 'Laser time', 'Cutting and engraving cost'],
  ['paper', 'Paper weight', 'GSM, sheets and kilograms'],
  ['lam', 'Lamination film', 'Film used per job'],
  ['gst', 'GST', 'Add or remove GST'],
  ['margin', 'Margin', 'Cost, price and markup'],
  ['units', 'Units', 'mm, inch, point'],
] as const;

function N({ label, value, set, step = 'any', suffix }: { label: string; value: number; set: (n: number) => void; step?: string; suffix?: string }) {
  return <label className="text-sm"><span className="label">{label}{suffix ? <span className="font-normal text-ink-faint"> ({suffix})</span> : null}</span><input type="number" step={step} className="input" value={Number.isFinite(value) ? value : ''} onChange={(e) => set(Number(e.target.value))} /></label>;
}
const Out = ({ rows }: { rows: [ReactNode, ReactNode, boolean?][] }) => (
  <dl className="mt-4 divide-y divide-line rounded-xl bg-mist/60 px-4">{rows.map(([k, v, big], i) => <div key={i} className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-sm text-ink-soft">{k}</dt><dd className={`num text-right ${big ? 'font-display text-2xl font-bold' : 'font-semibold'}`}>{v}</dd></div>)}</dl>
);

function SheetPicture({ sw, sh, pw, ph, nx, ny, gap, margin }: { sw: number; sh: number; pw: number; ph: number; nx: number; ny: number; gap: number; margin: number }) {
  const s = 260 / Math.max(sw, sh);
  const ox = (sw - (nx * pw + (nx - 1) * gap)) / 2, oy = (sh - (ny * ph + (ny - 1) * gap)) / 2;
  const cells = [];
  for (let x = 0; x < Math.min(nx, 60); x++) for (let y = 0; y < Math.min(ny, 60); y++) cells.push(<rect key={`${x}-${y}`} x={(ox + x * (pw + gap)) * s} y={(oy + y * (ph + gap)) * s} width={pw * s} height={ph * s} rx={1.5} fill="#E2EFC6" stroke="#6A9A1F" strokeWidth={0.8} />);
  return <svg viewBox={`-4 -4 ${sw * s + 8} ${sh * s + 8}`} className="mx-auto h-[280px] w-auto" role="img" aria-label={`${nx} by ${ny} layout on the sheet`}><rect width={sw * s} height={sh * s} fill="#fff" stroke="#C5CEC6" /><rect x={margin * s} y={margin * s} width={(sw - 2 * margin) * s} height={(sh - 2 * margin) * s} fill="none" stroke="#C5CEC6" strokeDasharray="3 3" />{cells}</svg>;
}

export default function Calculators({ products, mats, ps }: { products: ProductLite[]; mats: Record<string, MaterialInfo>; ps: PricingSettings }) {
  const [tool, setTool] = useState<(typeof TOOLS)[number][0]>('quick');
  return (
    <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Calculators">
        {TOOLS.map(([k, t, d]) => <button key={k} type="button" onClick={() => setTool(k)} className={`shrink-0 rounded-lg px-3 py-2 text-left text-sm ${tool === k ? 'bg-ink text-white' : 'hover:bg-mist'}`} aria-pressed={tool === k}><span className="block font-semibold">{t}</span><span className={`hidden text-xs lg:block ${tool === k ? 'text-white/70' : 'text-ink-soft'}`}>{d}</span></button>)}
      </nav>
      <section className="card-pad min-w-0">
        {tool === 'quick' && <Quick products={products} mats={mats} ps={ps} />}
        {tool === 'ups' && <Ups ps={ps} />}
        {tool === 'box' && <Box ps={ps} />}
        {tool === 'laser' && <Laser ps={ps} />}
        {tool === 'paper' && <Paper />}
        {tool === 'lam' && <Lam ps={ps} />}
        {tool === 'gst' && <Gst />}
        {tool === 'margin' && <Margin />}
        {tool === 'units' && <Units />}
      </section>
    </div>
  );
}

function Quick({ products, mats, ps }: { products: ProductLite[]; mats: Record<string, MaterialInfo>; ps: PricingSettings }) {
  const [pid, setPid] = useState(products[0]?.id);
  const p = products.find((x) => x.id === pid) || products[0];
  const [spec, setSpec] = useState<Spec>({ size: 0, material: p.config.materials[0], finish: p.config.finishes[0], qty: p.config.qtyTiers[1] || p.config.minQty, sides: 1, extras: [] });
  const r = useMemo(() => price(p.model, p.config, spec, mats, ps), [p, spec, mats, ps]);
  const tiers = useMemo(() => tierPrices(p.model, p.config, spec, mats, ps), [p, spec, mats, ps]);
  const label = (c: string) => mats[c]?.name || Object.values(mats).find((m) => m.code.startsWith(c + '-'))?.name.replace(/\s*\(.*\)$/, '') || c;
  return (
    <div>
      <h2 className="text-lg font-semibold">Quick price</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-sm sm:col-span-3"><span className="label">Product</span><select className="input" value={p.id} onChange={(e) => { const np = products.find((x) => x.id === e.target.value)!; setPid(np.id); setSpec({ size: 0, material: np.config.materials[0], finish: np.config.finishes[0], qty: np.config.qtyTiers[1] || np.config.minQty, sides: 1, extras: [] }); }}>{products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="text-sm"><span className="label">Size</span><select className="input" value={String(spec.size)} onChange={(e) => setSpec({ ...spec, size: e.target.value === 'custom' ? 'custom' : Number(e.target.value), w: p.config.sizes[0].w, h: p.config.sizes[0].h, d: p.config.sizes[0].d })}>{p.config.sizes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}{p.config.custom && <option value="custom">Custom…</option>}</select></label>
        <label className="text-sm"><span className="label">Material</span><select className="input" value={spec.material} onChange={(e) => setSpec({ ...spec, material: e.target.value })}>{p.config.materials.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select></label>
        <label className="text-sm"><span className="label">Finish</span><select className="input" value={spec.finish} onChange={(e) => setSpec({ ...spec, finish: e.target.value })}>{p.config.finishes.map((f) => <option key={f} value={f}>{FINISH_LABEL[f] || f}</option>)}</select></label>
        {spec.size === 'custom' && <><N label="Width" suffix="mm" value={spec.w || 0} set={(w) => setSpec({ ...spec, w })} /><N label="Height" suffix="mm" value={spec.h || 0} set={(h) => setSpec({ ...spec, h })} />{p.config.form !== 'flat' && <N label="Depth" suffix="mm" value={spec.d || 0} set={(d) => setSpec({ ...spec, d })} />}</>}
        {p.config.sides && <label className="text-sm"><span className="label">Sides</span><select className="input" value={spec.sides} onChange={(e) => setSpec({ ...spec, sides: Number(e.target.value) as 1 | 2 })}><option value={1}>One</option><option value={2}>Both</option></select></label>}
        <N label="Quantity" value={spec.qty} set={(qty) => setSpec({ ...spec, qty: Math.floor(qty) })} step="1" />
      </div>
      {r.ok ? <>
        <Out rows={[['Per piece', rs(r.unit, r.unit < 10 ? 3 : 2), true], ['Total before GST', rs(r.total)], [`With GST ${p.gstRate}%`, rs(r.total * (1 + p.gstRate / 100))], ...(r.ups ? [['Layout', `${r.ups} per sheet · ${r.sheets} sheets`] as [string, string]] : []), ...(r.minutes ? [['Laser time', `${f1(r.minutes)} min`] as [string, string]] : [])]} />
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-soft">Breakdown</summary><ul className="mt-2 space-y-1">{r.breakdown.map((b, i) => <li key={i} className="flex justify-between gap-3"><span>{b.label}</span><span className="num">{rs(b.amount)}</span></li>)}</ul></details>
        <div className="mt-4 flex flex-wrap gap-2">{tiers.map((t) => <span key={t.qty} className="chip">{t.qty.toLocaleString('en-IN')} → {t.unit !== null ? rs(t.unit, t.unit < 10 ? 3 : 2) : '—'}</span>)}</div>
      </> : <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{r.error}</p>}
    </div>
  );
}

function Ups({ ps }: { ps: PricingSettings }) {
  const [w, setW] = useState(75), [h, setH] = useState(50), [bleed, setBleed] = useState(2), [gap, setGap] = useState(3), [qty, setQty] = useState(1000), [waste, setWaste] = useState(ps.wastePct), [margin, setMargin] = useState(ps.sheet.regMargin);
  const [sw, setSw] = useState(ps.sheet.w), [sh, setSh] = useState(ps.sheet.h);
  const pw = w + 2 * bleed, ph = h + 2 * bleed;
  const fit = fitUps(pw, ph, sw - 2 * margin, sh - 2 * margin, gap);
  const sheets = fit.n ? Math.ceil((qty / fit.n) * (1 + waste / 100)) + ps.setupSheets : 0;
  const used = fit.n ? ((fit.n * w * h) / (sw * sh)) * 100 : 0;
  return (
    <div>
      <h2 className="text-lg font-semibold">Sheet layout</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <N label="Piece width" suffix="mm" value={w} set={setW} /><N label="Piece height" suffix="mm" value={h} set={setH} /><N label="Bleed each side" suffix="mm" value={bleed} set={setBleed} /><N label="Gap" suffix="mm" value={gap} set={setGap} />
        <N label="Sheet width" suffix="mm" value={sw} set={setSw} /><N label="Sheet height" suffix="mm" value={sh} set={setSh} /><N label="Edge margin" suffix="mm" value={margin} set={setMargin} /><N label="Quantity" value={qty} set={setQty} step="1" />
        <N label="Waste" suffix="%" value={waste} set={setWaste} />
      </div>
      <div className="mt-4 grid items-center gap-4 md:grid-cols-[1fr_300px]">
        <Out rows={[['Pieces per sheet', fit.n ? `${fit.n} (${fit.nx} × ${fit.ny}${fit.rotated ? ', rotated' : ''})` : 'Does not fit', true], ['Sheets to print', fit.n ? `${sheets} (incl. ${ps.setupSheets} setup)` : '—'], ['Sheet used', `${f1(used)}%`]]} />
        {fit.n > 0 && <SheetPicture sw={sw} sh={sh} pw={fit.w} ph={fit.h} nx={fit.nx} ny={fit.ny} gap={gap} margin={margin} />}
      </div>
    </div>
  );
}

function Box({ ps }: { ps: PricingSettings }) {
  const [L, setL] = useState(60), [W, setW] = useState(60), [H, setH] = useState(60), [qty, setQty] = useState(100);
  const b = blankSize('box', { w: L, h: H, d: W });
  const fit = fitUps(b.w + 4, b.h + 4, ps.sheet.w - 2 * ps.sheet.regMargin, ps.sheet.h - 2 * ps.sheet.regMargin, 3);
  return (
    <div>
      <h2 className="text-lg font-semibold">Box blank (tuck-end)</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4"><N label="Length" suffix="mm" value={L} set={setL} /><N label="Width" suffix="mm" value={W} set={setW} /><N label="Height" suffix="mm" value={H} set={setH} /><N label="Boxes" value={qty} set={setQty} step="1" /></div>
      <Out rows={[['Flat blank', `${f1(b.w, 0)} × ${f1(b.h, 0)} mm`, true], ['Per SRA3 sheet', fit.n ? `${fit.n}${fit.rotated ? ' (rotated)' : ''}` : 'Too big for SRA3'], ['Sheets for the job', fit.n ? String(Math.ceil((qty / fit.n) * (1 + ps.wastePct / 100)) + ps.setupSheets) : '—']]} />
      <p className="mt-3 text-xs text-ink-faint">Blank = 2 × (L + W) + 15 mm glue flap, by H + 2 × W + 30 mm tuck flaps. Add 2 mm bleed each side for print.</p>
    </div>
  );
}

function Laser({ ps }: { ps: PricingSettings }) {
  const [fam, setFam] = useState<'ACR' | 'MDF' | 'PLY' | 'LTH'>('ACR');
  const [w, setW] = useState(150), [h, setH] = useState(100), [round, setRound] = useState(false), [inner, setInner] = useState(0), [engrave, setEngrave] = useState(0), [qty, setQty] = useState(10);
  const per = (round ? Math.PI * w : 2 * (w + h)) * 1.25 + inner;
  const cutMin = per / ps.laser.cutSpeed[fam];
  const engMin = engrave / ps.laser.engraveCm2PerMin;
  const mins = (cutMin + engMin) * qty;
  const cost = mins * ps.laser.perMinute + ps.laser.setup;
  return (
    <div>
      <h2 className="text-lg font-semibold">Laser time & cost</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <label className="text-sm"><span className="label">Material</span><select className="input" value={fam} onChange={(e) => setFam(e.target.value as 'ACR')}><option value="ACR">Acrylic 3 mm</option><option value="MDF">MDF 3 mm</option><option value="PLY">Plywood 3 mm</option><option value="LTH">Leather</option></select></label>
        <N label="Width" suffix="mm" value={w} set={setW} /><N label="Height" suffix="mm" value={h} set={setH} />
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={round} onChange={(e) => setRound(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Round</label>
        <N label="Extra inside cuts" suffix="mm" value={inner} set={setInner} /><N label="Engraved area" suffix="cm²" value={engrave} set={setEngrave} /><N label="Pieces" value={qty} set={setQty} step="1" />
      </div>
      <Out rows={[['Machine time', `${f1(mins)} min`, true], ['Per piece', `${f1(cutMin + engMin, 2)} min`], [`Laser cost (₹${ps.laser.perMinute}/min + ₹${ps.laser.setup} setup)`, rs(cost)], ['Per piece (laser only)', rs(cost / Math.max(1, qty))]]} />
      <p className="mt-3 text-xs text-ink-faint">Cut speeds and rates come from Pricing rates. Material cost is extra.</p>
    </div>
  );
}

function Paper() {
  const [gsm, setGsm] = useState(300), [w, setW] = useState(320), [h, setH] = useState(450), [sheets, setSheets] = useState(500), [rate, setRate] = useState(110);
  const kg = (gsm * (w / 1000) * (h / 1000) * sheets) / 1000;
  return (
    <div>
      <h2 className="text-lg font-semibold">Paper weight</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-5"><N label="GSM" value={gsm} set={setGsm} /><N label="Width" suffix="mm" value={w} set={setW} /><N label="Height" suffix="mm" value={h} set={setH} /><N label="Sheets" value={sheets} set={setSheets} step="1" /><N label="Rate" suffix="₹/kg" value={rate} set={setRate} /></div>
      <Out rows={[['Weight', `${f1(kg, 2)} kg`, true], ['One sheet', `${f1((gsm * (w / 1000) * (h / 1000)), 2)} g`], ['Cost at this rate', rs(kg * rate)], ['Cost per sheet', rs((kg * rate) / Math.max(1, sheets), 2)]]} />
    </div>
  );
}

function Lam({ ps }: { ps: PricingSettings }) {
  const [sheets, setSheets] = useState(100), [len, setLen] = useState(ps.sheet.h), [overlap, setOverlap] = useState(10), [sides, setSides] = useState(1), [roll, setRoll] = useState(200), [rollCost, setRollCost] = useState(2400);
  const m = (sheets * (len + overlap) * sides) / 1000;
  return (
    <div>
      <h2 className="text-lg font-semibold">Lamination film (380 mm roll)</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><N label="Sheets" value={sheets} set={setSheets} step="1" /><N label="Feed length per sheet" suffix="mm" value={len} set={setLen} /><N label="Gap between sheets" suffix="mm" value={overlap} set={setOverlap} /><N label="Sides" value={sides} set={setSides} step="1" /><N label="Roll length" suffix="m" value={roll} set={setRoll} /><N label="Roll cost" suffix="₹" value={rollCost} set={setRollCost} /></div>
      <Out rows={[['Film used', `${f1(m)} m`, true], ['Share of a roll', `${f1((m / Math.max(1, roll)) * 100)}%`], ['Film cost', rs((m / Math.max(1, roll)) * rollCost)], ['Per sheet', rs(((m / Math.max(1, roll)) * rollCost) / Math.max(1, sheets))]]} />
    </div>
  );
}

function Gst() {
  const [amt, setAmt] = useState(1000), [rate, setRate] = useState(18), [incl, setIncl] = useState(false), [inter, setInter] = useState(false);
  const base = incl ? amt / (1 + rate / 100) : amt, tax = base * rate / 100;
  return (
    <div>
      <h2 className="text-lg font-semibold">GST</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <N label="Amount" suffix="₹" value={amt} set={setAmt} />
        <label className="text-sm"><span className="label">Rate</span><select className="input" value={rate} onChange={(e) => setRate(Number(e.target.value))}>{[5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</select></label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={incl} onChange={(e) => setIncl(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Amount includes GST</label>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={inter} onChange={(e) => setInter(e.target.checked)} className="h-4 w-4 accent-leaf-600" />Other state (IGST)</label>
      </div>
      <Out rows={[['Taxable value', rs(base)], ...(inter ? [[`IGST ${rate}%`, rs(tax)] as [string, string]] : [[`CGST ${rate / 2}%`, rs(tax / 2)] as [string, string], [`SGST ${rate / 2}%`, rs(tax / 2)] as [string, string]]), ['Total', rs(base + tax), true]]} />
      <p className="mt-3 text-xs text-ink-faint">Boxes, cartons and paper bags (4819): 5%. Labels and tags (4821), printed matter (4911), cards (4909), plastic pouches and acrylic (3923/3926): 18%.</p>
    </div>
  );
}

function Margin() {
  const [cost, setCost] = useState(100), [sell, setSell] = useState(150), [target, setTarget] = useState(35);
  return (
    <div>
      <h2 className="text-lg font-semibold">Margin & markup</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><N label="Cost" suffix="₹" value={cost} set={setCost} /><N label="Selling price" suffix="₹" value={sell} set={setSell} /><N label="Target margin" suffix="%" value={target} set={setTarget} /></div>
      <Out rows={[['Profit', rs(sell - cost)], ['Margin (of price)', `${f1(sell ? ((sell - cost) / sell) * 100 : 0)}%`, true], ['Markup (on cost)', `${f1(cost ? ((sell - cost) / cost) * 100 : 0)}%`], [`Price for ${target}% margin`, target < 100 ? rs(cost / (1 - target / 100)) : '—']]} />
    </div>
  );
}

function Units() {
  const [mm, setMm] = useState(100);
  return (
    <div>
      <h2 className="text-lg font-semibold">Units</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <N label="Millimetres" value={mm} set={setMm} /><N label="Centimetres" value={+(mm / 10).toFixed(3)} set={(v) => setMm(v * 10)} /><N label="Inches" value={+(mm / 25.4).toFixed(4)} set={(v) => setMm(v * 25.4)} /><N label="Points" value={+(mm / 0.3528).toFixed(2)} set={(v) => setMm(v * 0.3528)} />
      </div>
      <Out rows={[['Pixels at 300 dpi', `${Math.round((mm / 25.4) * 300)} px`], ['Pixels at 150 dpi', `${Math.round((mm / 25.4) * 150)} px`], ['Bleed to add (2 mm each side)', `${f1(mm + 4)} mm`]]} />
    </div>
  );
}
