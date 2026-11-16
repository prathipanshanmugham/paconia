import { db } from './db';
import { DEFAULT_PRICING, type PricingSettings } from './pricing';

export type Business = {
  legalName: string; tradeName: string; gstin: string; address: string; city: string; state: string; stateCode: string; pincode: string;
  phone: string; email: string; whatsapp: string; hours: string;
  bankName: string; bankAccount: string; bankIfsc: string; bankBranch: string; upiId: string;
};
export type Shipping = { tamilNadu: number; otherStates: number; freeAbove: number; pickup: boolean };
export type InvoicePrefs = { prefix: string; creditDays: number; terms: string };

export const DEFAULT_BUSINESS: Business = {
  legalName: 'Triagon Ventures', tradeName: 'Paconia', gstin: '33CQCPV5278D1ZO',
  address: 'No. 518/3, Plot-2, 1st Floor, Kunnathur–Perundurai Road', city: 'Perundurai, Erode', state: 'Tamil Nadu', stateCode: '33', pincode: '638052',
  phone: '63808 02367', email: 'triagonventures@gmail.com', whatsapp: '916380802367', hours: 'Mon–Sat, 9:30 am – 7:00 pm',
  bankName: '', bankAccount: '', bankIfsc: '', bankBranch: '', upiId: '',
};
export const DEFAULT_SHIPPING: Shipping = { tamilNadu: 90, otherStates: 150, freeAbove: 2500, pickup: true };
export const DEFAULT_INVOICE: InvoicePrefs = {
  prefix: 'PAC', creditDays: 15,
  terms: 'Goods printed to an approved proof cannot be returned. Colour may vary slightly from screen. Payment due by the date shown. Subject to Erode jurisdiction.',
};

async function read<T>(key: string, def: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return { ...def, ...((row?.value as object) || {}) } as T;
}

export const getBusiness = () => read<Business>('business', DEFAULT_BUSINESS);
export const getShipping = () => read<Shipping>('shipping', DEFAULT_SHIPPING);
export const getInvoicePrefs = () => read<InvoicePrefs>('invoice', DEFAULT_INVOICE);
export async function getPricing(): Promise<PricingSettings> {
  const row = await db.setting.findUnique({ where: { key: 'pricing' } });
  const v = (row?.value || {}) as Partial<PricingSettings>;
  const d = DEFAULT_PRICING;
  return {
    ...d, ...v,
    sheet: { ...d.sheet, ...(v.sheet || {}) }, clicks: { ...d.clicks, ...(v.clicks || {}) }, lam: { ...d.lam, ...(v.lam || {}) },
    cut: { ...d.cut, ...(v.cut || {}) }, pouch: { ...d.pouch, ...(v.pouch || {}) },
    laser: { ...d.laser, ...(v.laser || {}), cutSpeed: { ...d.laser.cutSpeed, ...(v.laser?.cutSpeed || {}) } },
  };
}
export async function saveSetting(key: string, value: object) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export function shippingFor(s: Shipping, subtotal: number, stateCode: string | null | undefined, fulfilment: 'PICKUP' | 'COURIER') {
  if (fulfilment === 'PICKUP' || subtotal <= 0) return 0;
  if (subtotal >= s.freeAbove) return 0;
  return (stateCode || '33') === '33' ? s.tamilNadu : s.otherStates;
}
