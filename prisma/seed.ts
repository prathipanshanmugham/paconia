/* Seeds settings, the Phase 1 catalogue, stock items, machines and the owner login.
 * With SEED_DEMO=1 it also adds demo staff, customers, orders, quotes, purchases and expenses (only when there are no orders yet). */
import 'dotenv/config';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { db } from '../src/lib/db';
import { MATERIALS, MACHINES, PRODUCTS } from './catalogue';
import { DEFAULT_BUSINESS, DEFAULT_INVOICE, DEFAULT_SHIPPING } from '../src/lib/settings';
import { DEFAULT_PRICING, price, type ProductConfig, type Spec, type MaterialInfo } from '../src/lib/pricing';
import { createOrder, ensureInvoice, recordPayment, startProduction, advanceJob, issueMaterials, type NewItem } from '../src/lib/orders';
import { nextCustomerCode, nextPoNo, nextQuoteNo } from '../src/lib/numbering';
import { computeTax, stateName } from '../src/lib/gst';
import { addDays } from '../src/lib/format';
import type { Session } from '../src/lib/auth';
import type { Prisma } from '../src/generated/prisma/client';

const DAY = 86400000;

async function base() {
  for (const [key, value] of [['business', DEFAULT_BUSINESS], ['shipping', DEFAULT_SHIPPING], ['invoice', DEFAULT_INVOICE], ['pricing', DEFAULT_PRICING]] as const) {
    await db.setting.upsert({ where: { key }, create: { key, value: value as unknown as Prisma.InputJsonValue }, update: {} });
  }
  for (const m of MATERIALS) {
    const data = { name: m.name, category: m.category, uom: m.uom, sheetW: m.sheetW ?? null, sheetH: m.sheetH ?? null, colour: m.colour ?? null, needsWhite: !!m.needsWhite, cost: m.cost, price: m.price, reorderLevel: m.reorderLevel, reorderQty: m.reorderQty };
    await db.material.upsert({ where: { code: m.code }, create: { code: m.code, ...data }, update: {} });
  }
  for (const m of MACHINES) await db.machine.upsert({ where: { code: m.code }, create: m, update: {} });
  for (const [i, p] of PRODUCTS.entries()) {
    const data = { name: p.name, family: p.family, model: p.model, shape: p.shape, hsn: p.hsn, gstRate: p.gstRate, leadDays: p.leadDays, featured: !!p.featured, tagline: p.tagline, description: p.description, config: p.config as unknown as Prisma.InputJsonValue, sort: i };
    await db.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: {} });
  }
  const email = (process.env.OWNER_EMAIL || 'owner@paconia.in').toLowerCase();
  const pass = process.env.OWNER_PASSWORD || 'ChangeMe@123';
  const owner = await db.user.findUnique({ where: { email } });
  if (!owner) {
    await db.user.create({ data: { name: 'Paconia Owner', email, passwordHash: await bcrypt.hash(pass, 10), role: 'OWNER' } });
    console.log(`Owner login created: ${email}`);
  }
  console.log(`Catalogue: ${PRODUCTS.length} products, ${MATERIALS.length} stock items, ${MACHINES.length} machines`);
}

/** Builds a format-valid GSTIN (with correct check digit) for demo customers. */
function demoGstin(body14: string) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) { const v = chars.indexOf(body14[i]) * (i % 2 ? 2 : 1); sum += Math.floor(v / 36) + (v % 36); }
  return body14 + chars[(36 - (sum % 36)) % 36];
}

async function demo() {
  if ((await db.order.count()) > 0) { console.log('Orders already exist, skipping demo data'); return; }
  const pw = await bcrypt.hash('Demo@12345', 10);
  const staff = [
    ['Priya (Manager)', 'manager@paconia.in', 'MANAGER'], ['Arjun (Designer)', 'designer@paconia.in', 'DESIGNER'],
    ['Selvam (Operator)', 'operator@paconia.in', 'OPERATOR'], ['Kavya (Accounts)', 'accounts@paconia.in', 'ACCOUNTS'],
  ] as const;
  for (const [name, email, role] of staff) await db.user.upsert({ where: { email }, create: { name, email, role, passwordHash: pw }, update: {} });
  const manager = await db.user.findUniqueOrThrow({ where: { email: 'manager@paconia.in' } });
  const operator = await db.user.findUniqueOrThrow({ where: { email: 'operator@paconia.in' } });
  const S: Session = { userId: manager.id, role: 'MANAGER', name: manager.name, email: manager.email };
  const OP: Session = { userId: operator.id, role: 'OPERATOR', name: operator.name, email: operator.email };

  // stock on hand + vendors
  const vendors: Record<string, string> = {};
  for (const [key, name, city, phone] of [
    ['media', 'Kovai Label Stock Traders', 'Coimbatore', '98430 12001'], ['paper', 'Erode Paper & Board House', 'Erode', '94430 22110'],
    ['pouch', 'Tiruppur Flexi Pack Supplies', 'Tiruppur', '98942 31190'], ['laser', 'Chennai Acrylic & Wood Sheets', 'Chennai', '99620 44120'],
    ['leather', 'Erode Leather Craft Supplies', 'Erode', '94431 77801'], ['machine', 'Print Machine Spares (Coimbatore)', 'Coimbatore', '98431 66020'],
    ['pack', 'Perundurai Packing Materials', 'Perundurai', '90030 51180'],
  ]) {
    const v = await db.vendor.create({ data: { name, city, phone, contact: 'Sales desk', notes: 'Demo vendor' } });
    vendors[key] = v.id;
  }
  for (const m of MATERIALS) {
    const row = await db.material.update({ where: { code: m.code }, data: { onHand: m.demoOnHand, vendorId: m.vendor ? vendors[m.vendor] : null } });
    await db.stockMove.create({ data: { materialId: row.id, qty: m.demoOnHand, type: 'ADJUST', ref: 'Opening stock', note: 'Opening stock count', userId: S.userId, createdAt: new Date(Date.now() - 40 * DAY) } });
  }

  // customers
  const cust = async (c: { name: string; company?: string; phone: string; email?: string; type?: 'INDIVIDUAL' | 'BUSINESS'; gstin?: string; line1: string; city: string; pincode: string; stateCode: string; creditDays?: number; login?: boolean }) => {
    let userId: string | undefined;
    if (c.login && c.email) userId = (await db.user.create({ data: { name: c.name, email: c.email, phone: c.phone, role: 'CUSTOMER', passwordHash: pw } })).id;
    return db.customer.create({ data: { code: await nextCustomerCode(), userId, type: c.type || 'BUSINESS', name: c.name, company: c.company, phone: c.phone, email: c.email, gstin: c.gstin, line1: c.line1, city: c.city, pincode: c.pincode, stateCode: c.stateCode, state: stateName(c.stateCode), creditDays: c.creditDays || 0, creditLimit: c.creditDays ? 50000 : 0 } });
  };
  const meena = await cust({ name: 'Meena R', company: "Meena's Homemade", phone: '98422 61530', email: 'meena@example.com', line1: '14, Bharathi Park Road, Saibaba Colony', city: 'Coimbatore', pincode: '641011', stateCode: '33', login: true });
  const kongu = await cust({ name: 'Velu S', company: 'Kongu Cold Press Oils', phone: '94431 88210', email: 'velu@kongucoldpress.example', gstin: demoGstin('33AAKFK4521M1Z'), line1: 'SF 22, Kanjikoil Road', city: 'Perundurai', pincode: '638052', stateCode: '33', creditDays: 15 });
  const bhavani = await cust({ name: 'Murugesan T', company: 'Bhavani Weaves', phone: '94427 61120', email: 'orders@bhavaniweaves.example', gstin: demoGstin('33ABCPM7781K1Z'), line1: '8, Kalingarayan Street', city: 'Bhavani', pincode: '638301', stateCode: '33', creditDays: 30 });
  const anna = await cust({ name: 'Kavitha P', company: 'Annapoorna Spices', phone: '98421 50077', email: 'kavitha@annapoorna.example', line1: '22, Thudiyalur Main Road', city: 'Coimbatore', pincode: '641034', stateCode: '33', login: true });
  const rhea = await cust({ name: 'Rhea D', company: 'Rhea Bakes', phone: '98861 04477', email: 'rhea@rheabakes.example', line1: '80 Feet Road, Koramangala', city: 'Bengaluru', pincode: '560034', stateCode: '29', login: true });
  const wedding = await cust({ name: 'Arun K', phone: '97877 12093', type: 'INDIVIDUAL', line1: '5, Brough Road', city: 'Erode', pincode: '638001', stateCode: '33' });
  const sweets = await cust({ name: 'Saravanan K', company: 'Sri Murugan Sweets', phone: '90030 77215', line1: 'Bus Stand Road', city: 'Perundurai', pincode: '638052', stateCode: '33' });
  const knits = await cust({ name: 'Prakash V', company: 'Tiruppur Knit Studio', phone: '98422 90016', email: 'prakash@tupknit.example', gstin: demoGstin('33AADCT9087Q1Z'), line1: 'SF 118, Kangeyam Road', city: 'Tiruppur', pincode: '641604', stateCode: '33', creditDays: 30 });

  // priced items
  const ps = DEFAULT_PRICING;
  const products = await db.product.findMany();
  const mats: Record<string, MaterialInfo> = {};
  for (const m of await db.material.findMany()) mats[m.code] = { code: m.code, name: m.name, price: Number(m.price), uom: m.uom, sheetW: m.sheetW, sheetH: m.sheetH, needsWhite: m.needsWhite, colour: m.colour };
  const item = (slug: string, spec: Spec): NewItem => {
    const p = products.find((x) => x.slug === slug)!;
    const cfg = p.config as unknown as ProductConfig;
    const r = price(p.model, cfg, spec, mats, ps);
    if (!r.ok) throw new Error(`${slug}: ${r.error}`);
    return { productId: p.id, name: p.name, summary: r.summary, spec, qty: r.qty, unitPrice: r.unit, lineTotal: r.total, hsn: p.hsn, gstRate: p.gstRate, leadDays: p.leadDays, estimate: { route: r.route, sheets: r.sheets, ups: r.ups, materials: r.materials, minutes: r.minutes, cut: cfg.cut } };
  };
  const ship = (c: typeof meena) => ({ name: c.company || c.name, phone: c.phone, line1: c.line1 || '', city: c.city || '', state: c.state || '', stateCode: c.stateCode || '33', pincode: c.pincode || '' });

  const updates: { id: string; days: number }[] = [];
  const mk = async (days: number, args: Parameters<typeof createOrder>[0]) => {
    const o = await createOrder(args, S);
    updates.push({ id: o.id, days });
    return o;
  };
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads', 'demo');
  await mkdir(dir, { recursive: true });
  const proof = async (orderId: string, label: string, v = 1, note = 'Artwork placed on the cutline. Please check spelling, colours and size.') => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560"><rect width="800" height="560" fill="#F6F7F4"/><rect x="60" y="60" width="680" height="440" rx="18" fill="#fff" stroke="#00A3D9" stroke-dasharray="10 6" stroke-width="3"/><text x="400" y="250" font-family="Arial" font-size="40" font-weight="700" text-anchor="middle" fill="#13201C">${label}</text><text x="400" y="300" font-family="Arial" font-size="20" text-anchor="middle" fill="#55625D">Proof v${v} · cutline shown in cyan</text></svg>`;
    const name = `proof-${orderId.slice(-6)}-v${v}.svg`;
    await writeFile(path.join(dir, name), svg);
    const f = await db.fileAsset.create({ data: { name, mime: 'image/svg+xml', size: svg.length, path: path.join('demo', name), kind: 'PROOF', orderId } });
    await db.proof.create({ data: { orderId, version: v, fileId: f.id, note, createdById: S.userId } });
    await db.order.update({ where: { id: orderId }, data: { status: 'PROOF_SENT' } });
  };
  const moveTo = async (orderId: string, stage: string) => {
    const items = await db.orderItem.findMany({ where: { orderId }, include: { job: true } });
    for (const it of items) {
      let j = it.job!;
      let guard = 0;
      while (j.stage !== stage && j.stage !== 'DONE' && guard++ < 8) j = await advanceJob(j.id, OP);
    }
  };

  // 1 Website: labels, proof sent
  const o1 = await mk(1, { customerId: meena.id, channel: 'ONLINE', items: [item('product-labels', { size: 3, material: 'PP-WHT', finish: 'gloss', qty: 500 })], fulfilment: 'COURIER', terms: 'PREPAID', ship: ship(meena), shipping: 90 });
  await recordPayment(o1.id, Number(o1.total), 'RAZORPAY', null, 'pay_demo1');
  await proof(o1.id, "Meena's Homemade · mango pickle label");
  // 2 Website: pouches, in production (print)
  const o2 = await mk(3, { customerId: anna.id, channel: 'ONLINE', items: [item('printed-pouches', { size: 1, material: 'PCH-KR', finish: 'none', qty: 250 })], fulfilment: 'COURIER', terms: 'PREPAID', ship: ship(anna), shipping: 0 });
  await recordPayment(o2.id, Number(o2.total), 'RAZORPAY', null, 'pay_demo2');
  await proof(o2.id, 'Annapoorna Spices · sambar powder pouch');
  await db.proof.updateMany({ where: { orderId: o2.id }, data: { status: 'APPROVED', respondedAt: new Date(Date.now() - 2 * DAY) } });
  await startProduction(o2.id, null);
  // 3 Website, Karnataka (IGST): boxes waiting for proof
  const o3 = await mk(0, { customerId: rhea.id, channel: 'ONLINE', items: [item('product-boxes', { size: 1, material: 'BLK-CRD', finish: 'soft', qty: 100 })], fulfilment: 'COURIER', terms: 'PREPAID', ship: ship(rhea), shipping: 0, notes: 'Gold-look logo on lid please, rest plain black.' });
  await recordPayment(o3.id, Number(o3.total), 'RAZORPAY', null, 'pay_demo3');
  // 4 B2B credit: jar labels, ready
  const o4 = await mk(5, { customerId: kongu.id, channel: 'B2B', items: [item('product-labels', { size: 5, material: 'PP-WHT', finish: 'matte', qty: 2500 })], fulfilment: 'PICKUP', terms: 'CREDIT', shipping: 0, skipProof: true });
  await moveTo(o4.id, 'DONE');
  // 5 B2B credit: hang tags dispatched + invoiced, unpaid
  const o5 = await mk(9, { customerId: bhavani.id, channel: 'B2B', items: [item('hang-tags', { size: 0, material: 'KRF-CRD', finish: 'none', qty: 1000, sides: 2, extras: ['string'] })], fulfilment: 'COURIER', terms: 'CREDIT', ship: ship(bhavani), shipping: 90, skipProof: true });
  await moveTo(o5.id, 'DONE');
  await db.order.update({ where: { id: o5.id }, data: { status: 'DISPATCHED', courier: 'ST Courier', awb: 'ST48213377' } });
  await ensureInvoice(o5.id, S);
  // 6 Walk-in: wedding invitations, completed, paid cash
  const o6 = await mk(12, { customerId: wedding.id, channel: 'COUNTER', items: [item('invitations', { size: 0, material: 'TEX-300', finish: 'none', qty: 200, sides: 2, extras: ['envelope'] })], fulfilment: 'PICKUP', terms: 'PREPAID', shipping: 0 });
  await recordPayment(o6.id, 1000, 'UPI', S, 'UPI advance 4471');
  await proof(o6.id, 'Arun weds Divya · invitation');
  await db.proof.updateMany({ where: { orderId: o6.id }, data: { status: 'APPROVED', respondedAt: new Date(Date.now() - 10 * DAY) } });
  await startProduction(o6.id, S);
  await moveTo(o6.id, 'DONE');
  await ensureInvoice(o6.id, S);
  await recordPayment(o6.id, Number(o6.total) - 1000, 'CASH', S, null, 'Balance at pickup');
  await db.order.update({ where: { id: o6.id }, data: { status: 'COMPLETED' } });
  // 7 Walk-in: sweet box sleeves, cutting, pay on pickup
  const o7 = await mk(2, { customerId: sweets.id, channel: 'COUNTER', items: [item('box-sleeves', { size: 2, material: 'CRD-300', finish: 'matte', qty: 500 })], fulfilment: 'PICKUP', terms: 'PAY_ON_PICKUP', shipping: 0, skipProof: true, rush: true });
  await moveTo(o7.id, 'CUT');
  // 8 B2B: tags + cards, changes requested
  const o8 = await mk(4, { customerId: knits.id, channel: 'B2B', items: [item('hang-tags', { size: 1, material: 'BLK-CRD', finish: 'matte', qty: 500, sides: 2, extras: ['eyelet'] }), item('business-cards', { size: 0, material: 'BLK-CRD', finish: 'soft', qty: 200, sides: 2 })], fulfilment: 'COURIER', terms: 'CREDIT', ship: ship(knits), shipping: 90 });
  await proof(o8.id, 'Tiruppur Knit Studio · tag + card');
  await db.proof.updateMany({ where: { orderId: o8.id }, data: { status: 'CHANGES', response: 'Logo should be white, not grey. Please increase phone number size.', respondedAt: new Date(Date.now() - 1 * DAY) } });
  await db.order.update({ where: { id: o8.id }, data: { status: 'CHANGES_REQUESTED' } });
  // 9 Website: stickers completed earlier
  const o9 = await mk(24, { customerId: meena.id, channel: 'ONLINE', items: [item('die-cut-stickers', { size: 0, material: 'PP-WHT', finish: 'gloss', qty: 250 })], fulfilment: 'COURIER', terms: 'PREPAID', ship: ship(meena), shipping: 90, skipProof: true });
  await recordPayment(o9.id, Number(o9.total), 'RAZORPAY', null, 'pay_demo9');
  await moveTo(o9.id, 'DONE');
  await ensureInvoice(o9.id, S);
  await db.order.update({ where: { id: o9.id }, data: { status: 'COMPLETED', courier: 'Professional Couriers', awb: 'PC77120031' } });
  // 10 Walk-in: acrylic sign, ready, paid
  const o10 = await mk(1, { customerId: sweets.id, channel: 'COUNTER', items: [item('acrylic-signs', { size: 1, material: 'ACR-3-GLD', finish: 'engrave', qty: 1, extras: ['standoff'] })], fulfilment: 'PICKUP', terms: 'PREPAID', shipping: 0, skipProof: true });
  await recordPayment(o10.id, Number(o10.total), 'UPI', S, 'UPI 9921');
  await moveTo(o10.id, 'DONE');
  // 11 B2B: leather keychains, laser cutting, materials issued
  const o11 = await mk(2, { customerId: knits.id, channel: 'B2B', items: [item('leather-tags', { size: 0, material: 'LTH-VEG', finish: 'engrave', qty: 100, extras: ['keyring'] })], fulfilment: 'COURIER', terms: 'CREDIT', ship: ship(knits), shipping: 0, skipProof: true });
  const j11 = await db.job.findFirstOrThrow({ where: { orderItem: { orderId: o11.id } } });
  await issueMaterials(j11.id, OP);

  // backdate
  for (const u of updates) {
    const at = new Date(Date.now() - u.days * DAY - 3 * 3600000);
    const o = await db.order.findUniqueOrThrow({ where: { id: u.id }, include: { items: { include: { job: true } } } });
    const dueShift = (d: Date | null) => (d ? new Date(d.getTime() - u.days * DAY) : null);
    await db.order.update({ where: { id: u.id }, data: { placedAt: at, dueDate: dueShift(o.dueDate) } });
    for (const it of o.items) if (it.job) await db.job.update({ where: { id: it.job.id }, data: { createdAt: at, dueDate: dueShift(it.job.dueDate) } });
    await db.payment.updateMany({ where: { orderId: u.id, receivedAt: { gt: at } }, data: { receivedAt: new Date(at.getTime() + 3600000) } });
    await db.invoice.updateMany({ where: { orderId: u.id }, data: { issuedAt: new Date(at.getTime() + Math.min(u.days, 3) * DAY), dueDate: addDays(new Date(at.getTime() + Math.min(u.days, 3) * DAY), o.terms === 'CREDIT' ? 30 : 0) } });
  }

  // enquiries + quotes
  const enq1 = await db.enquiry.create({ data: { name: 'Kavin S', company: 'Nila Naturals', phone: '98421 33190', email: 'kavin@nilanaturals.example', product: 'Printed stand-up pouches', qty: '1,000', details: '250 g brown kraft with window, 3 designs (herbal powders)', status: 'NEW' } });
  await db.enquiry.create({ data: { name: 'Jeyaraj A', company: 'Temple Town Crafts', phone: '97877 21093', product: 'Acrylic name boards & signs', qty: '12', details: 'Shop signage, 450 × 300, gold mirror with standoffs', status: 'CONTACTED' } });
  await db.enquiry.create({ data: { name: 'Harini M', phone: '90433 55120', product: 'Invitations', qty: '300', details: 'Wedding card, black card with white and gold, envelopes', status: 'NEW' } });
  const quoteFor = async (customerId: string, status: 'DRAFT' | 'SENT', lines: NewItem[], enquiryId?: string) => {
    const t = computeTax(lines.map((l) => ({ amount: l.lineTotal, gstRate: l.gstRate })), 0, 0, '33');
    await db.quote.create({
      data: {
        number: await nextQuoteNo(), customerId, status, validUntil: addDays(new Date(), 15), enquiryId, subtotal: t.taxable, taxable: t.taxable, cgst: t.cgst, sgst: t.sgst, igst: t.igst, total: t.total, createdById: S.userId,
        lines: { create: lines.map((l, i) => ({ productId: l.productId, name: l.name, summary: l.summary, spec: l.spec as Prisma.InputJsonValue, qty: l.qty, unitPrice: l.unitPrice, lineTotal: l.lineTotal, hsn: l.hsn, gstRate: l.gstRate, sort: i })) },
      },
    });
  };
  await quoteFor(kongu.id, 'SENT', [item('product-labels', { size: 5, material: 'PP-WHT', finish: 'matte', qty: 5000 })]);
  await quoteFor(bhavani.id, 'DRAFT', [item('box-sleeves', { size: 0, material: 'KRF-CRD', finish: 'none', qty: 1000 }), item('thank-you-cards', { size: 1, material: 'KRF-CRD', finish: 'none', qty: 1000 })]);
  const nila = await cust({ name: 'Kavin S', company: 'Nila Naturals', phone: '98421 33190', email: 'kavin@nilanaturals.example', line1: 'Ganapathy', city: 'Coimbatore', pincode: '641006', stateCode: '33' });
  await quoteFor(nila.id, 'SENT', [item('printed-pouches', { size: 1, material: 'PCH-KR', finish: 'none', qty: 1000 })], enq1.id);
  await db.enquiry.update({ where: { id: enq1.id }, data: { status: 'QUOTED', customerId: nila.id } });

  // purchases
  const poLine = async (code: string, qty: number) => { const m = await db.material.findUniqueOrThrow({ where: { code } }); return { materialId: m.id, qty, rate: Number(m.cost), gstRate: 18 }; };
  const mkPo = async (vendor: string, status: 'ORDERED' | 'RECEIVED' | 'DRAFT', lines: { materialId: string; qty: number; rate: number; gstRate: number }[], days: number) => {
    const sub = lines.reduce((a, l) => a + l.qty * l.rate, 0), gst = lines.reduce((a, l) => a + (l.qty * l.rate * l.gstRate) / 100, 0);
    await db.purchaseOrder.create({ data: { number: await nextPoNo(), vendorId: vendors[vendor], status, orderedAt: status === 'DRAFT' ? null : new Date(Date.now() - days * DAY), expectedAt: new Date(Date.now() + 3 * DAY), receivedAt: status === 'RECEIVED' ? new Date(Date.now() - (days - 3) * DAY) : null, subtotal: sub, gst, total: sub + gst, lines: { create: lines.map((l) => ({ ...l, receivedQty: status === 'RECEIVED' ? l.qty : 0 })) } } });
  };
  await mkPo('paper', 'RECEIVED', [await poLine('CRD-350', 1000), await poLine('TEX-300', 200)], 18);
  await mkPo('media', 'ORDERED', [await poLine('PP-CLR', 500), await poLine('PP-HOLO', 250)], 2);
  await mkPo('laser', 'DRAFT', [await poLine('ACR-3-GLD', 10)], 0);

  // expenses
  for (const [days, category, description, amount, gst, method] of [
    [16, 'Rent', 'Unit rent, November', 12000, 0, 'BANK'], [12, 'Electricity', 'TNPDCL bill, LM51 three-phase', 3850, 0, 'UPI'],
    [9, 'Internet & phone', 'Broadband + WhatsApp Business number', 899, 162, 'UPI'], [4, 'Courier', 'Courier pickups, week 45', 1240, 223, 'CASH'],
    [3, 'Machine service', 'OKI service visit (drum check)', 2500, 450, 'BANK'],
  ] as const) await db.expense.create({ data: { date: new Date(Date.now() - days * DAY), category, description, amount, gst, method, createdById: S.userId } });

  await db.machine.update({ where: { code: 'OKI-9542' }, data: { lastServiceAt: new Date(Date.now() - 3 * DAY), nextServiceAt: new Date(Date.now() + 57 * DAY) } });
  await db.machine.update({ where: { code: 'CO2-LASER' }, data: { lastServiceAt: new Date(Date.now() - 50 * DAY), nextServiceAt: new Date(Date.now() + 2 * DAY), notes: 'Clean lens and mirrors, check water chiller' } });
  console.log('Demo data added: 4 staff logins, 9 customers, 11 orders, 3 quotes, 3 enquiries, 3 purchase orders, 5 expenses');
  console.log('Demo logins (password Demo@12345): manager@, designer@, operator@, accounts@paconia.in · customer meena@example.com');
}

base()
  .then(() => (process.env.SEED_DEMO === '1' ? demo() : undefined))
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
