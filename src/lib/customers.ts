import { z } from 'zod';
import { db } from './db';
import { checkGstin, stateFromPin, stateName } from './gst';
import { nextCustomerCode } from './numbering';

const NewCust = z.object({
  name: z.string().trim().min(2, 'Enter the customer name'), phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid customer mobile'),
  company: z.string().trim().optional(), email: z.union([z.literal(''), z.string().trim().email('Enter a valid customer email')]).optional(),
  gstin: z.string().trim().toUpperCase().optional(), line1: z.string().trim().optional(), city: z.string().trim().optional(), pincode: z.string().trim().optional(),
});
const CustRef = z.union([z.object({ id: z.string().min(1, 'Pick a customer') }), z.object({ new: NewCust })]);

/** Finds or creates the customer chosen in the line builder. Matches an existing record by phone to avoid duplicates. */
export async function resolveCustomer(ref: unknown): Promise<{ id: string } | { error: string }> {
  const r = CustRef.safeParse(ref);
  if (!r.success) return { error: r.error.issues[0].message === 'Required' ? 'Pick a customer or add a new one' : r.error.issues[0].message };
  if ('id' in r.data) {
    const c = await db.customer.findUnique({ where: { id: r.data.id } });
    return c ? { id: c.id } : { error: 'Customer not found' };
  }
  const n = r.data.new;
  if (n.gstin) { const g = checkGstin(n.gstin); if (!g.ok) return { error: g.error! }; }
  if (n.pincode && !/^\d{6}$/.test(n.pincode)) return { error: 'Pincode must be 6 digits' };
  const digits = n.phone.replace(/\D/g, '').slice(-10);
  const existing = (await db.customer.findMany({ where: { phone: { contains: digits.slice(-6) } } })).find((c) => c.phone.replace(/\D/g, '').slice(-10) === digits);
  if (existing) return { id: existing.id };
  const stateCode = n.gstin ? n.gstin.slice(0, 2) : n.pincode ? stateFromPin(n.pincode) : '33';
  const c = await db.customer.create({
    data: { code: await nextCustomerCode(), name: n.name, phone: n.phone, company: n.company || null, email: n.email || null, gstin: n.gstin || null, type: n.company || n.gstin ? 'BUSINESS' : 'INDIVIDUAL', line1: n.line1 || null, city: n.city || null, pincode: n.pincode || null, stateCode, state: stateName(stateCode) },
  });
  return { id: c.id };
}
