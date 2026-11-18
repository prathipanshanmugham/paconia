import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { DESIGN_FOR_SHAPE, bumpFor, canvas, drawArt, paintSurface, surfaceOf, type Design, type Surface } from './textures';

/* Units: 1 = 1 cm. Product sizes come in mm. */

export type MockupSpec = {
  shape: string; w: number; h: number; d?: number; round?: boolean;
  material?: string; finish?: string; logo?: HTMLImageElement | null; design?: Design;
};

const PX = 64; // texture pixels per cm

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
function printed(wCm: number, hCm: number, surface: Surface, base: string, design: Design, logo?: HTMLImageElement | null, face: 'front' | 'side' | 'back' = 'front', seed = 7) {
  const cap = 1600, s = Math.min(PX, cap / Math.max(wCm, hCm));
  const c = canvas(wCm * s, hCm * s), ctx = c.getContext('2d')!;
  paintSurface(ctx, c.width, c.height, surface, base, seed);
  drawArt(ctx, c.width, c.height, design, surface, logo, face);
  return tex(c);
}
function plain(surface: Surface, base: string, seed = 11) {
  const c = canvas(512, 512); paintSurface(c.getContext('2d')!, 512, 512, surface, base, seed);
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function bump(surface: Surface, repeat = 4) {
  const t = new THREE.CanvasTexture(bumpFor(surface)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); return t;
}

/** A believable physical material for a print surface + finish. */
export function stock(surface: Surface, base: string, finish: string | undefined, map?: THREE.Texture | null): THREE.MeshPhysicalMaterial {
  const gloss = finish === 'gloss', soft = finish === 'soft', matte = finish === 'matte';
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: map || null, roughness: 0.85, metalness: 0 });
  switch (surface) {
    case 'kraft': case 'whitekraft': m.roughness = 0.95; m.bumpMap = bump(surface, 3); m.bumpScale = 0.6; break;
    case 'textured': m.roughness = 0.95; m.bumpMap = bump('textured', 5); m.bumpScale = 0.8; break;
    case 'silver': m.metalness = 0.85; m.roughness = 0.28; break;
    case 'holo': m.metalness = 0.55; m.roughness = 0.2; m.iridescence = 1; m.iridescenceIOR = 1.6; m.iridescenceThicknessRange = [200, 900]; break;
    case 'black': m.roughness = 0.6; break;
    case 'clear': m.transparent = true; m.roughness = 0.15; m.clearcoat = 1; m.clearcoatRoughness = 0.05; break;
    case 'acrylic-clear': Object.assign(m, { transparent: true, opacity: 0.18, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, specularIntensity: 1, envMapIntensity: 1.6, depthWrite: false }); break;
    case 'acrylic': m.roughness = 0.08; m.clearcoat = 1; m.clearcoatRoughness = 0.03; break;
    case 'mirror-gold': m.metalness = 1; m.roughness = 0.12; m.color.set('#e2b75a'); break;
    case 'mirror-silver': m.metalness = 1; m.roughness = 0.08; m.color.set('#e7eaee'); break;
    case 'mdf': case 'ply': m.roughness = 0.82; m.bumpMap = bump(surface, 2); m.bumpScale = 0.3; break;
    case 'leather': m.roughness = 0.58; m.sheen = 0.35; m.sheenRoughness = 0.5; m.sheenColor = new THREE.Color('#ffe2c4'); m.bumpMap = bump('leather', 6); m.bumpScale = 0.5; break;
    default: m.roughness = 0.78;
  }
  if (['paper', 'card', 'pp', 'kraft', 'whitekraft', 'textured', 'black', 'clear'].includes(surface)) {
    if (gloss) { m.roughness = 0.35; m.clearcoat = 0.9; m.clearcoatRoughness = 0.08; }
    if (matte) { m.roughness = 0.7; }
    if (soft) { m.roughness = 0.92; m.sheen = 0.5; m.sheenRoughness = 0.9; m.sheenColor = new THREE.Color('#ffffff'); }
    if (surface === 'pp') { m.roughness = gloss ? 0.3 : 0.5; m.clearcoat = Math.max(m.clearcoat, 0.4); }
  }
  return m;
}
const metal = (color = '#c9ccd1', rough = 0.3) => new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: rough });
const glossy = (color: string, rough = 0.35) => new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: 0.5 });

function shadowy(o: THREE.Object3D) { o.traverse((c) => { if ((c as THREE.Mesh).isMesh && !c.userData.noCast) { c.castShadow = true; c.receiveShadow = true; } }); return o; }

/** A flat extruded piece (sticker, tag, card…) whose top face carries `top`. Lies in XZ, top facing +Y. */
function slab(shape: THREE.Shape, depth: number, top: THREE.Material, side: THREE.Material) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
  g.computeBoundingBox();
  const bb = g.boundingBox!, uv = g.attributes.uv as THREE.BufferAttribute, pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  const mesh = new THREE.Mesh(g, [top, side]);
  mesh.rotation.x = -Math.PI / 2; // shape XY -> ground XZ, extrusion goes up
  const grp = new THREE.Group(); grp.add(mesh); return grp;
}
function rrect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function circle(r: number) { const s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s; }

/* ---------------- product builders ---------------- */

function jarWithLabel(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const lw = p.w / 10, lh = p.h / 10;
  const R = Math.min(6, Math.max(2.6, lw / (2 * Math.PI * 0.55)));
  const H = Math.max(lh * 1.55, R * 2.3);
  const g = new THREE.Group();
  const prof: THREE.Vector2[] = [];
  const steps = 24;
  prof.push(new THREE.Vector2(0.001, 0));
  for (let i = 0; i <= steps; i++) { const t = i / steps; prof.push(new THREE.Vector2(R * (t < 0.06 ? 0.9 + t * 1.6 : 1), t * H * 0.92)); }
  prof.push(new THREE.Vector2(R * 0.82, H * 0.95), new THREE.Vector2(R * 0.82, H));
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 0.4, roughness: 0.03, ior: 1.5, transparent: true, specularIntensity: 1, envMapIntensity: 1.2 });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), glass));
  const oil = new THREE.MeshPhysicalMaterial({ color: '#e8a91c', emissive: '#5a3300', emissiveIntensity: 0.25, roughness: 0.18, clearcoat: 0.6 });
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.9, H * 0.8, 72), oil); fill.position.y = H * 0.41; g.add(fill);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.88, R * 0.88, H * 0.12, 72), metal('#c7a14a', 0.32)); lid.position.y = H * 1.04; g.add(lid);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.88, 0.05, 72), metal('#d8b65e', 0.22)); top.position.y = H * 1.1; g.add(top);
  // label: a curved strip on the jar; round labels get a circular cut-out
  const arc = Math.min(lw / R, Math.PI * 1.9);
  const t = printed(lw, lh, sf.surface, sf.base, p.design || 'oil', p.logo);
  let alpha: THREE.Texture | null = null;
  if (p.round) { const c = canvas(512, 512), x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, 512, 512); x.fillStyle = '#fff'; x.beginPath(); x.arc(256, 256, 254, 0, Math.PI * 2); x.fill(); alpha = new THREE.CanvasTexture(c); }
  const lm = stock(sf.surface, sf.base, p.finish, t);
  if (alpha) { lm.alphaMap = alpha; lm.transparent = true; lm.alphaTest = 0.5; }
  const label = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.012, R * 1.012, lh, 128, 1, true, -arc / 2, arc), lm);
  label.position.y = H * 0.44; label.rotation.y = Math.PI / 2 * 0; g.add(label);
  g.rotation.y = -0.18; // label turned towards the default camera
  return g;
}

function stickers(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const shape = p.round ? circle(w / 2) : rrect(w, h, Math.min(w, h) * 0.18);
  const c = canvas(w * PX, h * PX), x = c.getContext('2d')!;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
  const inset = Math.min(c.width, c.height) * 0.06;
  x.save(); x.beginPath(); p.round ? x.arc(c.width / 2, c.height / 2, c.width / 2 - inset, 0, Math.PI * 2) : x.roundRect(inset, inset, c.width - 2 * inset, c.height - 2 * inset, Math.min(c.width, c.height) * 0.14); x.clip();
  paintSurface(x, c.width, c.height, sf.surface === 'clear' ? 'paper' : sf.surface, sf.base); drawArt(x, c.width, c.height, p.design || 'sticker', sf.surface, p.logo); x.restore();
  const top = stock(sf.surface === 'clear' ? 'pp' : sf.surface, sf.base, p.finish || 'gloss', tex(c));
  const side = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.6 });
  const poses = [[0, 0, -0.2], [w * 0.85, -h * 0.25, 0.5], [-w * 0.75, h * 0.35, -0.7]];
  poses.forEach(([px, pz, ry], i) => { const s = slab(shape, 0.025, top, side); s.position.set(px, i * 0.012, pz); s.rotation.y = ry; g.add(s); });
  return g;
}

function stickerSheet(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = Math.max(10.5, p.w / 10 * 3.4), h = Math.max(14.8, p.h / 10 * 4.4), g = new THREE.Group();
  const c = canvas(w * 40, h * 40), x = c.getContext('2d')!;
  paintSurface(x, c.width, c.height, sf.surface === 'clear' ? 'paper' : sf.surface, sf.base);
  if (p.logo) { const cols = 3, rows = 4; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { x.save(); x.translate((c.width / cols) * i, (c.height / rows) * j); drawArt(x, c.width / cols, c.height / rows, 'sticker', sf.surface, p.logo); x.restore(); } }
  else drawArt(x, c.width, c.height, 'sheet', sf.surface, null);
  const top = stock(sf.surface === 'clear' ? 'pp' : sf.surface, sf.base, p.finish, tex(c));
  const side = new THREE.MeshStandardMaterial({ color: '#f1f0ec', roughness: 0.7 });
  const a = slab(rrect(w, h, 0.25), 0.02, top, side); a.position.y = 0.06; a.rotation.y = -0.18; g.add(a);
  const b = slab(rrect(w, h, 0.25), 0.02, top, side); b.position.set(-w * 0.45, 0, -h * 0.12); b.rotation.y = 0.22; g.add(b);
  return g;
}

function box(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const L = p.w / 10, W = (p.d || p.w) / 10, H = p.h / 10;
  const design = p.design || 'skincare';
  const face = (wc: number, hc: number, f: 'front' | 'side' | 'back', seed: number) => stock(sf.surface, sf.base, p.finish, printed(wc, hc, sf.surface, sf.base, design, p.logo, f, seed));
  // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  const mats = [face(W, H, 'side', 2), face(W, H, 'side', 3), face(L, W, 'side', 4), stock(sf.surface, sf.base, 'none', plain(sf.surface, sf.base, 5)), face(L, H, 'front', 6), face(L, H, 'back', 8)];
  const geo = new RoundedBoxGeometry(L, H, W, 3, Math.min(0.05, L * 0.01));
  const m = new THREE.Mesh(geo, mats); m.position.y = H / 2;
  const g = new THREE.Group(); g.add(m);
  // tuck line on the lid
  const line = new THREE.Mesh(new THREE.BoxGeometry(L * 0.96, 0.004, 0.01), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18 })); line.position.set(0, H + 0.002, W / 2 - 0.25); g.add(line);
  g.rotation.y = -0.45;
  return g;
}

function sleeve(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const L = p.w / 10, W = (p.d || p.w * 0.6) / 10, H = Math.max(3, p.h / 10 * 0.35);
  const g = new THREE.Group();
  const tray = new THREE.Mesh(new RoundedBoxGeometry(L, H, W, 2, 0.04), stock('whitekraft', '#f1ede4', 'none', plain('whitekraft', '#f1ede4'))); tray.position.y = H / 2; g.add(tray);
  const sw = Math.min(L * 0.55, p.h / 10);
  const art = (wc: number, hc: number, f: 'front' | 'side' | 'back') => stock(sf.surface, sf.base, p.finish, printed(wc, hc, sf.surface, sf.base, p.design || 'bakery', p.logo, f));
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const s = new THREE.Mesh(new THREE.BoxGeometry(sw, H + 0.06, W + 0.06), [hidden, hidden, art(sw, W, 'front'), art(sw, W, 'side'), art(sw, H, 'side'), art(sw, H, 'back')]);
  s.position.y = H / 2; g.add(s);
  g.rotation.y = -0.5; g.rotation.x = 0;
  return g;
}

function hangTags(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const s = new THREE.Shape(), c = Math.min(w, h) * 0.18;
  s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2 - c); s.lineTo(w / 2 - c, h / 2); s.lineTo(-w / 2 + c, h / 2); s.lineTo(-w / 2, h / 2 - c); s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, h / 2 - c * 0.9, Math.min(w, h) * 0.05, 0, Math.PI * 2, true); s.holes.push(hole);
  const top = stock(sf.surface, sf.base, p.finish, printed(w, h, sf.surface, sf.base, p.design || 'tag', p.logo));
  const edge = new THREE.MeshStandardMaterial({ color: sf.surface === 'kraft' ? '#b8905f' : '#efeae0', roughness: 0.9 });
  const twine = new THREE.MeshStandardMaterial({ color: '#c9b08a', roughness: 1 });
  [[0, 0, -0.15], [w * 0.65, -h * 0.12, 0.35]].forEach(([px, pz, ry], i) => {
    const t = slab(s, 0.045, top, edge); t.position.set(px, i * 0.05, pz); t.rotation.y = ry; g.add(t);
    const hy = h / 2 - c * 0.9;
    const pts = [new THREE.Vector3(0, 0.06, -hy), new THREE.Vector3(0.6, 0.15, -hy - 1.2), new THREE.Vector3(-0.4, 0.1, -hy - 3), new THREE.Vector3(1.4, 0.05, -hy - 4.5), new THREE.Vector3(2.6, 0.03, -hy - 5.4)];
    const str = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.045, 8), twine);
    const sg = new THREE.Group(); sg.add(str); sg.position.copy(t.position); sg.rotation.y = ry; g.add(sg);
  });
  return g;
}

function cards(p: MockupSpec, sf: { surface: Surface; base: string }, kind: 'card' | 'bizcard' | 'invite') {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const shape = p.round || kind === 'bizcard' && p.round ? rrect(w, h, Math.min(w, h) * 0.12) : rrect(w, h, 0.03);
  const design: Design = p.design || (kind === 'bizcard' ? 'card' : kind === 'invite' ? 'wedding' : 'thanks');
  const front = stock(sf.surface, sf.base, p.finish, printed(w, h, sf.surface, sf.base, design, p.logo, 'front'));
  const back = stock(sf.surface, sf.base, p.finish, printed(w, h, sf.surface, sf.base, design, null, 'back'));
  const edge = new THREE.MeshStandardMaterial({ color: sf.surface === 'black' ? '#202022' : sf.surface === 'kraft' ? '#b98b5c' : '#f3f2ee', roughness: 0.85 });
  const t = 0.035;
  if (kind === 'invite') {
    const ew = w * 1.06, eh = h * 1.06;
    const env = stock('paper', '#efe6d4', 'none', plain('textured', '#efe6d4'));
    const e = slab(rrect(ew, eh, 0.05), 0.06, env, new THREE.MeshStandardMaterial({ color: '#e5dac5', roughness: 0.9 })); e.position.set(w * 0.25, 0, -h * 0.18); e.rotation.y = 0.18; g.add(e);
    const flap = new THREE.Shape(); flap.moveTo(-ew / 2, 0); flap.lineTo(ew / 2, 0); flap.lineTo(0, -eh * 0.45); flap.closePath();
    const f = slab(flap, 0.01, env, env); f.position.set(w * 0.25, 0.065, -h * 0.18 - eh / 2 * Math.cos(0.18) + 0.0); f.rotation.y = 0.18; g.add(f);
    const c1 = slab(shape, t, front, edge); c1.position.set(-w * 0.12, 0.08, h * 0.08); c1.rotation.y = -0.12; g.add(c1);
    return g;
  }
  const n = kind === 'bizcard' ? 14 : 6;
  for (let i = 0; i < n; i++) { const c = slab(shape, t, i === n - 1 ? front : back, edge); c.position.set((i % 2) * 0.03, i * t, (i % 3) * 0.02); c.rotation.y = -0.15 + (i % 3) * 0.006; g.add(c); }
  const flipped = slab(shape, t, kind === 'bizcard' ? back : front, edge); flipped.position.set(w * 0.95, 0, h * 0.35); flipped.rotation.y = 0.32; g.add(flipped);
  return g;
}

function pouch(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const W = p.w / 10, H = p.h / 10, D = (p.d || p.w * 0.45) / 10, g = new THREE.Group();
  const seg = 48;
  const panel = (map: THREE.Texture, sign: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(W, H, seg, seg);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / W + 0.5, v = pos.getY(i) / H + 0.5;
      const across = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      const seal = v > 0.86 ? 0 : v > 0.7 ? (0.86 - v) / 0.16 : 1;
      const bulge = (0.35 + 0.65 * (1 - v)) * seal;
      pos.setZ(i, sign * (D / 2) * across * bulge + sign * 0.02);
      pos.setY(i, pos.getY(i) + H / 2);
    }
    geo.computeVertexNormals();
    const m = stock(sf.surface, sf.base, p.finish || 'matte', map); m.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, m); if (sign < 0) mesh.rotation.y = Math.PI; return mesh;
  };
  const art = (f: 'front' | 'back') => {
    const c = canvas(W * PX, H * PX), x = c.getContext('2d')!;
    paintSurface(x, c.width, c.height, sf.surface, sf.base);
    x.save(); x.translate(0, c.height * 0.16); drawArt(x, c.width, c.height * 0.84, p.design || 'spice', sf.surface, f === 'front' ? p.logo : null, f); x.restore();
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = c.height * 0.004; x.beginPath(); x.moveTo(0, c.height * 0.1); x.lineTo(c.width, c.height * 0.1); x.stroke();
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(0, c.height * 0.055); x.lineTo(c.width * 0.025, c.height * 0.065); x.lineTo(0, c.height * 0.075); x.fill();
    x.beginPath(); x.moveTo(c.width, c.height * 0.055); x.lineTo(c.width * 0.975, c.height * 0.065); x.lineTo(c.width, c.height * 0.075); x.fill();
    return tex(c);
  };
  g.add(panel(art('front'), 1));
  const back = panel(art('back'), 1); back.rotation.y = Math.PI; g.add(back);
  const gus = new THREE.Mesh(new THREE.CircleGeometry(1, 48), stock(sf.surface, sf.base, 'none', plain(sf.surface, sf.base))); gus.scale.set(W / 2, D / 2 * 0.36 * 1.0, 1); gus.rotation.x = -Math.PI / 2; gus.position.y = 0.01;
  gus.scale.set(W / 2, D / 2, 1); g.add(gus);
  g.rotation.y = -0.35;
  return g;
}

function acrylicSign(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(w * 4, h * 4), new THREE.ShadowMaterial({ opacity: 0.16 }));
  wall.position.set(0, h * 0.75, -0.8); wall.receiveShadow = true; wall.userData.noFrame = true; wall.userData.noCast = true; g.add(wall);
  const slabM = stock(sf.surface, sf.base, 'gloss', sf.surface === 'acrylic-clear' ? null : plain(sf.surface, sf.base));
  const panel = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.3, 3, 0.04), slabM); panel.position.set(0, h * 0.75, 0.2); g.add(panel);
  const c = canvas(w * 48, h * 48), x = c.getContext('2d')!; drawArt(x, c.width, c.height, p.design || 'sign', sf.surface, p.logo);
  const print = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.98), new THREE.MeshPhysicalMaterial({ map: tex(c), transparent: true, roughness: 0.4 }));
  print.position.set(0, h * 0.75, 0.356); g.add(print);
  g.userData.noFloor = true;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { const so = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 32), metal('#d5d8dc', 0.22)); so.rotation.x = Math.PI / 2; so.position.set(sx * (w / 2 - 1.4), h * 0.75 + sy * (h / 2 - 1.4), -0.05); g.add(so); });
  return g;
}

function cakeTopper(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const R = Math.max(w * 0.6, 8);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.25, R * 1.2, 0.4, 64), glossy('#f4f4f2', 0.2)); plate.position.y = 0.2; g.add(plate);
  const cake = new THREE.Mesh(new THREE.CylinderGeometry(R, R, R * 0.7, 64), new THREE.MeshPhysicalMaterial({ color: '#f6dfe8', roughness: 0.75, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') })); cake.position.y = 0.4 + R * 0.35; g.add(cake);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.004, R * 0.12, 64, 1, true), new THREE.MeshPhysicalMaterial({ color: '#d9a3b6', roughness: 0.5, sheen: 0.8, sheenColor: new THREE.Color('#fff') })); band.position.y = 0.4 + R * 0.12; g.add(band);
  for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(R * 0.07, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.6 })); const a = (i / 18) * Math.PI * 2; b.position.set(Math.cos(a) * R * 0.92, 0.4 + R * 0.7, Math.sin(a) * R * 0.92); g.add(b); }
  const c = canvas(w * 60, h * 60), x = c.getContext('2d')!; x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const m = Math.min(c.width, c.height);
  if (p.logo) { const lw = p.logo.width, lh = p.logo.height, s = Math.min(c.width * 0.9 / lw, c.height * 0.8 / lh); x.filter = 'grayscale(1) contrast(4) invert(1)'; x.drawImage(p.logo, (c.width - lw * s) / 2, (c.height - lh * s) / 2, lw * s, lh * s); x.filter = 'none'; }
  else {
    x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
    x.font = `italic 700 ${m * 0.36}px Georgia, 'Times New Roman', serif`; x.lineWidth = m * 0.03;
    x.fillText('Happy', c.width / 2, c.height * 0.4); x.strokeText('Happy', c.width / 2, c.height * 0.4);
    x.fillText('Birthday', c.width / 2, c.height * 0.8); x.strokeText('Birthday', c.width / 2, c.height * 0.8);
    x.fillRect(c.width * 0.1, c.height * 0.79, c.width * 0.8, m * 0.06); x.fillRect(c.width * 0.22, c.height * 0.36, c.width * 0.56, m * 0.05);
  }
  const alpha = new THREE.CanvasTexture(c);
  const tm = stock(sf.surface === 'acrylic-clear' ? 'mirror-gold' : sf.surface, sf.base, 'gloss', null);
  if (sf.surface === 'acrylic' ) tm.color.set(sf.base);
  tm.alphaMap = alpha; tm.alphaTest = 0.5; tm.side = THREE.DoubleSide;
  const edgeM = tm.clone(); edgeM.color.multiplyScalar(0.7); edgeM.roughness = 0.4;
  const top = 0.4 + R * 0.7;
  for (let k = 0; k < 8; k++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), k === 0 || k === 7 ? tm : edgeM); pl.position.set(0, top + h * 0.5 + 2.2, -k * 0.04); pl.castShadow = k === 0; g.add(pl); }
  [-0.3, 0.3].forEach((sx) => { const st = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), tm.clone()); (st.material as THREE.MeshPhysicalMaterial).alphaMap = null; (st.material as THREE.MeshPhysicalMaterial).alphaTest = 0; st.position.set(sx * w, top + 1.1, -0.1); g.add(st); });
  g.rotation.y = -0.15;
  return g;
}

function leatherTags(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const c = canvas(w * PX, h * PX), x = c.getContext('2d')!; paintSurface(x, c.width, c.height, 'leather', sf.base); drawArt(x, c.width, c.height, p.design || 'leather', 'leather', p.logo);
  x.setLineDash([c.width * 0.025, c.width * 0.02]); x.strokeStyle = 'rgba(240,225,200,0.55)'; x.lineWidth = c.width * 0.008; x.strokeRect(c.width * 0.06, c.height * 0.06, c.width * 0.88, c.height * 0.88);
  const bc = canvas(256, 256 * h / w), bx = bc.getContext('2d')!; bx.fillStyle = '#fff'; bx.fillRect(0, 0, bc.width, bc.height); bx.globalCompositeOperation = 'multiply'; drawArt(bx, bc.width, bc.height, p.design || 'leather', 'paper', p.logo);
  const top = stock('leather', sf.base, 'none', tex(c)); top.bumpMap = new THREE.CanvasTexture(bc); top.bumpScale = 3;
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(sf.base).multiplyScalar(0.55), roughness: 0.7 });
  const shape = rrect(w, h, Math.min(w, h) * 0.22);
  const hole = new THREE.Path(); hole.absarc(0, h / 2 - Math.min(w, h) * 0.18, Math.min(w, h) * 0.07, 0, Math.PI * 2, true); shape.holes.push(hole);
  [[0, 0, -0.25], [w * 0.95, h * 0.1, 0.4]].forEach(([px, pz, ry]) => {
    const t = slab(shape, 0.28, top, edge); t.position.set(px, 0, pz); t.rotation.y = ry; g.add(t);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, h) * 0.32, 0.09, 16, 64), metal('#cfd2d6', 0.25));
    ring.rotation.x = Math.PI / 2 - 0.15; ring.position.set(px + Math.sin(ry) * -(h / 2 + Math.min(w, h) * 0.15), 0.12, pz - Math.cos(ry) * (h / 2 + Math.min(w, h) * 0.15)); g.add(ring);
  });
  return g;
}

function coasters(p: MockupSpec, sf: { surface: Surface; base: string }) {
  const w = p.w / 10, h = p.h / 10, g = new THREE.Group();
  const s = sf.surface === 'mdf' || sf.surface === 'ply' ? sf.surface : 'mdf';
  const c = canvas(w * PX, h * PX), x = c.getContext('2d')!; paintSurface(x, c.width, c.height, s, sf.base); drawArt(x, c.width, c.height, p.design || 'cafe', s, p.logo);
  const bc = canvas(256, 256), bx = bc.getContext('2d')!; bx.fillStyle = '#fff'; bx.fillRect(0, 0, 256, 256); drawArt(bx, 256, 256, p.design || 'cafe', 'paper', p.logo);
  const top = stock(s, sf.base, 'none', tex(c)); top.bumpMap = new THREE.CanvasTexture(bc); top.bumpScale = 2.5;
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color(sf.base).multiplyScalar(0.8), roughness: 0.85 });
  const cork = new THREE.MeshStandardMaterial({ map: plain('kraft', '#a77a4a', 21), roughness: 1 });
  const shape = p.round !== false && Math.abs(w - h) < 0.01 && !(/sq/i.test(String(p.round))) ? circle(w / 2) : rrect(w, h, 0.6);
  const poses = [[0, 0, 0, 0], [w * 1.05, 0, h * 0.2, 0.3], [w * 0.95, 0.45, h * 0.15, 0.1], [w * 0.95, 0.9, h * 0.1, 0.5]];
  poses.forEach(([px, py, pz, ry]) => {
    const base = slab(shape, 0.12, cork, cork); base.position.set(px, py, pz); base.rotation.y = ry; g.add(base);
    const t = slab(shape, 0.32, top, edge); t.position.set(px, py + 0.12, pz); t.rotation.y = ry; g.add(t);
  });
  const mug = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.27, w * 0.24, w * 0.55, 48, 1, true), glossy('#f3efe7', 0.25)); body.position.y = w * 0.275; (body.material as THREE.Material).side = THREE.DoubleSide; mug.add(body);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(w * 0.26, 48), new THREE.MeshPhysicalMaterial({ color: '#3b2314', roughness: 0.15 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = w * 0.5; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(w * 0.13, w * 0.03, 12, 32, Math.PI * 1.3), glossy('#f3efe7', 0.25)); handle.position.set(w * 0.3, w * 0.28, 0); handle.rotation.z = -Math.PI * 0.65; mug.add(handle);
  mug.position.set(w * 0.95, 1.35, h * 0.1); g.add(mug);
  g.rotation.y = -0.2;
  return g;
}

/** Default camera angle per product: low for jars and pouches, high for flat print. */
export const VIEWS: Record<string, { azimuth: number; elevation: number }> = {
  labels: { azimuth: -0.35, elevation: 0.2 }, pouch: { azimuth: -0.4, elevation: 0.2 }, acrylic: { azimuth: -0.4, elevation: 0.12 },
  topper: { azimuth: -0.35, elevation: 0.24 }, box: { azimuth: -0.55, elevation: 0.4 }, sleeve: { azimuth: -0.5, elevation: 0.5 },
  coaster: { azimuth: -0.5, elevation: 0.62 }, sticker: { azimuth: -0.3, elevation: 0.95 }, stickersheet: { azimuth: -0.25, elevation: 1.0 },
  tag: { azimuth: -0.35, elevation: 0.9 }, card: { azimuth: -0.35, elevation: 0.8 }, bizcard: { azimuth: -0.4, elevation: 0.72 },
  invite: { azimuth: -0.3, elevation: 0.9 }, leather: { azimuth: -0.35, elevation: 0.82 },
};

/** Builds the product model for a spec. Returns a group resting on y = 0. */
export function buildProduct(p: MockupSpec): THREE.Group {
  const sf = surfaceOf(p.material);
  const spec = { ...p, design: p.design || DESIGN_FOR_SHAPE[p.shape] };
  let g: THREE.Group;
  switch (p.shape) {
    case 'labels': g = jarWithLabel(spec, sf); break;
    case 'sticker': g = stickers(spec, sf); break;
    case 'stickersheet': g = stickerSheet(spec, sf); break;
    case 'box': g = box(spec, sf); break;
    case 'sleeve': g = sleeve(spec, sf); break;
    case 'tag': g = hangTags(spec, sf); break;
    case 'card': g = cards(spec, sf, 'card'); break;
    case 'bizcard': g = cards(spec, sf, 'bizcard'); break;
    case 'invite': g = cards(spec, sf, 'invite'); break;
    case 'pouch': g = pouch(spec, sf); break;
    case 'acrylic': g = acrylicSign(spec, sf); break;
    case 'topper': g = cakeTopper(spec, sf); break;
    case 'leather': g = leatherTags(spec, sf); break;
    case 'coaster': g = coasters(spec, sf); break;
    default: g = box(spec, sf);
  }
  shadowy(g);
  // rest on the ground and centre horizontally
  const bb = framedBox(g), c = bb.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group(); g.position.x -= c.x; g.position.z -= c.z; g.position.y -= bb.min.y; wrap.add(g);
  wrap.userData.view = VIEWS[p.shape];
  return wrap;
}

/** Bounds of everything that should be in frame (skips shadow catchers). */
export function framedBox(o: THREE.Object3D) {
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3(), walk = (n: THREE.Object3D) => {
    if (n.userData.noFrame || !n.visible) return;
    const m = n as THREE.Mesh;
    if (m.isMesh && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); }
    n.children.forEach(walk);
  };
  walk(o); return box;
}

/* ---------------- folding box (scroll story) ---------------- */

const ease = (a: number, b: number, t: number) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

/** A tuck-end box made of hinged panels. setFold(0) = printed flat sheet lying on the table; setFold(1) = closed box. */
export function buildFoldingBox(L = 7, W = 7, H = 7, logo?: HTMLImageElement | null) {
  const sf = { surface: 'paper' as Surface, base: '#ffffff' };
  const inner = new THREE.MeshStandardMaterial({ map: plain('whitekraft', '#efe9dc', 31), roughness: 0.95, side: THREE.BackSide });
  const outer = (wc: number, hc: number, f: 'front' | 'side' | 'back' | 'plain') => {
    const t = f === 'plain' ? plain('paper', '#efe2d3', 9) : printed(wc, hc, sf.surface, sf.base, 'skincare', logo, f);
    const m = stock('card', '#ffffff', 'matte', t); m.side = THREE.FrontSide; return m;
  };
  const panel = (w: number, h: number, mat: THREE.Material, ox = 0, oy = 0) => {
    const geo = new THREE.PlaneGeometry(w, h); geo.translate(w / 2 + ox, h / 2 + oy, 0);
    const grp = new THREE.Group(); const a = new THREE.Mesh(geo, mat), b = new THREE.Mesh(geo, inner); a.castShadow = b.castShadow = true; grp.add(a, b); return grp;
  };
  const gW = Math.min(1.2, W * 0.2), tuck = Math.min(1.6, W * 0.3), dust = W * 0.45;
  const F = panel(L, H, outer(L, H, 'front'));
  const S1 = new THREE.Group(); S1.position.x = L; S1.add(panel(W, H, outer(W, H, 'side'))); F.add(S1);
  const B = new THREE.Group(); B.position.x = W; B.add(panel(L, H, outer(L, H, 'back'))); S1.add(B);
  const S2 = new THREE.Group(); S2.position.x = L; S2.add(panel(W, H, outer(W, H, 'side'))); B.add(S2);
  const G = new THREE.Group(); G.add(panel(gW, H, outer(gW, H, 'plain'), -gW, 0)); F.add(G);
  const lidMat = outer(L, W, 'side'); if (lidMat.map) { lidMat.map.center.set(0.5, 0.5); lidMat.map.rotation = Math.PI; }
  const lid = new THREE.Group(); lid.position.y = H; lid.add(panel(L, W, lidMat)); B.add(lid);
  const tk = new THREE.Group(); tk.position.y = W; tk.add(panel(L, tuck, outer(L, tuck, 'plain'))); lid.add(tk);
  const d1 = new THREE.Group(); d1.position.y = H; d1.add(panel(W, dust, outer(W, dust, 'plain'))); S1.add(d1);
  const d2 = new THREE.Group(); d2.position.y = H; d2.add(panel(W, dust, outer(W, dust, 'plain'))); S2.add(d2);
  const bottom = new THREE.Group(); bottom.add(panel(L, W, outer(L, W, 'plain'), 0, -W)); F.add(bottom);
  const root = new THREE.Group(); root.add(F);
  const flatW = gW + 2 * L + 2 * W, flatH = H + W + tuck + W;
  const holder = new THREE.Group(); holder.add(root);
  shadowy(holder);
  const bb = new THREE.Box3(), c = new THREE.Vector3();
  const setFold = (t: number) => {
    const walls = ease(0.3, 0.6, t) * Math.PI / 2;
    S1.rotation.y = walls; B.rotation.y = walls; S2.rotation.y = walls; G.rotation.y = -walls * 0.98;
    bottom.rotation.x = ease(0.55, 0.68, t) * Math.PI / 2;
    d1.rotation.x = -ease(0.66, 0.76, t) * Math.PI / 2 * 0.98; d2.rotation.x = -ease(0.68, 0.78, t) * Math.PI / 2 * 0.98;
    lid.rotation.x = -ease(0.76, 0.9, t) * Math.PI / 2;
    tk.rotation.x = -ease(0.86, 0.97, t) * Math.PI / 2 * 0.97;
    root.rotation.x = -Math.PI / 2 * (1 - ease(0.12, 0.36, t));
    root.rotation.y = -0.65 * ease(0.4, 1, t);
    // keep it resting on the table, centred
    root.position.set(0, 0, 0); holder.updateMatrixWorld(true);
    bb.makeEmpty(); root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld)); } });
    bb.getCenter(c); root.position.set(-c.x, -bb.min.y + 0.002, -c.z);
  };
  setFold(0);
  return { group: holder, setFold, size: Math.max(flatW, flatH) };
}
