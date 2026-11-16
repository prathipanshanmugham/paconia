'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { clearSession, createSession, getSession, hashPassword, isStaff, verifyPassword, type Role } from '@/lib/auth';
import { nextCustomerCode } from '@/lib/numbering';
import { logActivity } from '@/lib/activity';
import type { FormResult } from '@/components/FormMessage';

const safeNext = (n: unknown) => (typeof n === 'string' && /^\/[^/\\]/.test(n) && !n.includes('\\') ? n : null);

const FAILS = new Map<string, { n: number; until: number }>();
const WINDOW = 15 * 60 * 1000, LIMIT = 8;

export async function signIn(_p: FormResult, fd: FormData): Promise<FormResult> {
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const password = String(fd.get('password') || '');
  if (!email || !password) return { error: 'Enter your email and password' };
  const f = FAILS.get(email);
  if (f && f.n >= LIMIT && f.until > Date.now()) return { error: 'Too many attempts. Wait 15 minutes, or ask the owner to reset your password.' };
  const u = await db.user.findUnique({ where: { email } });
  if (!u || !u.active || !(await verifyPassword(password, u.passwordHash))) {
    const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + WINDOW };
    FAILS.set(email, { n: cur.n + 1, until: cur.until });
    return { error: 'That email and password do not match' };
  }
  FAILS.delete(email);
  await createSession({ userId: u.id, role: u.role as Role, name: u.name, email: u.email });
  if (isStaff(u.role as Role)) await logActivity({ userId: u.id, role: u.role as Role, name: u.name, email: u.email }, 'user', u.id, 'signed in');
  redirect(safeNext(fd.get('next')) || (isStaff(u.role as Role) ? '/desk' : '/account'));
}

const SignUp = z.object({
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{8,15}$/, 'Enter a valid mobile number'),
  password: z.string().min(8, 'Use at least 8 characters for your password'),
  company: z.string().trim().max(120).optional(),
});

export async function signUp(_p: FormResult, fd: FormData): Promise<FormResult> {
  const r = SignUp.safeParse(Object.fromEntries(fd));
  if (!r.success) return { error: r.error.issues[0].message };
  const f = r.data;
  if (await db.user.findUnique({ where: { email: f.email } })) return { error: 'An account with this email already exists. Please sign in.' };
  const u = await db.user.create({ data: { name: f.name, email: f.email, phone: f.phone, passwordHash: await hashPassword(f.password), role: 'CUSTOMER' } });
  // A new login always gets its own customer record. Linking to an existing walk-in record by phone or email would
  // expose that customer's orders to anyone who knows their number, so staff link records by hand if needed.
  await db.customer.create({ data: { code: await nextCustomerCode(), userId: u.id, name: f.name, phone: f.phone, email: f.email, company: f.company || null, type: f.company ? 'BUSINESS' : 'INDIVIDUAL' } });
  await createSession({ userId: u.id, role: 'CUSTOMER', name: u.name, email: u.email });
  redirect(safeNext(fd.get('next')) || '/account');
}

export async function signOut() {
  clearSession();
  redirect('/');
}

export async function changePassword(_p: FormResult, fd: FormData): Promise<FormResult> {
  const s = await getSession();
  if (!s) return { error: 'Please sign in again' };
  const cur = String(fd.get('current') || ''), next = String(fd.get('next') || '');
  if (next.length < 8) return { error: 'Use at least 8 characters for the new password' };
  const u = await db.user.findUniqueOrThrow({ where: { id: s.userId } });
  if (!(await verifyPassword(cur, u.passwordHash))) return { error: 'Your current password is not correct' };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true, message: 'Password changed', t: Date.now() };
}
