'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import ProductArt from '@/components/ProductArt';
import { FINISH_LABEL, price, type MaterialInfo, type PricingSettings, type ProductConfig } from '@/lib/pricing';
import { unitPrice } from './money';

type P = { id: string; slug: string; name: string; family: string; model: 'SHEET' | 'POUCH' | 'LASER'; shape: string; gstRate: number; leadDays: number; config: ProductConfig };
const FAMILY: Record<string, string> = { LABELS: 'Labels & stickers', PACKAGING: 'Boxes & packaging', POUCHES: 'Pouches', CARDS: 'Cards & invitations', LASER: 'Laser cut & engraved' };
const rs = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

function matName(code: string, mats: Record<string, MaterialInfo>) {
  return mats[code]?.name || Object.values(mats).find((m) => m.code.startsWith(code + '-'))?.name.replace(/\s*\(.*\)$/, '') || code;
}

/** The home page's price panel: four dropdowns, an exact price, and a link that carries the choices to the product page. */
export default function InstantPrice({ products, mats, ps }: { products: P[]; mats: Record<string, MaterialInfo>; ps: PricingSettings }) {
  const [pid, setPid] = useState(products[0]?.id);
  const p = products.find((x) => x.id === pid) || products[0];
  const cfg = p.config;
  const [size, setSize] = useState(Math.min(1, cfg.sizes.length - 1));
  const [material, setMaterial] = useState(cfg.materials[0]);
  const [finish, setFinish] = useState(cfg.finishes[0]);
  const [qty, setQty] = useState(cfg.qtyTiers[Math.min(2, cfg.qtyTiers.length - 1)]);
  const choose = (id: string) => {
    const n = products.find((x) => x.id === id)!;
    setPid(id); setSize(Math.min(1, n.config.sizes.length - 1)); setMaterial(n.config.materials[0]); setFinish(n.config.finishes[0]); setQty(n.config.qtyTiers[Math.min(2, n.config.qtyTiers.length - 1)]);
  };
  const r = useMemo(() => price(p.model, cfg, { size, material, finish, qty, sides: 1, extras: [] }, mats, ps), [p, cfg, size, material, finish, qty, mats, ps]);
  const tiers = useMemo(() => cfg.qtyTiers.map((q) => { const t = price(p.model, cfg, { size, material, finish, qty: q, sides: 1, extras: [] }, mats, ps); return { q, unit: t.ok ? t.unit : null }; }), [p, cfg, size, material, finish, mats, ps]);
  const s = cfg.sizes[size];
  const href = `/p/${p.slug}?size=${size}&material=${encodeURIComponent(material)}&finish=${finish}&qty=${qty}`;
  const sel = 'input font-medium';
  return (
    <div className="swoosh-frame shadow-lift">
      <div className="rounded-[20px] bg-white p-5 sm:p-6">
        <h2 className="text-xl">Price your print</h2>
        <p className="mt-1 text-sm text-ink-soft">Pick the options. The price is exact, before GST.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2"><span className="label">Product</span>
            <select className={sel} value={p.id} onChange={(e) => choose(e.target.value)}>
              {Object.entries(FAMILY).map(([f, l]) => <optgroup key={f} label={l}>{products.filter((x) => x.family === f).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>)}
            </select></label>
          <label className="text-sm"><span className="label">Size</span><select className={sel} value={size} onChange={(e) => setSize(Number(e.target.value))}>{cfg.sizes.map((z, i) => <option key={i} value={i}>{z.label}</option>)}</select></label>
          <label className="text-sm"><span className="label">Material</span><select className={sel} value={material} onChange={(e) => setMaterial(e.target.value)}>{cfg.materials.map((c) => <option key={c} value={c}>{matName(c, mats)}</option>)}</select></label>
          {cfg.finishes.length > 1 && <label className="text-sm"><span className="label">Finish</span><select className={sel} value={finish} onChange={(e) => setFinish(e.target.value)}>{cfg.finishes.map((f) => <option key={f} value={f}>{FINISH_LABEL[f] || f}</option>)}</select></label>}
          <label className={`text-sm ${cfg.finishes.length > 1 ? '' : 'sm:col-span-2'}`}><span className="label">Quantity</span>
            <select className={sel} value={qty} onChange={(e) => setQty(Number(e.target.value))}>{tiers.map((t) => <option key={t.q} value={t.q}>{t.q.toLocaleString('en-IN')} pieces{t.unit !== null ? `, ${unitPrice(t.unit)} each` : ''}</option>)}</select></label>
        </div>
        <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-4 border-t border-line pt-5" aria-live="polite">
          <div className="aspect-square rounded-xl bg-paper"><ProductArt shape={p.shape} colour={mats[material]?.colour || '#fff'} w={s.w} h={s.h} d={s.d} round={s.round} white={mats[material]?.needsWhite} className="h-full w-full" label={p.name} /></div>
          {r.ok ? (
            <div>
              <p className="num text-[2.5rem] font-extrabold leading-none tracking-tight">{unitPrice(r.unit)}<span className="ml-1 text-base font-medium text-ink-soft">a piece</span></p>
              <p className="num mt-2 text-sm text-ink-soft">{qty.toLocaleString('en-IN')} pieces for {rs(r.total)} + {p.gstRate}% GST. Ready {p.leadDays}–{p.leadDays + 1} working days after you approve the proof.</p>
            </div>
          ) : <p className="text-sm text-amber-800">{r.error}</p>}
        </div>
        <Link href={href} className="btn-primary btn-lg mt-5 w-full">Continue with these options</Link>
      </div>
    </div>
  );
}
