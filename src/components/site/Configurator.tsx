'use client';
import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ProductArt from '@/components/ProductArt';
import { FINISH_LABEL, price, tierPrices, type MaterialInfo, type PricingSettings, type ProductConfig, type Spec } from '@/lib/pricing';
import { addToCart } from '@/app/actions/shop';
import { unitPrice } from './money';

type Opt = { code: string; name: string; colour: string; white: boolean; available: boolean };
type Prod = { id: string; slug: string; name: string; tagline: string; description: string; model: 'SHEET' | 'POUCH' | 'LASER'; shape: string; hsn: string; gstRate: number; leadDays: number };
type Uploaded = { id: string; name: string; size: number; preview?: string };

const rs = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const rs2 = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Configurator({ product, cfg, mats, ps, options }: { product: Prod; cfg: ProductConfig; mats: Record<string, MaterialInfo>; ps: PricingSettings; options: Opt[] }) {
  const router = useRouter();
  const firstOk = options.find((o) => o.available)?.code || cfg.materials[0];
  const defFinish = cfg.finishes[0];
  const defTier = cfg.qtyTiers[Math.min(1, cfg.qtyTiers.length - 1)];
  const [size, setSize] = useState<number | 'custom'>(Math.min(1, cfg.sizes.length - 1));
  const [custom, setCustom] = useState({ w: cfg.sizes[0].w, h: cfg.sizes[0].h, d: cfg.sizes[0].d ?? 40 });
  const [material, setMaterial] = useState(firstOk);
  const [finish, setFinish] = useState(defFinish);
  const [sides, setSides] = useState<1 | 2>(1);
  const [extras, setExtras] = useState<string[]>([]);
  const [qty, setQty] = useState<number>(defTier);
  const [qtyText, setQtyText] = useState(String(defTier));
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
  const gst = r.ok ? r.total * product.gstRate / 100 : 0;

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

  const hasFinish = cfg.finishes.length > 1 || !!cfg.sides;
  const hasExtras = !!cfg.extras?.length;
  const nFinish = 3, nExtras = hasFinish ? 4 : 3, nQty = 3 + (hasFinish ? 1 : 0) + (hasExtras ? 1 : 0), nArt = nQty + 1;

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[1fr_1.05fr] lg:pb-0">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 lg:hidden"><h1 className="text-3xl font-bold">{product.name}</h1><p className="mt-2 text-ink-soft">{product.description}</p></div>
        <div className="card overflow-hidden">
          <div className="aspect-[4/3] bg-[linear-gradient(#EEF1EC_1px,transparent_1px),linear-gradient(90deg,#EEF1EC_1px,transparent_1px)] bg-[size:22px_22px]">
            <ProductArt shape={product.shape} colour={opt?.colour} w={dims.w} h={dims.h} d={'d' in dims ? dims.d : undefined} round={size !== 'custom' && cfg.sizes[size]?.round} logo={logo} white={opt?.white} dims={cfg.form !== 'flat'} className="h-full w-full" label={`${product.name} preview`} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-xs text-ink-soft">
            <span className="mono whitespace-nowrap">{dims.w} × {dims.h}{cfg.form !== 'flat' && 'd' in dims ? ` × ${dims.d}` : ''} mm</span>
            <span>Preview only · you approve a proof before printing</span>
          </div>
        </div>
        <div className="card mt-4 hidden p-5 lg:block" aria-live="polite">
          {r.ok ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div><div className="text-xs text-ink-soft">Price per piece</div><div className="num font-display text-4xl font-bold">{unitPrice(r.unit)}</div></div>
                <div className="text-right text-sm text-ink-soft"><span className="num font-semibold text-ink">{qty.toLocaleString('en-IN')}</span> pieces<br />ready in {product.leadDays}–{product.leadDays + 1} working days</div>
              </div>
              <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm num">
                <div className="flex justify-between"><span>Subtotal</span><span>{rs(r.total)}</span></div>
                <div className="flex justify-between text-ink-soft"><span>GST {product.gstRate}% <span className="text-xs">(HSN {product.hsn})</span></span><span>{rs2(gst)}</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span>{rs2(r.total + gst)}</span></div>
              </div>
              <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="mt-2 text-xs text-ink-soft underline underline-offset-2">{showBreakdown ? 'Hide' : 'Show'} how this is priced</button>
              {showBreakdown && <ul className="mt-2 space-y-1 rounded-lg bg-mist/60 p-3 text-xs text-ink-soft num">{r.breakdown.map((b, i) => <li key={i} className="flex justify-between gap-3"><span>{b.label}</span><span>{rs2(b.amount)}</span></li>)}{r.ups ? <li className="pt-1 text-ink-faint">{r.ups} per {product.model === 'LASER' ? 'sheet' : 'SRA3 sheet'}{r.white ? ' · white ink underbase' : ''}</li> : null}</ul>}
            </>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{r.error}</p>
          )}
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <button type="button" onClick={add} disabled={!r.ok || pending || uploading} className="btn-primary btn-lg mt-4 w-full">{pending ? 'Adding…' : 'Add to cart'}</button>
          {!files.length && <p className="mt-2 text-center text-xs text-ink-faint">You can add to cart now and send artwork later.</p>}
        </div>
      </div>

      <div>
        <div className="hidden lg:block"><h1 className="text-3xl font-bold sm:text-4xl">{product.name}</h1>
        <p className="mt-2 text-ink-soft">{product.description}</p></div>

        <section className="mt-7 border-t border-line pt-6">
          <Step n={1} title="Size" hint={cfg.custom ? 'or enter your own' : undefined} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cfg.sizes.map((s, i) => (
              <button key={i} type="button" onClick={() => setSize(i)} className={`opt ${size === i ? 'opt-on' : ''}`} aria-pressed={size === i}>
                <span className="font-semibold">{s.label}</span>
              </button>
            ))}
            {cfg.custom && <button type="button" onClick={() => setSize('custom')} className={`opt ${size === 'custom' ? 'opt-on' : ''}`} aria-pressed={size === 'custom'}><span className="font-semibold">Custom size</span><span className="text-xs text-ink-soft">your own mm</span></button>}
          </div>
          {size === 'custom' && cfg.custom && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {([['w', cfg.form === 'flat' ? 'Width' : 'Length'], ['h', 'Height'], ...(cfg.form !== 'flat' ? [['d', cfg.form === 'box' ? 'Depth' : 'Pack depth']] : [])] as [keyof typeof custom, string][]).map(([k, l]) => (
                <label key={k} className="text-sm"><span className="label">{l} (mm)</span>
                  <input type="number" inputMode="numeric" min={1} className="input" value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: Number(e.target.value) })} /></label>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 border-t border-line pt-6">
          <Step n={2} title="Material" />
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map((o) => (
              <button key={o.code} type="button" disabled={!o.available} onClick={() => setMaterial(o.code)} className={`opt flex-row items-center gap-3 ${material === o.code ? 'opt-on' : ''} disabled:opacity-40`} aria-pressed={material === o.code}>
                <span className="h-7 w-7 shrink-0 rounded-md border border-line-strong" style={{ background: o.colour }} />
                <span className="min-w-0"><span className="block font-semibold">{o.name}</span><span className="block text-xs text-ink-soft">{!o.available ? 'Out of stock' : o.white ? 'White ink printed under the colour' : 'Full colour'}</span></span>
              </button>
            ))}
          </div>
        </section>

        {hasFinish && (
          <section className="mt-6 border-t border-line pt-6">
            <Step n={nFinish} title="Finish" />
            {cfg.finishes.length > 1 && <div className="flex flex-wrap gap-2">{cfg.finishes.map((f) => <button key={f} type="button" onClick={() => setFinish(f)} className={`chip ${finish === f ? 'chip-on' : ''}`} aria-pressed={finish === f}>{FINISH_LABEL[f] || f}</button>)}</div>}
            {cfg.sides && <div className="mt-3 flex flex-wrap gap-2">{([1, 2] as const).map((n) => <button key={n} type="button" onClick={() => setSides(n)} className={`chip ${sides === n ? 'chip-on' : ''}`} aria-pressed={sides === n}>{n === 1 ? 'Printed one side' : 'Printed both sides'}</button>)}</div>}
          </section>
        )}

        {hasExtras && cfg.extras ? (
          <section className="mt-6 border-t border-line pt-6">
            <Step n={nExtras} title="Add-ons" hint="optional" />
            <div className="flex flex-wrap gap-2">
              {cfg.extras.map((e) => {
                const on = extras.includes(e.code);
                return <button key={e.code} type="button" onClick={() => setExtras(on ? extras.filter((x) => x !== e.code) : [...extras, e.code])} className={`chip ${on ? 'chip-on' : ''}`} aria-pressed={on}>{on ? '✓ ' : '+ '}{e.label} · {rs2(e.price)}{e.per === 'piece' ? '/pc' : ''}</button>;
              })}
            </div>
          </section>
        ) : null}

        <section className="mt-6 border-t border-line pt-6">
          <Step n={nQty} title="Quantity" hint={`minimum ${cfg.minQty}`} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tiers.map((t) => (
              <button key={t.qty} type="button" onClick={() => { setQty(t.qty); setQtyText(String(t.qty)); }} className={`opt ${qty === t.qty ? 'opt-on' : ''}`} aria-pressed={qty === t.qty}>
                <span className="num font-semibold">{t.qty.toLocaleString('en-IN')} pcs</span>
                <span className="num text-xs text-ink-soft">{t.unit !== null ? `${unitPrice(t.unit)} each` : '—'}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><span className="text-ink-soft">Other quantity</span>
            <input type="number" inputMode="numeric" min={cfg.minQty} className="input w-32" value={qtyText} onChange={(e) => { setQtyText(e.target.value); const n = Math.floor(Number(e.target.value)); if (n > 0) setQty(n); }} />
          </label>
        </section>

        <section className="mt-6 border-t border-line pt-6">
          <Step n={nArt} title="Artwork" hint="PDF, AI, EPS, PSD, PNG, JPG · up to 40 MB" />
          <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-line-strong bg-white p-4 hover:border-ink-faint">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-mist text-xl">↑</span>
            <span className="min-w-0 flex-1"><b>{uploading ? 'Uploading…' : files.length ? 'Add more files' : 'Upload your artwork'}</b><br /><span className="text-sm text-ink-soft">Image files show on the preview straight away.</span></span>
            <input type="file" multiple className="sr-only" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} accept=".pdf,.ai,.eps,.psd,.cdr,.svg,.png,.jpg,.jpeg,.tif,.tiff,.webp,.zip" />
          </label>
          {files.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist/60 px-3 py-2">
                  <span className="truncate">{f.name}</span>
                  <button type="button" className="text-xs text-rose-700 hover:underline" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-4 block text-sm"><span className="label">Notes for our designer <span className="font-normal text-ink-faint">(optional)</span></span>
            <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={800} placeholder="e.g. Match our brand green Pantone 7739 C. Text should read: Cold-pressed groundnut oil, 1 litre." />
          </label>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-lift backdrop-blur lg:hidden">
        {error && <p role="alert" className="mb-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{error}</p>}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1" aria-live="polite">
            {r.ok ? <><div className="num font-display text-xl font-bold leading-tight">{unitPrice(r.unit)} <span className="text-xs font-normal text-ink-soft">/ piece</span></div>
              <div className="num text-xs text-ink-soft">{qty.toLocaleString('en-IN')} pcs · {rs2(r.total + gst)} incl. GST</div></>
              : <div className="text-xs text-amber-800">{r.error}</div>}
          </div>
          <button type="button" onClick={add} disabled={!r.ok || pending || uploading} className="btn-primary shrink-0">{pending ? 'Adding…' : 'Add to cart'}</button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, hint }: { n: number; title: string; hint?: ReactNode }) {
  return <div className="mb-3 flex items-baseline gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{n}</span><h2 className="text-base font-semibold">{title}</h2>{hint && <span className="ml-auto text-xs text-ink-faint">{hint}</span>}</div>;
}
