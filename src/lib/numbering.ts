import { db } from './db';
import { fyLabel } from './gst';

async function bump(key: string, start: number) {
  const c = await db.counter.upsert({ where: { key }, create: { key, value: start }, update: { value: { increment: 1 } } });
  return c.value;
}

export const nextOrderNo = async () => `PAC-${await bump('order', 1001)}`;
export const nextJobNo = async () => `JOB-${await bump('job', 1001)}`;
export const nextQuoteNo = async () => `QT-${await bump('quote', 501)}`;
export const nextCustomerCode = async () => `C-${String(await bump('customer', 1)).padStart(4, '0')}`;
export const nextPoNo = async () => `PO-${await bump('po', 101)}`;
export const nextReceiptNo = async () => `RCPT-${await bump('receipt', 1001)}`;
export async function nextInvoiceNo(prefix = 'PAC') {
  const fy = fyLabel();
  const n = await bump(`invoice-${fy}`, 1);
  return `${prefix}/${fy}/${String(n).padStart(4, '0')}`;
}
