'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, requireStaff, type Role } from '@/lib/auth';
import { checkGstin, stateFromPin, stateName } from '@/lib/gst';
import { nextCustomerCode } from '@/lib/numbering';
import { logActivity } from '@/lib/activity';
import { saveSetting, DEFAULT_BUSINESS, DEFAULT_INVOICE } from '@/lib/settings';
import { DEFAULT_PRICING, price, type ProductConfig } from '@/lib/pricing';
import { materialsFor } from '@/lib/catalog';
import { round2 } from '@/lib/format';
import type { FormResult } from '@/components/FormMessage';
import type { PayMethod } from '@/generated/prisma/client';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const numf = (fd: FormData, k: string) => Number(fd.get(k) || 0);

/* ---------- customers ---------- */
const Cust = z.object({
  name: z.string().trim().min(2, 'Enter a name'), phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid mobile'),
  company: z.string().trim().max(120).optional(), email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).optional(),
  gstin: z.string().trim().toUpperCase().optional(), line1: z.string().trim().max(200).optional(), line2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(), pincode: z.union([z.literal(''), z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits')]).optional(),
  stateCode: z.string().optional(), notes: z.string().max(2000).optional(),
  creditDays: z.coerce.number().int().min(0).max(120).optional(), creditLimit: z.coerce.number().min(0).optional(),
});

export async function saveCustomer(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('customers');
  const r = Cust.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  if (f.gstin) { const g = checkGstin(f.gstin); if (!g.ok) return { error: g.error }; }
  const stateCode = f.gstin ? f.gstin.slice(0, 2) : f.stateCode || (f.pincode ? stateFromPin(f.pincode) : '33');
  const money = ['OWNER', 'MANAGER', 'ACCOUNTS'].includes(s.role);
  const data = {
    name: f.name, phone: f.phone, company: f.company || null, email: f.email || null, gstin: f.gstin || null, type: f.company || f.gstin ? 'BUSINESS' as const : 'INDIVIDUAL' as const,
    line1: f.line1 || null, line2: f.line2 || null, city: f.city || null, pincode: f.pincode || null, stateCode, state: stateName(stateCode), notes: f.notes || null,
    ...(money ? { creditDays: f.creditDays ?? 0, creditLimit: f.creditLimit ?? 0 } : {}),
  };
  const id = str(fd, 'id');
  if (id) {
    const c = await db.customer.update({ where: { id }, data });
    await logActivity(s, 'customer', c.id, 'updated');
    revalidatePath(`/desk/customers/${c.code}`);
    return { ok: true, message: 'Saved', t: Date.now() };
  }
  const c = await db.customer.create({ data: { ...data, code: await nextCustomerCode() } });
  await logActivity(s, 'customer', c.id, 'created');
  redirect(`/desk/customers/${c.code}`);
}

/* ---------- accounts ---------- */
export async function addExpense(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('accounts');
  const amount = round2(numf(fd, 'amount')), gst = round2(numf(fd, 'gst'));
  const description = str(fd, 'description'), category = str(fd, 'category');
  if (!description || !category) return { error: 'Enter a category and description' };
  if (!(amount > 0)) return { error: 'Enter the amount' };
  if (gst < 0 || gst > amount) return { error: 'GST must be part of the amount' };
  const method = str(fd, 'method') as PayMethod;
  if (!['CASH', 'UPI', 'CARD', 'BANK', 'CHEQUE'].includes(method)) return { error: 'Choose how it was paid' };
  const date = str(fd, 'date') ? new Date(str(fd, 'date') + 'T12:00:00+05:30') : new Date();
  await db.expense.create({ data: { date, category, description, amount, gst, method, reference: str(fd, 'reference') || null, createdById: s.userId } });
  revalidatePath('/desk/accounts');
  return { ok: true, message: 'Expense added', t: Date.now() };
}

export async function deleteExpense(fd: FormData) {
  const s = await requireStaff('accounts');
  if (!['OWNER', 'MANAGER'].includes(s.role)) return;
  await db.expense.delete({ where: { id: str(fd, 'id') } });
  revalidatePath('/desk/accounts');
}

/* ---------- stock ---------- */
export async function adjustStock(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('stock');
  const m = await db.material.findUnique({ where: { id: str(fd, 'id') } });
  if (!m) return { error: 'Material not found' };
  const mode = str(fd, 'mode');
  const qty = round2(numf(fd, 'qty'));
  if (!(qty > 0) && mode !== 'count') return { error: 'Enter a quantity above zero' };
  const note = str(fd, 'note') || null;
  let delta = qty, type: 'PURCHASE' | 'ADJUST' | 'RETURN' | 'ISSUE' = 'ADJUST';
  if (mode === 'in') type = 'PURCHASE';
  else if (mode === 'out') { delta = -qty; type = 'ISSUE'; }
  else if (mode === 'return') type = 'RETURN';
  else if (mode === 'count') { delta = round2(qty - Number(m.onHand)); if (delta === 0) return { ok: true, message: 'Count matches, nothing changed', t: Date.now() }; }
  else return { error: 'Choose what happened' };
  await db.$transaction([
    db.material.update({ where: { id: m.id }, data: { onHand: { increment: delta } } }),
    db.stockMove.create({ data: { materialId: m.id, qty: delta, type, note: mode === 'count' ? `Stock count: ${qty}${note ? ' · ' + note : ''}` : note, ref: str(fd, 'ref') || null, userId: s.userId } }),
  ]);
  revalidatePath('/desk/stock', 'layout');
  return { ok: true, message: `${delta > 0 ? '+' : ''}${delta} ${m.uom} recorded`, t: Date.now() };
}

export async function saveMaterial(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('stock');
  const id = str(fd, 'id');
  const r = z.object({
    name: z.string().min(2, 'Enter a name'), code: z.string().regex(/^[A-Z0-9-]{2,30}$/, 'Code: capitals, digits and dashes'), category: z.enum(['MEDIA', 'BLANK', 'LASER', 'TONER', 'FILM', 'CONSUMABLE', 'PACKING']),
    uom: z.string().min(1, 'Enter a unit'), cost: z.coerce.number().min(0), price: z.coerce.number().min(0), reorderLevel: z.coerce.number().min(0), reorderQty: z.coerce.number().min(0),
    sheetW: z.coerce.number().int().min(0).optional(), sheetH: z.coerce.number().int().min(0).optional(), colour: z.string().regex(/^(#[0-9A-Fa-f]{6})?$/, 'Colour like #FFFFFF').optional(),
    vendorId: z.string().optional(), needsWhite: z.string().optional(), active: z.string().optional(), notes: z.string().optional(),
  }).safeParse({ ...Object.fromEntries(fd), code: str(fd, 'code').toUpperCase() });
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  const data = { name: f.name, category: f.category, uom: f.uom, cost: f.cost, price: f.price, reorderLevel: f.reorderLevel, reorderQty: f.reorderQty, sheetW: f.sheetW || null, sheetH: f.sheetH || null, colour: f.colour || null, vendorId: f.vendorId || null, needsWhite: f.needsWhite === 'on', active: id ? f.active === 'on' : true, notes: f.notes || null };
  if (id) await db.material.update({ where: { id }, data });
  else {
    if (await db.material.findUnique({ where: { code: f.code } })) return { error: 'That code is already used' };
    await db.material.create({ data: { ...data, code: f.code } });
  }
  await logActivity(s, 'material', f.code, id ? 'updated' : 'created');
  revalidatePath('/desk/stock', 'layout');
  if (!id) redirect(`/desk/stock/${f.code}`);
  return { ok: true, message: 'Saved', t: Date.now() };
}

export async function saveVendor(_p: FormResult, fd: FormData): Promise<FormResult> {
  await requireStaff('stock');
  const name = str(fd, 'name');
  if (name.length < 2) return { error: 'Enter the vendor name' };
  const gstin = str(fd, 'gstin').toUpperCase();
  if (gstin) { const g = checkGstin(gstin); if (!g.ok) return { error: g.error }; }
  const data = { name, contact: str(fd, 'contact') || null, phone: str(fd, 'phone') || null, email: str(fd, 'email') || null, gstin: gstin || null, city: str(fd, 'city') || null, address: str(fd, 'address') || null, notes: str(fd, 'notes') || null };
  const id = str(fd, 'id');
  if (id) await db.vendor.update({ where: { id }, data }); else await db.vendor.create({ data });
  revalidatePath('/desk/stock', 'layout');
  return { ok: true, message: id ? 'Vendor saved' : 'Vendor added', t: Date.now() };
}

/* ---------- catalogue & pricing ---------- */
export async function saveProduct(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('catalogue');
  const p = await db.product.findUnique({ where: { id: str(fd, 'id') } });
  if (!p) return { error: 'Product not found' };
  let cfg: ProductConfig;
  try { cfg = JSON.parse(str(fd, 'config')); } catch { return { error: 'The options JSON is not valid. Check commas and brackets.' }; }
  if (!Array.isArray(cfg.sizes) || !cfg.sizes.length || !Array.isArray(cfg.materials) || !cfg.materials.length || !Array.isArray(cfg.finishes) || !Array.isArray(cfg.qtyTiers)) return { error: 'Options need sizes, materials, finishes and qtyTiers' };
  const mats = await materialsFor(cfg);
  const test = price(p.model, cfg, { size: 0, material: cfg.materials[0], finish: cfg.finishes[0], qty: cfg.qtyTiers[0], sides: 1, extras: [] }, mats, DEFAULT_PRICING);
  if (!test.ok) return { error: `Test price failed: ${test.error}` };
  const gstRate = numf(fd, 'gstRate');
  if (![0, 5, 12, 18, 28].includes(gstRate)) return { error: 'GST rate must be 0, 5, 12, 18 or 28' };
  if (!/^\d{4,8}$/.test(str(fd, 'hsn'))) return { error: 'HSN must be 4–8 digits' };
  await db.product.update({ where: { id: p.id }, data: {
    name: str(fd, 'name') || p.name, tagline: str(fd, 'tagline'), description: str(fd, 'description'), hsn: str(fd, 'hsn'), gstRate,
    leadDays: Math.max(1, Math.min(30, Math.floor(numf(fd, 'leadDays')) || p.leadDays)), sort: Math.floor(numf(fd, 'sort')), active: fd.get('active') === 'on', featured: fd.get('featured') === 'on', config: cfg as object,
  } });
  await logActivity(s, 'product', p.id, 'updated', p.name);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Product saved', t: Date.now() };
}

export async function savePricing(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('catalogue');
  if (!['OWNER', 'MANAGER'].includes(s.role)) return { error: 'Only the owner or a manager can change rates' };
  const g = (k: string) => { const v = Number(fd.get(k)); if (!(v >= 0) || !isFinite(v)) throw new Error(`Check “${k}”`); return v; };
  try {
    const ps = {
      sheet: { w: g('sheet.w'), h: g('sheet.h'), margin: g('sheet.margin'), regMargin: g('sheet.regMargin') },
      clicks: { cmyk: g('clicks.cmyk'), white: g('clicks.white') },
      lam: { gloss: g('lam.gloss'), matte: g('lam.matte'), soft: g('lam.soft') },
      cut: { kiss: g('cut.kiss'), through: g('cut.through'), guillotine: g('cut.guillotine'), crease: g('cut.crease') },
      laser: { perMinute: g('laser.perMinute'), engraveCm2PerMin: g('laser.engraveCm2PerMin'), engraveFill: g('laser.engraveFill'), setup: g('laser.setup'), cutSpeed: { ACR: g('laser.cutSpeed.ACR'), MDF: g('laser.cutSpeed.MDF'), PLY: g('laser.cutSpeed.PLY'), LTH: g('laser.cutSpeed.LTH') } },
      pouch: { print: g('pouch.print'), white: g('pouch.white'), setup: g('pouch.setup'), wastePct: g('pouch.wastePct') },
      setupFee: g('setupFee'), setupSheets: g('setupSheets'), wastePct: g('wastePct'), minLine: g('minLine'),
      costs: {
        clickCmyk: g('costs.clickCmyk'), clickWhite: g('costs.clickWhite'),
        lam: { gloss: g('costs.lam.gloss'), matte: g('costs.lam.matte'), soft: g('costs.lam.soft') },
        cut: { kiss: g('costs.cut.kiss'), through: g('costs.cut.through'), guillotine: g('costs.cut.guillotine'), crease: g('costs.cut.crease') },
        laserPerMinute: g('costs.laserPerMinute'), pouchPrint: g('costs.pouchPrint'), pouchWhite: g('costs.pouchWhite'), setup: g('costs.setup'),
      },
      targetMargin: g('targetMargin'), minMargin: g('minMargin'),
    };
    if (ps.targetMargin > 90 || ps.minMargin > ps.targetMargin) throw new Error('Minimum margin must be below the target margin, and both under 90%');
    if (ps.sheet.w < 100 || ps.sheet.h < 100) throw new Error('Sheet size looks wrong');
    if (ps.laser.engraveCm2PerMin <= 0 || Object.values(ps.laser.cutSpeed).some((v) => v <= 0)) throw new Error('Laser speeds must be above zero');
    await saveSetting('pricing', ps);
  } catch (e) { return { error: (e as Error).message }; }
  await logActivity(s, 'settings', 'pricing', 'rates updated');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Rates saved. Website prices update now.', t: Date.now() };
}

/* ---------- settings ---------- */
export async function saveBusiness(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('settings');
  const v = Object.fromEntries(Object.keys(DEFAULT_BUSINESS).map((k) => [k, str(fd, k)]));
  if (v.gstin) { const g = checkGstin(v.gstin.toUpperCase()); if (!g.ok) return { error: g.error }; v.gstin = v.gstin.toUpperCase(); }
  if (!v.legalName || !v.phone) return { error: 'Legal name and phone are required' };
  v.whatsapp = v.whatsapp.replace(/\D/g, '');
  await saveSetting('business', v);
  const ship = { tamilNadu: numf(fd, 'ship.tamilNadu'), otherStates: numf(fd, 'ship.otherStates'), freeAbove: numf(fd, 'ship.freeAbove'), pickup: true };
  if ([ship.tamilNadu, ship.otherStates, ship.freeAbove].some((n) => !(n >= 0))) return { error: 'Check the shipping amounts' };
  await saveSetting('shipping', ship);
  const prefix = str(fd, 'inv.prefix').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || DEFAULT_INVOICE.prefix;
  await saveSetting('invoice', { prefix, creditDays: Math.max(0, Math.floor(numf(fd, 'inv.creditDays'))) || DEFAULT_INVOICE.creditDays, terms: str(fd, 'inv.terms') || DEFAULT_INVOICE.terms });
  await logActivity(s, 'settings', 'business', 'updated');
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved', t: Date.now() };
}


export async function saveUser(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('users');
  const id = str(fd, 'id');
  const role = str(fd, 'role') as Role;
  if (!['OWNER', 'MANAGER', 'DESIGNER', 'OPERATOR', 'ACCOUNTS'].includes(role)) return { error: 'Choose a role' };
  const password = str(fd, 'password');
  if (password && password.length < 8) return { error: 'Password must be at least 8 characters' };
  if (id) {
    if (id === s.userId && (role !== 'OWNER' || fd.get('active') !== 'on')) return { error: 'You cannot remove your own owner access' };
    await db.user.update({ where: { id }, data: { role, active: fd.get('active') === 'on', name: str(fd, 'name') || undefined, phone: str(fd, 'phone') || null, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
    await logActivity(s, 'user', id, 'updated', role);
    revalidatePath('/desk/settings');
    return { ok: true, message: 'User saved', t: Date.now() };
  }
  const email = str(fd, 'email').toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a valid email' };
  if (!password) return { error: 'Set a starting password' };
  if (await db.user.findUnique({ where: { email } })) return { error: 'A user with this email exists' };
  const u = await db.user.create({ data: { email, name: str(fd, 'name') || email, phone: str(fd, 'phone') || null, role, passwordHash: await hashPassword(password) } });
  await logActivity(s, 'user', u.id, 'created', role);
  revalidatePath('/desk/settings');
  return { ok: true, message: `${u.name} can now sign in`, t: Date.now() };
}

export async function saveMachine(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await requireStaff('settings');
  const status = str(fd, 'status') as 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
  if (!['ACTIVE', 'MAINTENANCE', 'RETIRED'].includes(status)) return { error: 'Choose a status' };
  const d = (k: string) => (str(fd, k) ? new Date(str(fd, k) + 'T12:00:00+05:30') : null);
  const m = await db.machine.update({ where: { id: str(fd, 'id') }, data: { status, lastServiceAt: d('lastServiceAt'), nextServiceAt: d('nextServiceAt'), notes: str(fd, 'notes') || null, specs: str(fd, 'specs') || null } });
  await logActivity(s, 'machine', m.id, 'updated', status);
  revalidatePath('/desk', 'layout');
  return { ok: true, message: 'Saved', t: Date.now() };
}
