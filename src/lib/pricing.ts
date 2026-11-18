/**
 * Paconia pricing engine. Pure functions, no database access, used by the shop, the desk (counter orders,
 * quotes) and the calculators, so every price in the app comes from one place.
 *
 * Phase 1 machines it models:
 *  - OKI Pro 9542: SRA3 (320 × 450 mm) CMYK + White toner. White is laid under colour on clear, kraft, metallic and dark media.
 *  - Toyocut B13: sheet-fed kiss-cut (labels on liner) and through-cut (stickers, tags, boxes), needs registration marks.
 *  - Guillotine: straight cuts for cards.  - Thermal laminator: gloss / matte / soft-touch.
 *  - CO2 laser: cuts and engraves acrylic, MDF, ply and leather.
 */

export type Size = { label: string; w: number; h: number; d?: number; code?: string; f?: number; round?: boolean };
export type Extra = { code: string; label: string; price: number; per: 'piece' | 'job'; material?: string; cost?: number };
export type CutType = 'kiss' | 'through' | 'guillotine' | 'laser' | 'none';
export type Form = 'flat' | 'box' | 'sleeve';

export type ProductConfig = {
  sizes: Size[];
  custom?: { minW: number; maxW: number; minH: number; maxH: number; minD?: number; maxD?: number } | null;
  materials: string[];
  finishes: string[];
  sides?: boolean;
  cut: CutType;
  form: Form;
  bleed: number;
  gap: number;
  qtyTiers: number[];
  minQty: number;
  extras?: Extra[];
};

export type Spec = {
  size: number | 'custom';
  w?: number; h?: number; d?: number;
  material: string;
  finish: string;
  sides?: 1 | 2;
  extras?: string[];
  qty: number;
};

export type MaterialInfo = {
  code: string; name: string; price: number; cost?: number; uom: string;
  sheetW?: number | null; sheetH?: number | null; needsWhite: boolean; colour?: string | null;
};

export type PricingSettings = {
  sheet: { w: number; h: number; margin: number; regMargin: number };
  clicks: { cmyk: number; white: number };
  lam: { gloss: number; matte: number; soft: number };
  cut: { kiss: number; through: number; guillotine: number; crease: number };
  laser: { perMinute: number; engraveCm2PerMin: number; engraveFill: number; setup: number; cutSpeed: Record<string, number> };
  pouch: { print: number; white: number; setup: number; wastePct: number };
  setupFee: number;
  setupSheets: number;
  wastePct: number;
  minLine: number;
  /** What each step really costs the studio (toner, drum, film, blades, power, labour). Margin = selling price − cost. */
  costs: {
    clickCmyk: number; clickWhite: number;
    lam: { gloss: number; matte: number; soft: number };
    cut: { kiss: number; through: number; guillotine: number; crease: number };
    laserPerMinute: number; pouchPrint: number; pouchWhite: number; setup: number;
  };
  /** Margin the quote builder aims for, and the level below which it warns. Percent of the selling price. */
  targetMargin: number;
  minMargin: number;
};

export const DEFAULT_PRICING: PricingSettings = {
  sheet: { w: 320, h: 450, margin: 5, regMargin: 12 },
  clicks: { cmyk: 12, white: 10 },
  lam: { gloss: 6, matte: 6, soft: 14 },
  cut: { kiss: 6, through: 8, guillotine: 2, crease: 4 },
  laser: { perMinute: 18, engraveCm2PerMin: 6, engraveFill: 0.12, setup: 150, cutSpeed: { ACR: 900, MDF: 1200, PLY: 1000, LTH: 1500 } },
  pouch: { print: 9, white: 7, setup: 250, wastePct: 3 },
  setupFee: 150,
  setupSheets: 2,
  wastePct: 4,
  minLine: 300,
  costs: {
    clickCmyk: 6.5, clickWhite: 6,
    lam: { gloss: 3, matte: 3, soft: 8 },
    cut: { kiss: 2, through: 3, guillotine: 0.5, crease: 1.5 },
    laserPerMinute: 7, pouchPrint: 4.5, pouchWhite: 3.5, setup: 60,
  },
  targetMargin: 35,
  minMargin: 20,
};

export const FINISH_LABEL: Record<string, string> = {
  none: 'No lamination', gloss: 'Gloss lamination', matte: 'Matte lamination', soft: 'Soft-touch lamination',
  cut: 'Cut only', engrave: 'Engraved + cut',
};

export type PriceLine = { label: string; amount: number };
export type PriceOk = {
  ok: true;
  qty: number; unit: number; total: number;
  dims: { w: number; h: number; d?: number };
  piece: { w: number; h: number };
  ups?: number; sheets?: number; minutes?: number;
  white: boolean;
  breakdown: PriceLine[];
  /** Studio cost of the job (materials at cost + process costs). Never shown to customers. */
  cost: number;
  costLines: PriceLine[];
  materials: { code: string; qty: number }[];
  summary: string;
  route: Stage[];
};
export type PriceErr = { ok: false; error: string };
export type PriceResult = PriceOk | PriceErr;
export type Stage = 'PREPRESS' | 'PRINT' | 'CUT' | 'FINISH' | 'PACK';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function resolveDims(cfg: ProductConfig, spec: Spec): { w: number; h: number; d?: number } | null {
  if (spec.size === 'custom') {
    if (!cfg.custom) return null;
    const w = Number(spec.w), h = Number(spec.h), d = spec.d !== undefined ? Number(spec.d) : undefined;
    if (!(w > 0 && h > 0)) return null;
    return { w, h, d: cfg.form === 'flat' ? undefined : d };
  }
  const s = cfg.sizes[spec.size];
  return s ? { w: s.w, h: s.h, d: s.d } : null;
}

/** Flat blank size before bleed. Box = tuck-end carton (L = w, W = d, H = h). Sleeve wraps a pack of w × d with band height h. */
export function blankSize(form: Form, dims: { w: number; h: number; d?: number }) {
  if (form === 'box') {
    const L = dims.w, W = dims.d || 50, H = dims.h;
    return { w: 2 * (L + W) + 15, h: H + 2 * W + 30 };
  }
  if (form === 'sleeve') {
    const L = dims.w, D = dims.d || 20;
    return { w: 2 * (L + D) + 12, h: dims.h };
  }
  return { w: dims.w, h: dims.h };
}

export function fitUps(pw: number, ph: number, areaW: number, areaH: number, gap: number) {
  const grid = (w: number, h: number) => {
    const nx = Math.floor((areaW + gap) / (w + gap));
    const ny = Math.floor((areaH + gap) / (h + gap));
    return { n: Math.max(0, nx) * Math.max(0, ny), nx: Math.max(0, nx), ny: Math.max(0, ny), w, h };
  };
  const a = grid(pw, ph), b = grid(ph, pw);
  return b.n > a.n ? { ...b, rotated: true } : { ...a, rotated: false };
}

function extrasCost(cfg: ProductConfig, spec: Spec, qty: number) {
  const out: PriceLine[] = [];
  for (const code of spec.extras || []) {
    const e = cfg.extras?.find((x) => x.code === code);
    if (!e) continue;
    out.push({ label: e.label, amount: r2(e.per === 'piece' ? e.price * qty : e.price) });
  }
  return out;
}

function extrasCostPrice(cfg: ProductConfig, spec: Spec, qty: number, mats: Record<string, MaterialInfo>) {
  const out: PriceLine[] = [];
  for (const code of spec.extras || []) {
    const e = cfg.extras?.find((x) => x.code === code);
    if (!e) continue;
    const unit = e.cost ?? (e.material && mats[e.material]?.cost !== undefined ? mats[e.material].cost! : e.price * 0.5);
    out.push({ label: e.label, amount: r2(e.per === 'piece' ? unit * qty : unit) });
  }
  return out;
}
const costOf = (m: MaterialInfo) => (m.cost !== undefined && m.cost !== null ? m.cost : m.price * 0.7);
const sum = (l: PriceLine[]) => r2(l.reduce((a, x) => a + x.amount, 0));

function extraMaterials(cfg: ProductConfig, spec: Spec, qty: number) {
  const out: { code: string; qty: number }[] = [];
  for (const code of spec.extras || []) {
    const e = cfg.extras?.find((x) => x.code === code);
    if (e?.material) out.push({ code: e.material, qty: e.per === 'piece' ? qty : 1 });
  }
  return out;
}

function routeFor(cfg: ProductConfig, spec: Spec, model: 'SHEET' | 'POUCH' | 'LASER'): Stage[] {
  if (model === 'POUCH') return ['PREPRESS', 'PRINT', 'PACK'];
  if (model === 'LASER') return (spec.extras?.length ? ['PREPRESS', 'CUT', 'FINISH', 'PACK'] : ['PREPRESS', 'CUT', 'PACK']);
  const needsFinish = cfg.form !== 'flat' || (spec.extras?.length || 0) > 0;
  return ['PREPRESS', 'PRINT', ...(cfg.cut !== 'none' ? (['CUT'] as Stage[]) : []), ...(needsFinish ? (['FINISH'] as Stage[]) : []), 'PACK'];
}

export function validateSpec(cfg: ProductConfig, spec: Spec): string | null {
  if (!Number.isInteger(spec.qty) || spec.qty < 1) return 'Enter a quantity of at least 1';
  if (spec.qty < cfg.minQty) return `Minimum order is ${cfg.minQty} pieces`;
  if (spec.qty > 200000) return 'For more than 2,00,000 pieces, please ask for a quote';
  if (!cfg.materials.includes(spec.material)) return 'Choose a material';
  if (!cfg.finishes.includes(spec.finish)) return 'Choose a finish';
  if (spec.size === 'custom') {
    const c = cfg.custom;
    if (!c) return 'Custom size is not available for this item';
    const { w = 0, h = 0, d } = spec;
    if (w < c.minW || w > c.maxW) return `Width must be between ${c.minW} and ${c.maxW} mm`;
    if (h < c.minH || h > c.maxH) return `Height must be between ${c.minH} and ${c.maxH} mm`;
    if (cfg.form !== 'flat' && c.minD !== undefined && (d === undefined || d < c.minD || d > (c.maxD || 9999))) return `Depth must be between ${c.minD} and ${c.maxD} mm`;
  } else if (!cfg.sizes[spec.size]) return 'Choose a size';
  return null;
}

export function price(
  model: 'SHEET' | 'POUCH' | 'LASER',
  cfg: ProductConfig,
  spec: Spec,
  mats: Record<string, MaterialInfo>,
  ps: PricingSettings = DEFAULT_PRICING,
): PriceResult {
  const invalid = validateSpec(cfg, spec);
  if (invalid) return { ok: false, error: invalid };
  const dims = resolveDims(cfg, spec);
  if (!dims) return { ok: false, error: 'Choose a size' };
  const qty = spec.qty;
  const route = routeFor(cfg, spec, model);
  const sizeLabel = spec.size === 'custom' ? 'Custom' : cfg.sizes[spec.size].label;
  const dimText = `${dims.w} × ${dims.h}${dims.d ? ' × ' + dims.d : ''} mm`;

  if (model === 'POUCH') {
    const size = spec.size === 'custom' ? null : cfg.sizes[spec.size];
    const code = size?.code ? `${spec.material}-${size.code}` : spec.material;
    const blank = mats[code] || mats[spec.material];
    if (!blank) return { ok: false, error: 'This pouch is out of stock' };
    const white = !!(mats[spec.material]?.needsWhite || blank.needsWhite);
    const perPouch = blank.price + ps.pouch.print + (white ? ps.pouch.white : 0);
    const used = qty + Math.ceil((qty * ps.pouch.wastePct) / 100) + 2;
    const lines: PriceLine[] = [
      { label: `Printing set-up`, amount: ps.pouch.setup },
      { label: `${qty} pouches × ${perPouch.toFixed(2)} (blank ${blank.price.toFixed(2)} + print${white ? ' + white' : ''})`, amount: r2(perPouch * qty) },
      { label: `Spoilage allowance (${used - qty} pouches)`, amount: r2(blank.price * (used - qty)) },
      ...extrasCost(cfg, spec, qty),
    ];
    let total = lines.reduce((a, l) => a + l.amount, 0);
    if (total < ps.minLine) { lines.push({ label: 'Minimum order top-up', amount: r2(ps.minLine - total) }); total = ps.minLine; }
    total = Math.round(total);
    const pc = ps.costs;
    const costLines: PriceLine[] = [
      { label: 'Set-up labour', amount: pc.setup },
      { label: `Pouch blanks: ${used} × ${costOf(blank).toFixed(2)}`, amount: r2(costOf(blank) * used) },
      { label: `Printing: ${qty} × ${(pc.pouchPrint + (white ? pc.pouchWhite : 0)).toFixed(2)}`, amount: r2((pc.pouchPrint + (white ? pc.pouchWhite : 0)) * qty) },
      ...extrasCostPrice(cfg, spec, qty, mats),
    ];
    return {
      ok: true, qty, unit: r2(total / qty), total, dims, piece: { w: dims.w, h: dims.h }, white, breakdown: lines, cost: sum(costLines), costLines,
      materials: [{ code, qty: used }, ...extraMaterials(cfg, spec, qty)], route,
      summary: `${sizeLabel} (${dims.w} × ${dims.h} mm) · ${blank.name} · CMYK${white ? ' + white' : ''}`,
    };
  }

  const mat = mats[spec.material];
  if (!mat) return { ok: false, error: 'This material is not available right now' };

  if (model === 'LASER') {
    const sw = mat.sheetW || 600, sh = mat.sheetH || 400;
    const pw = dims.w + 4, ph = dims.h + 4;
    const fit = fitUps(pw, ph, sw - 10, sh - 10, 2);
    if (fit.n < 1) return { ok: false, error: `Too large for one ${sw} × ${sh} mm sheet. Maximum is about ${sw - 14} × ${sh - 14} mm.` };
    const sheets = Math.ceil(qty / fit.n);
    const areaShare = (pw * ph) / (sw * sh);
    const matPerPiece = mat.price * areaShare * 1.15;
    const family = spec.material.split('-')[0];
    const speed = ps.laser.cutSpeed[family] || 1000;
    const round = spec.size !== 'custom' && cfg.sizes[spec.size]?.round;
    const perimeter = round ? Math.PI * dims.w : 2 * (dims.w + dims.h);
    let minutes = (perimeter * 1.25) / speed;
    if (spec.finish === 'engrave') minutes += ((dims.w * dims.h) / 100) * ps.laser.engraveFill / ps.laser.engraveCm2PerMin;
    const laserPerPiece = minutes * ps.laser.perMinute;
    const lines: PriceLine[] = [
      { label: 'Laser set-up and file preparation', amount: ps.laser.setup },
      { label: `${mat.name}: ${qty} × ${matPerPiece.toFixed(2)}`, amount: r2(matPerPiece * qty) },
      { label: `Laser time: ${qty} × ${minutes.toFixed(1)} min`, amount: r2(laserPerPiece * qty) },
      ...extrasCost(cfg, spec, qty),
    ];
    let total = lines.reduce((a, l) => a + l.amount, 0);
    if (total < ps.minLine) { lines.push({ label: 'Minimum order top-up', amount: r2(ps.minLine - total) }); total = ps.minLine; }
    total = Math.round(total);
    const costLines: PriceLine[] = [
      { label: 'Set-up labour', amount: ps.costs.setup },
      { label: `${mat.name}: ${Math.min(sheets, qty * areaShare * 1.15).toFixed(2)} sheets × ${costOf(mat).toFixed(2)}`, amount: r2(costOf(mat) * Math.min(sheets, qty * areaShare * 1.15)) },
      { label: `Laser running: ${(minutes * qty).toFixed(1)} min × ${ps.costs.laserPerMinute.toFixed(2)}`, amount: r2(minutes * qty * ps.costs.laserPerMinute) },
      ...extrasCostPrice(cfg, spec, qty, mats),
    ];
    return {
      ok: true, qty, unit: r2(total / qty), total, dims, piece: { w: pw, h: ph }, ups: fit.n, sheets, minutes: r2(minutes * qty), white: false,
      breakdown: lines, cost: sum(costLines), costLines, materials: [{ code: mat.code, qty: sheets }, ...extraMaterials(cfg, spec, qty)], route,
      summary: `${sizeLabel} (${dimText}) · ${mat.name} · ${FINISH_LABEL[spec.finish] || spec.finish}`,
    };
  }

  // SHEET model (OKI + Toyocut / guillotine)
  const blank = blankSize(cfg.form, dims);
  const pw = blank.w + 2 * cfg.bleed, ph = blank.h + 2 * cfg.bleed;
  const reg = cfg.cut === 'kiss' || cfg.cut === 'through' ? ps.sheet.regMargin : 0;
  const areaW = ps.sheet.w - 2 * ps.sheet.margin;
  const areaH = ps.sheet.h - 2 * ps.sheet.margin - reg;
  const fit = fitUps(pw, ph, areaW, areaH, cfg.gap);
  if (fit.n < 1) {
    return { ok: false, error: `Too large for an SRA3 sheet: the flat piece is ${Math.round(blank.w)} × ${Math.round(blank.h)} mm, the most that fits is about ${areaW - 2 * cfg.bleed} × ${areaH - 2 * cfg.bleed} mm.` };
  }
  const sides = cfg.sides && spec.sides === 2 ? 2 : 1;
  const white = mat.needsWhite;
  const netSheets = Math.ceil(qty / fit.n);
  const waste = Math.ceil((netSheets * ps.wastePct) / 100) + ps.setupSheets;
  const sheets = netSheets + waste;
  const lam = spec.finish === 'gloss' ? ps.lam.gloss : spec.finish === 'matte' ? ps.lam.matte : spec.finish === 'soft' ? ps.lam.soft : 0;
  const cutRate = cfg.cut === 'kiss' ? ps.cut.kiss : cfg.cut === 'through' ? ps.cut.through : cfg.cut === 'guillotine' ? ps.cut.guillotine : 0;
  const crease = cfg.form === 'box' ? ps.cut.crease : 0;
  const print = ps.clicks.cmyk * sides + (white ? ps.clicks.white * sides : 0);
  const perSheet = mat.price + print + lam + cutRate + crease;
  const lines: PriceLine[] = [
    { label: 'Set-up, file check and proof', amount: ps.setupFee },
    { label: `${mat.name}: ${sheets} SRA3 sheets × ${mat.price.toFixed(2)}`, amount: r2(mat.price * sheets) },
    { label: `Printing CMYK${white ? ' + white' : ''}${sides === 2 ? ', both sides' : ''}: ${sheets} × ${print.toFixed(2)}`, amount: r2(print * sheets) },
  ];
  if (lam) lines.push({ label: `${FINISH_LABEL[spec.finish]}: ${sheets} × ${lam.toFixed(2)}`, amount: r2(lam * sheets) });
  if (cutRate) lines.push({ label: `${cfg.cut === 'kiss' ? 'Kiss-cutting' : cfg.cut === 'through' ? 'Die-less cutting' : 'Trimming'}: ${sheets} × ${cutRate.toFixed(2)}`, amount: r2(cutRate * sheets) });
  if (crease) lines.push({ label: `Creasing: ${sheets} × ${crease.toFixed(2)}`, amount: r2(crease * sheets) });
  lines.push(...extrasCost(cfg, spec, qty));
  let total = lines.reduce((a, l) => a + l.amount, 0);
  if (total < ps.minLine) { lines.push({ label: 'Minimum order top-up', amount: r2(ps.minLine - total) }); total = ps.minLine; }
  total = Math.round(total);
  const pc = ps.costs;
  const clickCost = pc.clickCmyk * sides + (white ? pc.clickWhite * sides : 0);
  const lamCost = spec.finish === 'gloss' ? pc.lam.gloss : spec.finish === 'matte' ? pc.lam.matte : spec.finish === 'soft' ? pc.lam.soft : 0;
  const cutCost = cfg.cut === 'kiss' ? pc.cut.kiss : cfg.cut === 'through' ? pc.cut.through : cfg.cut === 'guillotine' ? pc.cut.guillotine : 0;
  const creaseCost = cfg.form === 'box' ? pc.cut.crease : 0;
  const costLines: PriceLine[] = [
    { label: 'Set-up labour', amount: pc.setup },
    { label: `${mat.name}: ${sheets} × ${costOf(mat).toFixed(2)}`, amount: r2(costOf(mat) * sheets) },
    { label: `Toner and drum: ${sheets} × ${clickCost.toFixed(2)}`, amount: r2(clickCost * sheets) },
  ];
  if (lamCost) costLines.push({ label: `Lamination film: ${sheets} × ${lamCost.toFixed(2)}`, amount: r2(lamCost * sheets) });
  if (cutCost + creaseCost) costLines.push({ label: `Cutting${creaseCost ? ' and creasing' : ''}: ${sheets} × ${(cutCost + creaseCost).toFixed(2)}`, amount: r2((cutCost + creaseCost) * sheets) });
  costLines.push(...extrasCostPrice(cfg, spec, qty, mats));
  return {
    ok: true, qty, unit: r2(total / qty), total, dims, piece: { w: pw, h: ph }, ups: fit.n, sheets, white,
    breakdown: lines, cost: sum(costLines), costLines, materials: [{ code: mat.code, qty: sheets }, ...extraMaterials(cfg, spec, qty)], route,
    summary: `${sizeLabel} (${dimText}) · ${mat.name} · CMYK${white ? ' + white' : ''}${sides === 2 ? ' both sides' : ''} · ${FINISH_LABEL[spec.finish] || spec.finish}`,
  };
}

/** Price at each standard quantity tier, for the "price drops as you order more" table. */
export function tierPrices(model: 'SHEET' | 'POUCH' | 'LASER', cfg: ProductConfig, spec: Spec, mats: Record<string, MaterialInfo>, ps?: PricingSettings) {
  return cfg.qtyTiers.map((q) => {
    const r = price(model, cfg, { ...spec, qty: q }, mats, ps);
    return { qty: q, unit: r.ok ? r.unit : null, total: r.ok ? r.total : null };
  });
}

/** Margin on a selling total against a cost, as rupees and percent of the selling price. */
export function margin(total: number, cost: number) {
  const m = r2(total - cost);
  return { amount: m, pct: total > 0 ? Math.round((m / total) * 1000) / 10 : 0 };
}

/** Unit price that gives `pct` margin on `cost` for `qty` pieces. */
export function priceForMargin(cost: number, qty: number, pct: number) {
  const p = Math.min(Math.max(pct, 0), 95);
  return qty > 0 ? Math.ceil((cost / (1 - p / 100) / qty) * 100) / 100 : 0;
}
