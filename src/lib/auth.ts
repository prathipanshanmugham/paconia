import { cache } from 'react';
import { db } from './db';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';

export type Role = 'CUSTOMER' | 'OWNER' | 'MANAGER' | 'DESIGNER' | 'OPERATOR' | 'ACCOUNTS';
export type Session = { userId: string; role: Role; name: string; email: string };
export type Area = 'today' | 'orders' | 'production' | 'quotes' | 'customers' | 'accounts' | 'stock' | 'catalogue' | 'tools' | 'settings' | 'users';

const COOKIE = 'pc_session';
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s || 'dev-secret-change-me');
};

export const STAFF_ROLES: Role[] = ['OWNER', 'MANAGER', 'DESIGNER', 'OPERATOR', 'ACCOUNTS'];
export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Customer', OWNER: 'Owner', MANAGER: 'Manager', DESIGNER: 'Designer', OPERATOR: 'Machine operator', ACCOUNTS: 'Accounts',
};

const ACCESS: Record<Exclude<Role, 'CUSTOMER'>, Area[]> = {
  OWNER: ['today', 'orders', 'production', 'quotes', 'customers', 'accounts', 'stock', 'catalogue', 'tools', 'settings', 'users'],
  MANAGER: ['today', 'orders', 'production', 'quotes', 'customers', 'accounts', 'stock', 'catalogue', 'tools', 'settings'],
  DESIGNER: ['today', 'orders', 'production', 'quotes', 'customers', 'tools'],
  OPERATOR: ['today', 'orders', 'production', 'stock', 'tools'],
  ACCOUNTS: ['today', 'orders', 'quotes', 'customers', 'accounts', 'stock', 'tools'],
};
export const can = (role: Role | undefined, area: Area) => !!role && role !== 'CUSTOMER' && ACCESS[role].includes(area);
export const isStaff = (role?: Role) => !!role && role !== 'CUSTOMER';

export async function createSession(s: Session) {
  const token = await new SignJWT(s).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && !process.env.INSECURE_COOKIES, path: '/', maxAge: 60 * 60 * 24 * 30 });
}
export function clearSession() { cookies().delete(COOKIE); }

/** Reads the signed cookie, then re-checks the user in the database so a deactivated login or a changed role applies at once. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const u = await db.user.findUnique({ where: { id: String(payload.userId) }, select: { id: true, role: true, name: true, email: true, active: true } });
    if (!u || !u.active) return null;
    return { userId: u.id, role: u.role as Role, name: u.name, email: u.email };
  } catch {
    return null;
  }
});

export async function requireUser(next?: string) {
  const s = await getSession();
  if (!s) redirect(`/signin${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return s;
}

/** Staff gate for /desk pages and actions. Pass the area the page belongs to. */
export async function requireStaff(area: Area = 'today') {
  const s = await getSession();
  if (!s) redirect('/signin?next=/desk');
  if (!isStaff(s.role)) redirect('/account');
  if (!can(s.role, area)) redirect('/desk?denied=' + area);
  return s;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 10);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);
