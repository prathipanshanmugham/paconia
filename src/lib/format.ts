export const num = (n: unknown): number => {
  if (n === null || n === undefined || n === '') return 0;
  const v = Number(typeof n === 'object' ? String(n) : n);
  return Number.isFinite(v) ? v : 0;
};
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const f0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (n: unknown) => f0.format(num(n));
export const inr2 = (n: unknown) => f2.format(num(n));
export const qtyFmt = (n: unknown, d = 0) => num(n).toLocaleString('en-IN', { maximumFractionDigits: d });

export const dateFmt = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—';
export const dateShort = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '—';
export const dateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '—';
export const isoDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600000).toISOString().slice(0, 10);

export function ago(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export const plural = (n: number, w: string, p?: string) => `${n} ${n === 1 ? w : p || w + 's'}`;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Adds working days (Mon–Sat; Paconia works six days). */
export function addWorkingDays(d: Date, n: number) {
  const x = new Date(d);
  let left = n;
  while (left > 0) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() !== 0) left--;
  }
  return x;
}

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
export const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Indian-system amount in words, with paise. */
export function amountInWords(n: number) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x: number) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const rupees = Math.floor(round2(n));
  const paise = Math.round((round2(n) - rupees) * 100);
  let r = rupees;
  const out: string[] = [];
  const cr = Math.floor(r / 1e7); r %= 1e7;
  const lk = Math.floor(r / 1e5); r %= 1e5;
  const th = Math.floor(r / 1000); r %= 1000;
  if (cr) out.push(three(cr) + ' Crore');
  if (lk) out.push(two(lk) + ' Lakh');
  if (th) out.push(two(th) + ' Thousand');
  if (r) out.push(three(r));
  return 'Rupees ' + (out.join(' ') || 'Zero') + (paise ? ' and ' + two(paise) + ' Paise' : '') + ' only';
}
