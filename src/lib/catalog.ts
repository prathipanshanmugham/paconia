import { db } from './db';
import { num } from './format';
import type { PricingSettings, MaterialInfo, ProductConfig } from './pricing';

export const FAMILIES = [
  { key: 'LABELS', slug: 'labels', name: 'Labels & stickers', blurb: 'Product labels, die-cut stickers and sticker sheets, on paper, waterproof PP, clear, kraft and metallic.' },
  { key: 'PACKAGING', slug: 'packaging', name: 'Boxes & packaging', blurb: 'Short-run product boxes, sleeves, hang tags and thank-you cards for your brand.' },
  { key: 'POUCHES', slug: 'pouches', name: 'Printed pouches', blurb: 'Zip-lock stand-up pouches printed in full colour, with white ink on kraft.' },
  { key: 'CARDS', slug: 'cards', name: 'Cards & invitations', blurb: 'Business cards, wedding and event invitations, with white ink on black and kraft card.' },
  { key: 'LASER', slug: 'laser', name: 'Laser cut & engraved', blurb: 'Acrylic name boards, cake toppers, engraved leather tags and wooden coasters.' },
] as const;
export type FamilyKey = (typeof FAMILIES)[number]['key'];
export const familyBySlug = (slug: string) => FAMILIES.find((f) => f.slug === slug);
export const familyByKey = (key: string) => FAMILIES.find((f) => f.key === key);

export function toMaterialInfo(m: { code: string; name: string; price: unknown; cost?: unknown; uom: string; sheetW: number | null; sheetH: number | null; needsWhite: boolean; colour: string | null }): MaterialInfo {
  return { code: m.code, name: m.name, price: num(m.price), cost: m.cost === undefined ? undefined : num(m.cost), uom: m.uom, sheetW: m.sheetW, sheetH: m.sheetH, needsWhite: m.needsWhite, colour: m.colour };
}

/** All materials a product can use (pouch blanks are looked up by base code + size code). */
export async function materialsFor(cfg: ProductConfig) {
  const codes = new Set<string>(cfg.materials);
  for (const m of cfg.materials) for (const s of cfg.sizes) if (s.code) codes.add(`${m}-${s.code}`);
  const rows = await db.material.findMany({ where: { code: { in: [...codes] }, active: true } });
  const map: Record<string, MaterialInfo> = {};
  for (const r of rows) map[r.code] = toMaterialInfo(r);
  return map;
}

export async function allMaterialInfo() {
  const rows = await db.material.findMany({ where: { active: true } });
  const map: Record<string, MaterialInfo> = {};
  for (const r of rows) map[r.code] = toMaterialInfo(r);
  return map;
}

/** Display names for base material codes (pouch base codes have no row of their own). */
export function materialLabel(code: string, mats: Record<string, MaterialInfo>) {
  if (mats[code]) return mats[code].name;
  const any = Object.values(mats).find((m) => m.code.startsWith(code + '-'));
  return any ? any.name.replace(/\s*\(.*\)\s*$/, '') : code;
}

/** Strip studio costs before sending materials or rates to a customer's browser. */
export function publicMats(mats: Record<string, MaterialInfo>): Record<string, MaterialInfo> {
  return Object.fromEntries(Object.entries(mats).map(([k, m]) => [k, { ...m, cost: undefined }]));
}
export function publicPricing(ps: PricingSettings): PricingSettings {
  return { ...ps, costs: { clickCmyk: 0, clickWhite: 0, lam: { gloss: 0, matte: 0, soft: 0 }, cut: { kiss: 0, through: 0, guillotine: 0, crease: 0 }, laserPerMinute: 0, pouchPrint: 0, pouchWhite: 0, setup: 0 }, targetMargin: 0, minMargin: 0 };
}
