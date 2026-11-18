'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { isStaff, requireStaff, type Role } from '@/lib/auth';
import { newKey } from '@/lib/mcp/server';
import { logActivity } from '@/lib/activity';

export type KeyResult = { error?: string; key?: string; name?: string; t?: number } | null;

export async function createApiKey(_p: KeyResult, fd: FormData): Promise<KeyResult> {
  const s = await requireStaff('users');
  const name = String(fd.get('name') || '').trim().slice(0, 60);
  const userId = String(fd.get('userId') || '');
  const access = fd.get('access') === 'WRITE' ? 'WRITE' : 'READ';
  if (name.length < 2) return { error: 'Name the key, e.g. “Claude for Prathipan”' };
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u || !u.active || !isStaff(u.role as Role)) return { error: 'Choose an active team member for the key to act as' };
  const k = newKey();
  await db.apiKey.create({ data: { name, prefix: k.prefix, hash: k.hash, access, userId: u.id, createdBy: s.userId } });
  await logActivity(s, 'user', u.id, 'AI key created', `${name} · ${access === 'WRITE' ? 'read and write' : 'read only'} · acts as ${u.name}`);
  revalidatePath('/desk/settings');
  return { key: k.key, name, t: Date.now() };
}

export async function revokeApiKey(fd: FormData) {
  const s = await requireStaff('users');
  const k = await db.apiKey.update({ where: { id: String(fd.get('id')) }, data: { revokedAt: new Date() } });
  await logActivity(s, 'user', k.userId, 'AI key revoked', k.name);
  revalidatePath('/desk/settings');
}
