import { round2 } from './format';

export const SELLER_STATE_CODE = '33'; // Tamil Nadu

export const STATES: { code: string; name: string }[] = [
  ['35', 'Andaman and Nicobar Islands'], ['37', 'Andhra Pradesh'], ['12', 'Arunachal Pradesh'], ['18', 'Assam'], ['10', 'Bihar'],
  ['04', 'Chandigarh'], ['22', 'Chhattisgarh'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['07', 'Delhi'], ['30', 'Goa'],
  ['24', 'Gujarat'], ['06', 'Haryana'], ['02', 'Himachal Pradesh'], ['01', 'Jammu and Kashmir'], ['20', 'Jharkhand'], ['29', 'Karnataka'],
  ['32', 'Kerala'], ['38', 'Ladakh'], ['31', 'Lakshadweep'], ['23', 'Madhya Pradesh'], ['27', 'Maharashtra'], ['14', 'Manipur'],
  ['17', 'Meghalaya'], ['15', 'Mizoram'], ['13', 'Nagaland'], ['21', 'Odisha'], ['34', 'Puducherry'], ['03', 'Punjab'], ['08', 'Rajasthan'],
  ['11', 'Sikkim'], ['33', 'Tamil Nadu'], ['36', 'Telangana'], ['16', 'Tripura'], ['09', 'Uttar Pradesh'], ['05', 'Uttarakhand'], ['19', 'West Bengal'],
].map(([code, name]) => ({ code, name }));

export const stateName = (code?: string | null) => STATES.find((s) => s.code === code)?.name || '';

/** Best guess of the GST state code from a 6-digit pincode (first digits). The customer can always change it. */
export function stateFromPin(pin?: string | null): string {
  const p = String(pin || '');
  if (!/^\d{6}$/.test(p)) return SELLER_STATE_CODE;
  const two = Number(p.slice(0, 2)), three = Number(p.slice(0, 3));
  if (three === 605 || three === 607 || three === 609) return three === 605 ? '34' : '33';
  if (two >= 60 && two <= 64) return '33';
  if (two === 11) return '07';
  if (two >= 12 && two <= 13) return '06';
  if (two >= 14 && two <= 16) return three === 160 ? '04' : '03';
  if (two === 17) return '02';
  if (two >= 18 && two <= 19) return '01';
  if (two >= 20 && two <= 28) return two === 24 || two === 26 ? (three >= 244 && three <= 263 ? '05' : '09') : '09';
  if (two >= 30 && two <= 34) return '08';
  if (two >= 36 && two <= 39) return '24';
  if (two >= 40 && two <= 44) return three === 403 ? '30' : '27';
  if (two >= 45 && two <= 48) return '23';
  if (two === 49) return '22';
  if (two === 50) return '36';
  if (two >= 51 && two <= 53) return '37';
  if (two >= 56 && two <= 59) return '29';
  if (two >= 67 && two <= 69) return '32';
  if (two >= 70 && two <= 74) return three === 737 ? '11' : '19';
  if (two >= 75 && two <= 77) return '21';
  if (two === 78) return '18';
  if (two === 79) return three === 795 ? '14' : three === 793 || three === 794 ? '17' : three === 796 ? '15' : three === 797 || three === 798 ? '13' : three === 799 ? '16' : '12';
  if (two >= 80 && two <= 85) return three >= 814 && three <= 835 ? '20' : '10';
  return SELLER_STATE_CODE;
}

const GSTIN_RE = /^(\d{2})[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export function checkGstin(g?: string | null): { ok: boolean; stateCode?: string; error?: string } {
  if (!g) return { ok: true };
  const v = g.trim().toUpperCase();
  const m = v.match(GSTIN_RE);
  if (!m) return { ok: false, error: 'GSTIN should be 15 characters, like 33ABCDE1234F1Z5' };
  // checksum (mod 36)
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = chars.indexOf(v[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(val / 36) + (val % 36);
  }
  const check = chars[(36 - (sum % 36)) % 36];
  if (check !== v[14]) return { ok: false, error: 'GSTIN check digit does not match. Please re-check the number.' };
  return { ok: true, stateCode: m[1] };
}

export type TaxLine = { amount: number; gstRate: number };
export type TaxResult = {
  taxable: number; cgst: number; sgst: number; igst: number; total: number; interstate: boolean;
  byRate: { rate: number; taxable: number; tax: number }[]; shippingRate: number;
};

/**
 * GST for an invoice/order. Shipping follows the rate of the principal (largest) line, as a composite supply.
 * Intra-state (buyer state = Tamil Nadu): CGST + SGST, half each. Otherwise IGST.
 */
export function computeTax(lines: TaxLine[], shipping: number, discount: number, buyerStateCode?: string | null): TaxResult {
  const interstate = (buyerStateCode || SELLER_STATE_CODE) !== SELLER_STATE_CODE;
  const gross = lines.reduce((a, l) => a + l.amount, 0);
  const principal = lines.reduce((a, l) => (l.amount > a.amount ? l : a), lines[0] || { amount: 0, gstRate: 18 });
  const shippingRate = principal.gstRate;
  const map = new Map<number, number>();
  for (const l of lines) {
    const share = gross > 0 ? (l.amount / gross) * discount : 0; // discount spread pro-rata
    map.set(l.gstRate, (map.get(l.gstRate) || 0) + l.amount - share);
  }
  if (shipping > 0) map.set(shippingRate, (map.get(shippingRate) || 0) + shipping);
  const byRate = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rate, taxable]) => ({ rate, taxable: round2(taxable), tax: round2((taxable * rate) / 100) }));
  const taxable = round2(byRate.reduce((a, r) => a + r.taxable, 0));
  let cgst = 0, sgst = 0, igst = 0;
  for (const r of byRate) {
    if (interstate) igst += r.tax;
    else { const half = round2(r.tax / 2); cgst += half; sgst += round2(r.tax - half); }
  }
  cgst = round2(cgst); sgst = round2(sgst); igst = round2(igst);
  return { taxable, cgst, sgst, igst, total: round2(taxable + cgst + sgst + igst), interstate, byRate, shippingRate };
}

/** Indian financial year label for a date, e.g. 26-27 for Nov 2026. */
export function fyLabel(d = new Date()) {
  const ist = new Date(d.getTime() + 5.5 * 3600000);
  const y = ist.getUTCFullYear(), m = ist.getUTCMonth();
  const start = m >= 3 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
