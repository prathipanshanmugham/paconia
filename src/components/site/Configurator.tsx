'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ProductArt from '@/components/ProductArt';
import { FINISH_LABEL, price, tierPrices, type MaterialInfo, type PricingSettings, type ProductConfig, type Spec } from '@/lib/pricing';
import { addToCart } from '@/app/actions/shop';
import { unitPrice } from './money';

type Opt = { code: string; name: string; colour: string; white: boolean; available: boolean };
type Prod = { id: string; slug: string; name: string; tagline: string; description: string; model: 'SHEET' | 'POUCH' | 'LASER'; shape: string; hsn: string; gstRate: number; leadDays: number };
type Uploaded = { id: string; name: string; size: number; preview?: string };
export type Initial = { size?: number | 'custom'; material?: string; finish?: string; qty?: number };

const rs = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Configurator({ product, cfg, mats, ps, options, initial = {} }: { product: Prod; cfg: ProductConfig; mats: Record<string, MaterialInfo>; ps: PricingSettings; options: Opt[]; initial?: Initial }) {
  const router = useRouter();
  const okMat = (c?: string) => (c && options.some((o) => o.code === c && o.available) ? c : undefined);
  const [size, setSize] = useState<number | 'custom'>(initial.size !== undefined && (initial.size === 'custom' ? cfg.custom : cfg.sizes[initial.size]) ? initial.size : Math.min(1, cfg.sizes.length - 1));
  const [custom, setCustom] = useState({ w: cfg.sizes[0].w, h: cfg.sizes[0].h, d: cfg.sizes[0].d ?? 40 });
  const [material, setMaterial] = useState(okMat(initial.material) || options.find((o) => o.available)?.code || cfg.materials[0]);
  const [finish, setFinish] = useState(initial.finish && cfg.finishes.includes(initial.finish) ? initial.finish : cfg.finishes[0]);
  const [sides, setSides] = useState<1 | 2>(1);
  const [extras, setExtras] = useState<string[]>([]);
  const startQty = initial.qty && initial.qty >= cfg.minQty ? initial.qty : cfg.qtyTiers[Math.min(1, cfg.qtyTiers.length - 1)];
  const [qty, setQty] = useState<number>(startQty);
  const [otherQty, setOtherQty] = useState(!cfg.qtyTiers.includes(startQty));
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [pending, start] = useTransition();

  const spec: Spec = useMemo(() => ({
    size, material, finish, qty, sides: cfg.sides ? sides : 1, extras,
    ...(size === 'custom' ? { w: Number(custom.w), h: Number(custom.h), d: cfg.form === 'flat' ? undefined : Number(custom.d) } : {}),
  }), [size, material, finish, qty, sides, extras, custom, cfg]);
  const r = useMemo(() => price(product.model, cfg, spec, mats, ps), [product.model, cfg, spec, mats, ps]);
  const tiers = useMemo(() => tierPrices(product.model, cfg, { ...spec, qty: cfg.qtyTiers[0] }, mats, ps), [product.model, cfg, spec, mats, ps]);
  const opt = options.find((o) => o.code === material);
  const dims = size === 'custom' ? custom : cfg.sizes[size];
  const logo = files.find((f) => f.preview)?.preview || null;
  const gst = r.ok ? (r.total * product.gstRate) / 100 : 0;

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true); setError(null);
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append('files', f));
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      const previews = Array.from(list).map((f) => (/^image\/(png|jpe?g|svg\+xml|webp)$/.test(f.type) ? URL.createObjectURL(f) : undefined));
      setFiles((prev) => [...prev, ...data.files.map((x: Uploaded, i: number) => ({ ...x, preview: previews[i] }))]);
      if (data.errors?.length) setError(data.errors.join(' '));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function add() {
    setError(null);
    if (!r.ok) { setError(r.error); return; }
    start(async () => {
      const res = await addToCart(product.id, spec, files.map((f) => f.id), notes);
      if (res?.error) setError(res.error);
      else router.push('/cart');
    });
  }

  const priceBlock = r.ok ? (
    <>
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm text-ink-soft">Price a piece</p><p className="num text-[2.6rem] font-extrabold leading-none tracking-tight">{unitPrice(r.unit)}</p></div>
        <p className="num text-right text-sm text-ink-soft"><b className="text-ink">{qty.toLocaleString('en-IN')}</b> pieces<br />ready in {product.leadDays}–{product.leadDays + 1} working days</p>
      </div>
      <div className="num mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><span>Price</span><span>{rs(r.total)}</span></div>
        <div className="flex justify-between text-ink-soft"><span>GST {product.gstRate}%</span><span>{rs2(gst)}</span></div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span>{rs2(r.total + gst)}</span></div>
      </div>
      <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="mt-2 text-sm text-sky-700 underline underline-offset-2" aria-expanded={showBreakdown}>{showBreakdown ? 'Hide' : 'See'} how the price is made</button>
      {showBreakdown && <ul className="num mt-2 space-y-1 rounded-xl bg-paper p-3 text-xs text-ink-soft">{r.breakdown.map((b, i) => <li key={i} className="flex justify-between gap-3"><span>{b.label}</span><span>{rs2(b.amount)}</span></li>)}</ul>}
    </>
  ) : <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{r.error}</p>;

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_1fr] lg:pb-0">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-5 lg:hidden"><h1 className="text-3xl">{product.name}</h1><p className="mt-2 text-ink-soft">{product.description}</p></div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="aspect-[4/3] bg-paper">
            <ProductArt shape={product.shape} colour={opt?.colour} w={dims.w} h={dims.h} d={'d' in dims ? dims.d : undefined} round={size !== 'custom' && cfg.sizes[size]?.round} logo={logo} white={opt?.white} dims={cfg.form !== 'flat'} className="h-full w-full" label={`${product.name} preview`} />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-sm text-ink-soft"><span className="num whitespace-nowrap font-semibold text-ink">{dims.w} × {dims.h}{cfg.form !== 'flat' && 'd' in dims ? ` × ${dims.d}` : ''} mm</span>. A preview only; you approve a proof before we print.</p>
        </div>
        <div className="mt-4 hidden rounded-2xl border border-line bg-white p-5 lg:block" aria-live="polite">
          {priceBlock}
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="button" onClick={add} disabled={!r.ok || pending || uploading} className="btn-primary btn-lg mt-4 w-full">{pending ? 'Adding…' : 'Add to cart'}</button>
          {!files.length && <p className="mt-2 text-center text-xs text-ink-faint">You can add it now and send the artwork later.</p>}
        </div>
      </div>

      <div>
        <div className="hidden lg:block"><h1 className="text-[2.4rem] leading-tight">{product.name}</h1><p className="mt-2 text-lg text-ink-soft">{product.description}</p></div>

        <div className="mt-7 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-sm sm:col-span-2"><span className="label">Size</span>
            <select className="input" value={String(size)} onChange={(e) => setSize(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}>
              {cfg.sizes.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
              {cfg.custom && <option value="custom">Custom size (enter your own)</option>}
            </select></label>
          {size === 'custom' && cfg.custom && (
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              {([['w', cfg.form === 'flat' ? 'Width' : 'Length'], ['h', 'Height'], ...(cfg.form !== 'flat' ? [['d', cfg.form === 'box' ? 'Depth' : 'Pack depth']] : [])] as [keyof typeof custom, string][]).map(([k, l]) => (
                <label key={k} className="text-sm"><span className="label">{l} (mm)</span><input type="number" inputMode="numeric" min={1} className="input" value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: Number(e.target.value) })} /></label>
              ))}
            </div>
          )}
          <label className="text-sm sm:col-span-2"><span className="label">Material</span>
            <select className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>
              {options.map((o) => <option key={o.code} value={o.code} disabled={!o.available}>{o.name}{o.white ? ', printed with white ink underneath' : ''}{!o.available ? ' (out of stock)' : ''}</option>)}
            </select></label>
          {cfg.finishes.length > 1 && <label className="text-sm"><span className="label">Finish</span><select className="input" value={finish} onChange={(e) => setFinish(e.target.value)}>{cfg.finishes.map((f) => <option key={f} value={f}>{FINISH_LABEL[f] || f}</option>)}</select></label>}
          {cfg.sides && <label className="text-sm"><span className="label">Printing</span><select className="input" value={sides} onChange={(e) => setSides(Number(e.target.value) as 1 | 2)}><option value={1}>One side</option><option value={2}>Both sides</option></select></label>}
          <label className={`text-sm ${cfg.finishes.length > 1 && cfg.sides ? 'sm:col-span-2' : cfg.finishes.length > 1 || cfg.sides ? '' : 'sm:col-span-2'}`}><span className="label">Quantity</span>
            <select className="input" value={otherQty ? 'other' : qty} onChange={(e) => { if (e.target.value === 'other') { setOtherQty(true); } else { setOtherQty(false); setQty(Number(e.target.value)); } }}>
              {tiers.map((t) => <option key={t.qty} value={t.qty}>{t.qty.toLocaleString('en-IN')} pieces{t.unit !== null ? `, ${unitPrice(t.unit)} each` : ''}</option>)}
              <option value="other">Another quantity…</option>
            </select></label>
          {otherQty && <label className="text-sm sm:col-span-2"><span className="label">How many pieces? <span className="font-normal text-ink-faint">(at least {cfg.minQty})</span></span><input type="number" inputMode="numeric" min={cfg.minQty} className="input" value={qty} onChange={(e) => { const n = Math.floor(Number(e.target.value)); if (n > 0) setQty(n); }} /></label>}
          {cfg.extras?.length ? (
            <fieldset className="sm:col-span-2"><legend className="label">Add-ons <span className="font-normal text-ink-faint">(optional)</span></legend>
              <div className="grid gap-2 sm:grid-cols-2">{cfg.extras.map((e) => {
                const on = extras.includes(e.code);
                return <label key={e.code} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${on ? 'border-sky-500 bg-sky-50' : 'border-line-strong'}`}><input type="checkbox" className="check" checked={on} onChange={() => setExtras(on ? extras.filter((x) => x !== e.code) : [...extras, e.code])} /><span className="flex-1">{e.label}</span><span className="num text-ink-soft">{rs2(e.price)}{e.per === 'piece' ? ' each' : ''}</span></label>;
              })}</div></fieldset>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg">Your artwork</h2>
          <p className="mt-1 text-sm text-ink-soft">PDF, AI, EPS, PSD, CDR, PNG or JPG, up to 40 MB. A phone photo of your logo is fine; our designer prepares the file and sends a proof.</p>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-dashed border-line-strong bg-paper px-4 py-4 hover:border-sky-400">
            <span className="text-[15px] font-semibold">{uploading ? 'Uploading…' : files.length ? 'Add more files' : 'Choose files to upload'}</span>
            <span className="btn-secondary btn-sm pointer-events-none">Browse</span>
            <input type="file" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} accept=".pdf,.ai,.eps,.psd,.cdr,.svg,.png,.jpg,.jpeg,.tif,.tiff,.webp,.zip" />
          </label>
          {files.length > 0 && <ul className="mt-3 space-y-1.5 text-sm">{files.map((f) => <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2"><span className="truncate">{f.name}</span><button type="button" className="text-sm text-rose-700 hover:underline" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>Remove</button></li>)}</ul>}
          <label className="mt-4 block text-sm"><span className="label">Notes for our designer <span className="font-normal text-ink-faint">(optional)</span></span>
            <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={800} placeholder="Example: match our green, Pantone 7739 C. Text: Cold-pressed groundnut oil, 1 litre." /></label>
        </div>
        <p className="mt-4 text-sm text-ink-faint">HSN {product.hsn}. GST {product.gstRate}% is added at checkout.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-lift backdrop-blur lg:hidden">
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{error}</p>}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            {r.ok ? <><p className="num text-xl font-extrabold leading-tight">{unitPrice(r.unit)} <span className="text-xs font-medium text-ink-soft">a piece</span></p><p className="num text-xs text-ink-soft">{qty.toLocaleString('en-IN')} pieces, {rs2(r.total + gst)} with GST</p></> : <p className="text-xs text-amber-800">{r.error}</p>}
          </div>
          <button type="button" onClick={add} disabled={!r.ok || pending || uploading} className="btn-primary shrink-0">{pending ? 'Adding…' : 'Add to cart'}</button>
        </div>
      </div>
    </div>
  );
}
