import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { ProfileForm, PasswordForm } from '@/components/site/ProfileForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My details' };

export default async function Profile() {
  const s = await requireUser('/account/profile');
  const u = await db.user.findUniqueOrThrow({ where: { id: s.userId }, include: { customer: true } });
  const c = u.customer;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="card-pad">
        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="mb-5 text-sm text-ink-soft">Used for delivery and on your GST invoices. Signed in as {u.email}.</p>
        <ProfileForm p={{ name: c?.name || u.name, phone: c?.phone || u.phone || '', company: c?.company || '', gstin: c?.gstin || '', line1: c?.line1 || '', line2: c?.line2 || '', city: c?.city || '', pincode: c?.pincode || '' }} />
      </section>
      <section className="card-pad h-fit">
        <h2 className="mb-4 text-lg font-semibold">Password</h2>
        <PasswordForm />
        {c && c.creditDays > 0 && <p className="mt-6 rounded-lg bg-leaf-50 p-3 text-sm">Your business account can order on {c.creditDays}-day credit.</p>}
      </section>
    </div>
  );
}
