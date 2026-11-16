import { db } from './db';
import { allMaterialInfo } from './catalog';
import { getPricing, getShipping } from './settings';
import type { ProductConfig } from './pricing';
import type { CustomerLite, ProductLite } from '@/components/desk/LineBuilder';

/** Everything the Desk line builder needs, loaded once per page. */
export async function lineBuilderData() {
  const [products, customers, mats, ps, shipping] = await Promise.all([
    db.product.findMany({ where: { active: true }, orderBy: [{ family: 'asc' }, { sort: 'asc' }] }),
    db.customer.findMany({ orderBy: { createdAt: 'desc' }, take: 2000 }),
    allMaterialInfo(), getPricing(), getShipping(),
  ]);
  return {
    products: products.map((p): ProductLite => ({ id: p.id, name: p.name, family: p.family, model: p.model, hsn: p.hsn, gstRate: p.gstRate, leadDays: p.leadDays, config: p.config as unknown as ProductConfig })),
    customers: customers.map((c): CustomerLite => ({ id: c.id, code: c.code, name: c.name, company: c.company, phone: c.phone, gstin: c.gstin, stateCode: c.stateCode, creditDays: c.creditDays, line1: c.line1, city: c.city, pincode: c.pincode })),
    mats, ps, shipping: { tamilNadu: shipping.tamilNadu, otherStates: shipping.otherStates, freeAbove: shipping.freeAbove },
  };
}
