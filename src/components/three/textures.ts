/* Procedural surfaces and sample artwork for the 3D mockups, drawn on canvases in the browser (no image downloads). */

export type Surface =
  | 'paper' | 'card' | 'pp' | 'clear' | 'kraft' | 'whitekraft' | 'silver' | 'holo' | 'textured' | 'black'
  | 'acrylic-clear' | 'acrylic' | 'mirror-gold' | 'mirror-silver' | 'mdf' | 'ply' | 'leather';

/** Map a material code to the surface we render. */
export function surfaceOf(code = ''): { surface: Surface; base: string } {
  const c = code.toUpperCase();
  if (c.startsWith('PP-CLR')) return { surface: 'clear', base: '#ffffff' };
  if (c.startsWith('KRF') || c.startsWith('PCH-KR')) return { surface: 'kraft', base: '#c49a6c' };
  if (c.startsWith('PCH-WK')) return { surface: 'whitekraft', base: '#f1ede4' };
  if (c.startsWith('PP-SLV') || c.startsWith('MET')) return { surface: 'silver', base: '#c9ced3' };
  if (c.startsWith('PP-HOLO')) return { surface: 'holo', base: '#d8d2f0' };
  if (c.startsWith('PP-WHT')) return { surface: 'pp', base: '#fbfbfb' };
  if (c.startsWith('TEX')) return { surface: 'textured', base: '#f7f4ec' };
  if (c.startsWith('BLK')) return { surface: 'black', base: '#1d1d1f' };
  if (c.startsWith('CRD')) return { surface: 'card', base: '#ffffff' };
  if (c === 'ACR-3-CLR') return { surface: 'acrylic-clear', base: '#ffffff' };
  if (c === 'ACR-3-BLK') return { surface: 'acrylic', base: '#151515' };
  if (c === 'ACR-3-WHT') return { surface: 'acrylic', base: '#f6f6f4' };
  if (c === 'ACR-3-GLD') return { surface: 'mirror-gold', base: '#d4af37' };
  if (c === 'ACR-3-SLV') return { surface: 'mirror-silver', base: '#d9dde2' };
  if (c.startsWith('MDF')) return { surface: 'mdf', base: '#b48b5e' };
  if (c.startsWith('PLY')) return { surface: 'ply', base: '#d8b98c' };
  if (c === 'LTH-BRN') return { surface: 'leather', base: '#6b4126' };
  if (c === 'LTH-BLK') return { surface: 'leather', base: '#232021' };
  if (c.startsWith('LTH')) return { surface: 'leather', base: '#a5683b' };
  return { surface: 'paper', base: '#ffffff' };
}

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w)); c.height = Math.max(4, Math.round(h));
  return c;
}

/* ---- deterministic noise ---- */
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Fill a canvas with a material's base look (fibres, grain, foil…). Used under the artwork and for unprinted parts. */
export function paintSurface(ctx: CanvasRenderingContext2D, w: number, h: number, surface: Surface, base: string, seed = 7) {
  const r = rng(seed);
  if (surface === 'clear' || surface === 'acrylic-clear') { ctx.clearRect(0, 0, w, h); return; }
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  if (surface === 'kraft' || surface === 'whitekraft') {
    for (let i = 0; i < (w * h) / 90; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 14, a = r() * Math.PI;
      ctx.strokeStyle = surface === 'kraft' ? `rgba(${90 + r() * 60},${55 + r() * 40},${25 + r() * 25},${0.08 + r() * 0.14})` : `rgba(150,130,100,${0.05 + r() * 0.07})`;
      ctx.lineWidth = 0.6 + r() * 0.8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    for (let i = 0; i < (w * h) / 2200; i++) { ctx.fillStyle = `rgba(60,35,15,${0.15 + r() * 0.25})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
  } else if (surface === 'mdf' || surface === 'ply') {
    const rings = surface === 'ply' ? 34 : 14;
    for (let i = 0; i < rings; i++) {
      const y0 = (i / rings) * h + r() * 8;
      ctx.strokeStyle = surface === 'ply' ? `rgba(140,95,50,${0.12 + r() * 0.12})` : `rgba(110,75,40,${0.05 + r() * 0.05})`;
      ctx.lineWidth = 1 + r() * (surface === 'ply' ? 3 : 1.5);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 + Math.sin(x / (40 + i * 3) + i) * (6 + r() * 6));
      ctx.stroke();
    }
    for (let i = 0; i < (w * h) / 500; i++) { ctx.fillStyle = `rgba(80,50,20,${r() * 0.08})`; ctx.fillRect(r() * w, r() * h, 1, 1 + r() * 3); }
  } else if (surface === 'leather') {
    // mottled hide: soft blotches, a fine grain, burnished edges
    for (let i = 0; i < 46; i++) {
      const x = r() * w, y = r() * h, rad = (0.08 + r() * 0.3) * Math.max(w, h), g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, r() > 0.5 ? 'rgba(40,18,4,0.10)' : 'rgba(255,228,196,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < (w * h) / 50; i++) { ctx.fillStyle = r() > 0.5 ? `rgba(0,0,0,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.03})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5); }
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,12,0,0.32)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  } else if (surface === 'holo') {
    const g = ctx.createLinearGradient(0, 0, w, h);
    ['#f3d4ff', '#c8f0ff', '#d8ffd8', '#fff4c4', '#ffd2e6', '#d2d8ff'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  } else if (surface === 'silver' || surface === 'mirror-silver' || surface === 'mirror-gold') {
    const g = ctx.createLinearGradient(0, 0, w, h * 0.3);
    const [a, b] = surface === 'mirror-gold' ? ['#f6dd8c', '#b88a2a'] : ['#f2f4f6', '#a9b0b7'];
    g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < h; i += 2) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`; ctx.fillRect(0, i, w, 1); }
  } else if (surface === 'textured') {
    for (let i = 0; i < (w * h) / 40; i++) { ctx.fillStyle = `rgba(120,110,90,${r() * 0.05})`; ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
  } else {
    for (let i = 0; i < (w * h) / 160; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.018})`; ctx.fillRect(r() * w, r() * h, 1, 1); }
  }
}

/** Grey-scale bump map for a surface (paper tooth, leather pebble, wood grain). */
export function bumpFor(surface: Surface, size = 256, seed = 3) {
  const c = canvas(size, size), ctx = c.getContext('2d')!, r = rng(seed);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
  const n = surface === 'leather' ? 2600 : surface === 'kraft' || surface === 'whitekraft' ? 1800 : surface === 'textured' ? 3200 : 700;
  for (let i = 0; i < n; i++) {
    const v = Math.floor(surface === 'leather' ? 112 + r() * 36 : 100 + r() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const s = surface === 'leather' ? 0.8 + r() * 1.8 : 0.6 + r() * 1.4;
    ctx.beginPath(); ctx.arc(r() * size, r() * size, s, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

/* ---- artwork ---- */

export type Design = 'oil' | 'bakery' | 'spice' | 'skincare' | 'thanks' | 'card' | 'wedding' | 'tag' | 'sign' | 'topper' | 'leather' | 'cafe' | 'sticker' | 'sheet';
export const DESIGN_FOR_SHAPE: Record<string, Design> = {
  labels: 'oil', sticker: 'sticker', stickersheet: 'sheet', box: 'skincare', sleeve: 'bakery', tag: 'tag', card: 'thanks', bizcard: 'card',
  invite: 'wedding', pouch: 'spice', acrylic: 'sign', topper: 'topper', leather: 'leather', coaster: 'cafe',
};

const INK = { green: '#2f5d32', deep: '#14303b', terracotta: '#b4532a', gold: '#b8892c', plum: '#5b2a4a', teal: '#1d6a73' };

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.6, s * 0.7, s * 0.6, 0, s); ctx.bezierCurveTo(-s * 0.7, s * 0.6, -s * 0.9, -s * 0.6, 0, -s); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(0, -s * 0.8); ctx.lineTo(0, s * 0.9); ctx.stroke(); ctx.restore();
}
function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, col: string, weight = 700, family = 'Georgia, "Times New Roman", serif', align: CanvasTextAlign = 'center', spacing = 0) {
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.font = `${weight} ${size}px ${family}`;
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  ctx.fillText(t, x, y);
}
const SANS = '"Figtree Variable", "Helvetica Neue", Arial, sans-serif';

/** Draws the printed design for a face. With a logo image, the customer's logo is centred instead of the sample design. */
export function drawArt(ctx: CanvasRenderingContext2D, w: number, h: number, design: Design, surface: Surface, logo?: CanvasImageSource | null, face: 'front' | 'side' | 'back' = 'front') {
  const dark = surface === 'black' || surface === 'acrylic' && false;
  const ink = dark ? '#f2e7cf' : surface === 'kraft' ? '#2a1d12' : INK.deep;
  const m = Math.min(w, h);
  if (logo) {
    if (face !== 'front') { text(ctx, '', w / 2, h / 2, 10, ink); return; }
    const lw = (logo as HTMLImageElement).width || 1, lh = (logo as HTMLImageElement).height || 1;
    const s = Math.min((w * 0.7) / lw, (h * 0.62) / lh);
    ctx.drawImage(logo, w / 2 - (lw * s) / 2, h / 2 - (lh * s) / 2, lw * s, lh * s);
    return;
  }
  ctx.save();
  switch (design) {
    case 'oil': {
      if (face !== 'front') { text(ctx, 'Cold-pressed in small batches', w / 2, h * 0.3, m * 0.07, ink, 500, SANS); text(ctx, 'Net 1 L  ·  Best before 9 months', w / 2, h * 0.45, m * 0.06, ink, 400, SANS); text(ctx, 'FSSAI 1242 1999 000 123', w / 2, h * 0.6, m * 0.05, ink, 400, SANS); break; }
      ctx.fillStyle = surface === 'kraft' ? 'rgba(255,255,255,0)' : '#f6efd9'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = INK.green; ctx.lineWidth = m * 0.025; ctx.strokeRect(m * 0.05, m * 0.05, w - m * 0.1, h - m * 0.1);
      leaf(ctx, w / 2, h * 0.24, m * 0.11, INK.green);
      text(ctx, 'Malar', w / 2, h * 0.47, m * 0.22, INK.green, 700, 'Georgia, serif');
      text(ctx, 'GROUNDNUT OIL', w / 2, h * 0.64, m * 0.075, ink, 700, SANS, 'center', m * 0.012);
      text(ctx, 'Wood-pressed · Erode', w / 2, h * 0.76, m * 0.06, ink, 400, SANS);
      break;
    }
    case 'skincare': {
      if (face === 'side') { ctx.fillStyle = '#e9d9c8'; ctx.fillRect(0, 0, w, h * 0.12); text(ctx, 'Vela', w / 2, h * 0.5, m * 0.22, INK.plum, 700); break; }
      if (face === 'back') { text(ctx, 'Rose & vetiver body butter', w / 2, h * 0.3, m * 0.06, ink, 600, SANS); for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(20,48,59,0.25)'; ctx.fillRect(w * 0.18, h * (0.42 + i * 0.07), w * (0.64 - (i % 2) * 0.12), m * 0.012); } break; }
      ctx.fillStyle = '#efe2d3'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = INK.plum; ctx.beginPath(); ctx.arc(w / 2, h * 0.36, m * 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#efe2d3'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.36, m * 0.09, m * 0.15, 0.5, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'Vela', w / 2, h * 0.68, m * 0.2, INK.plum, 700);
      text(ctx, 'BOTANICALS', w / 2, h * 0.8, m * 0.06, INK.plum, 600, SANS, 'center', m * 0.02);
      break;
    }
    case 'bakery': {
      ctx.fillStyle = '#f4d8c2'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? '#e9b994' : '#f4d8c2'; ctx.fillRect((i * w) / 18, 0, w / 36, h); }
      ctx.fillStyle = '#fff8ef'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.18, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'Nila', w / 2, h * 0.45, m * 0.36, INK.terracotta, 700);
      text(ctx, 'BAKES', w / 2, h * 0.68, m * 0.12, INK.terracotta, 700, SANS, 'center', m * 0.03);
      break;
    }
    case 'spice': {
      if (face !== 'front') { text(ctx, 'Arali', w / 2, h * 0.2, m * 0.1, ink, 700); for (let i = 0; i < 7; i++) { ctx.fillStyle = 'rgba(42,29,18,0.3)'; ctx.fillRect(w * 0.2, h * (0.32 + i * 0.06), w * 0.6, m * 0.01); } break; }
      ctx.fillStyle = INK.terracotta; ctx.beginPath(); ctx.arc(w / 2, h * 0.42, m * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbe9d0'; ctx.beginPath(); ctx.arc(w / 2, h * 0.42, m * 0.25, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) { ctx.save(); ctx.translate(w / 2, h * 0.42); ctx.rotate((i / 8) * Math.PI * 2); leaf(ctx, 0, -m * 0.16, m * 0.05, INK.green); ctx.restore(); }
      text(ctx, 'Arali', w / 2, h * 0.42, m * 0.14, INK.terracotta, 700);
      text(ctx, 'SAMBAR POWDER', w / 2, h * 0.8, m * 0.075, ink, 800, SANS, 'center', m * 0.01);
      text(ctx, 'Stone-ground · 200 g', w / 2, h * 0.88, m * 0.05, ink, 500, SANS);
      break;
    }
    case 'thanks': {
      ctx.fillStyle = '#fbf4ea'; ctx.fillRect(0, 0, w, h);
      leaf(ctx, w * 0.5, h * 0.2, m * 0.08, INK.green);
      text(ctx, 'Thank you', w / 2, h * 0.45, m * 0.18, INK.green, 400, 'Georgia, serif');
      text(ctx, 'for shopping small', w / 2, h * 0.6, m * 0.07, ink, 500, SANS);
      text(ctx, 'Share a photo and tag us @nilabakes', w / 2, h * 0.78, m * 0.045, ink, 400, SANS);
      break;
    }
    case 'card': {
      if (face === 'back') { ctx.fillStyle = INK.teal; ctx.fillRect(0, 0, w, h); leaf(ctx, w / 2, h * 0.42, m * 0.18, '#d9efe8'); text(ctx, 'Arali', w / 2, h * 0.78, m * 0.14, '#ffffff', 700); break; }
      ctx.fillStyle = surface === 'black' ? '#1d1d1f' : '#ffffff'; ctx.fillRect(0, 0, w, h);
      leaf(ctx, w * 0.12, h * 0.25, m * 0.09, INK.teal);
      text(ctx, 'Meena Rajan', w * 0.07, h * 0.52, m * 0.12, surface === 'black' ? '#f5efe2' : INK.deep, 700, SANS, 'left');
      text(ctx, 'Founder, Arali Spices', w * 0.07, h * 0.64, m * 0.075, surface === 'black' ? '#cfc7b6' : INK.teal, 500, SANS, 'left');
      text(ctx, '+91 98765 43210', w * 0.07, h * 0.8, m * 0.065, surface === 'black' ? '#cfc7b6' : ink, 400, SANS, 'left');
      text(ctx, 'arali.in', w * 0.93, h * 0.8, m * 0.065, surface === 'black' ? '#cfc7b6' : ink, 400, SANS, 'right');
      break;
    }
    case 'wedding': {
      ctx.fillStyle = surface === 'black' ? '#1d1d1f' : '#fffaf0'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = INK.gold; ctx.lineWidth = m * 0.008; ctx.strokeRect(m * 0.06, m * 0.06, w - m * 0.12, h - m * 0.12);
      ctx.strokeRect(m * 0.08, m * 0.08, w - m * 0.16, h - m * 0.16);
      text(ctx, 'Together with their families', w / 2, h * 0.22, m * 0.045, INK.gold, 500, SANS);
      text(ctx, 'Priya', w / 2, h * 0.38, m * 0.13, INK.gold, 400, 'Georgia, serif');
      text(ctx, '&', w / 2, h * 0.48, m * 0.07, INK.gold, 400, 'Georgia, serif');
      text(ctx, 'Arun', w / 2, h * 0.58, m * 0.13, INK.gold, 400, 'Georgia, serif');
      text(ctx, 'Sunday, 14 February 2027 · Erode', w / 2, h * 0.76, m * 0.04, surface === 'black' ? '#eadfc8' : ink, 500, SANS);
      break;
    }
    case 'tag': {
      ctx.fillStyle = surface === 'kraft' ? 'rgba(0,0,0,0)' : '#f3ece1'; ctx.fillRect(0, 0, w, h);
      text(ctx, 'Handmade', w / 2, h * 0.5, m * 0.17, ink, 400, 'Georgia, serif');
      text(ctx, 'with care in Erode', w / 2, h * 0.64, m * 0.08, ink, 500, SANS);
      leaf(ctx, w / 2, h * 0.8, m * 0.06, INK.green);
      break;
    }
    case 'sign': {
      text(ctx, 'Arali', w / 2, h * 0.45, m * 0.32, surface === 'acrylic' && dark ? '#fff' : INK.terracotta, 700);
      text(ctx, 'SPICE WORKS', w / 2, h * 0.7, m * 0.1, INK.deep, 700, SANS, 'center', m * 0.04);
      break;
    }
    case 'topper': {
      text(ctx, 'Happy', w / 2, h * 0.32, m * 0.24, '#2b2116', 400, 'Georgia, serif');
      text(ctx, 'Birthday', w / 2, h * 0.62, m * 0.24, '#2b2116', 400, 'Georgia, serif');
      break;
    }
    case 'leather': {
      ctx.globalAlpha = 0.85; leaf(ctx, w / 2, h * 0.36, m * 0.13, 'rgba(30,15,5,0.65)'); ctx.globalAlpha = 1;
      text(ctx, 'VELA', w / 2, h * 0.66, m * 0.16, 'rgba(30,15,5,0.6)', 700, SANS, 'center', m * 0.03);
      break;
    }
    case 'cafe': {
      ctx.strokeStyle = 'rgba(55,30,10,0.75)'; ctx.lineWidth = m * 0.02; ctx.beginPath(); ctx.arc(w / 2, h / 2, m * 0.36, 0, Math.PI * 2); ctx.stroke();
      text(ctx, 'Nila', w / 2, h * 0.45, m * 0.22, 'rgba(55,30,10,0.85)', 700);
      text(ctx, 'CAFÉ · ERODE', w / 2, h * 0.62, m * 0.07, 'rgba(55,30,10,0.8)', 700, SANS, 'center', m * 0.02);
      break;
    }
    case 'sticker': {
      ctx.fillStyle = '#f7c948'; ctx.beginPath(); ctx.arc(w / 2, h / 2, m * 0.48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK.terracotta; ctx.beginPath(); ctx.arc(w / 2, h / 2, m * 0.4, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'Nila', w / 2, h * 0.46, m * 0.26, '#fff6e5', 700);
      text(ctx, 'BAKES', w / 2, h * 0.66, m * 0.1, '#fff6e5', 700, SANS, 'center', m * 0.03);
      break;
    }
    case 'sheet': {
      const cols = 3, rows = 4, gx = w / cols, gy = h / rows;
      const cs = ['#b4532a', '#2f5d32', '#1d6a73', '#b8892c', '#5b2a4a', '#f7c948'];
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const cx = gx * (i + 0.5), cy = gy * (j + 0.5), rr = Math.min(gx, gy) * 0.38, k = (i + j * cols) % cs.length;
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, rr + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = cs[k]; ctx.beginPath(); (k % 2 ? ctx.arc(cx, cy, rr, 0, Math.PI * 2) : ctx.roundRect(cx - rr, cy - rr * 0.8, rr * 2, rr * 1.6, rr * 0.3)); ctx.fill();
        text(ctx, ['Nila', 'Arali', 'Vela', 'Malar', 'Hi!', '♥'][k], cx, cy, rr * 0.55, '#ffffff', 700);
      }
      break;
    }
  }
  ctx.restore();
}
