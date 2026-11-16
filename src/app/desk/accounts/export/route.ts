import { NextRequest, NextResponse } from 'next/server';
import { can, getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { monthRange } from '@/lib/period';
import { gstSummary } from '@/lib/gstReport';
import { isoDate, num } from '@/lib/format';

const csv = (rows: (string | number | null | undefined)[][]) => rows.map((r) => r.map((v) => { let s = v === null || v === undefined ? '' : String(v); if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');

/** CSV exports for the accountant: ?type=invoices|hsn|payments|expenses&month=YYYY-MM */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !can(s.role, 'accounts')) return new NextResponse('Not allowed', { status: 403 });
  const p = monthRange(req.nextUrl.searchParams.get('month'));
  const type = req.nextUrl.searchParams.get('type') || 'invoices';
  let body = '';
  if (type === 'invoices' || type === 'hsn') {
    const g = await gstSummary(p.start, p.end);
    body = type === 'invoices'
      ? csv([['Invoice', 'Date', 'Customer', 'GSTIN', 'Place of supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'], ...g.invoices.map((i) => [i.number, isoDate(i.issuedAt), i.billName, i.billGstin, i.placeOfSupply, num(i.taxable).toFixed(2), num(i.cgst).toFixed(2), num(i.sgst).toFixed(2), num(i.igst).toFixed(2), num(i.total).toFixed(2)])])
      : csv([['HSN', 'GST rate %', 'Quantity', 'Taxable value', 'Tax'], ...g.hsn.map((h) => [h.hsn, h.rate, h.qty, h.taxable.toFixed(2), h.tax.toFixed(2)])]);
  } else if (type === 'payments') {
    const rows = await db.payment.findMany({ where: { receivedAt: { gte: p.start, lt: p.end } }, include: { customer: true, order: true }, orderBy: { receivedAt: 'asc' } });
    body = csv([['Receipt', 'Date', 'Customer', 'Order', 'Method', 'Reference', 'Amount'], ...rows.map((r) => [r.number, isoDate(r.receivedAt), r.customer.company || r.customer.name, r.order?.number, r.method, r.reference, num(r.amount).toFixed(2)])]);
  } else if (type === 'expenses') {
    const rows = await db.expense.findMany({ where: { date: { gte: p.start, lt: p.end } }, orderBy: { date: 'asc' } });
    body = csv([['Date', 'Category', 'Description', 'Method', 'Reference', 'Amount', 'GST included'], ...rows.map((r) => [isoDate(r.date), r.category, r.description, r.method, r.reference, num(r.amount).toFixed(2), num(r.gst).toFixed(2)])]);
  } else return new NextResponse('Unknown export', { status: 400 });
  return new NextResponse('﻿' + body, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="paconia-${type}-${p.ym}.csv"`, 'Cache-Control': 'no-store' } });
}
