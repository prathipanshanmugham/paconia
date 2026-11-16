import { db } from './db';
import type { Session } from './auth';

export async function logActivity(s: Session | null, entity: string, entityId: string, action: string, detail?: string) {
  await db.activity.create({ data: { userId: s?.userId ?? null, userName: s?.name ?? 'System', entity, entityId, action, detail: detail ?? null } }).catch(() => {});
}
