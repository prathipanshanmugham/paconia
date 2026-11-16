import { mkdir, writeFile, readFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from './db';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
export const MAX_UPLOAD = 40 * 1024 * 1024;

const OK_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'svg', 'ai', 'eps', 'psd', 'cdr', 'tif', 'tiff', 'zip'];

export function checkUpload(f: File): string | null {
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  if (!OK_EXT.includes(ext)) return `${f.name}: please upload PDF, AI, EPS, PSD, CDR, SVG, PNG, JPG, TIFF or ZIP`;
  if (f.size > MAX_UPLOAD) return `${f.name}: files must be under 40 MB`;
  if (f.size === 0) return `${f.name}: the file is empty`;
  return null;
}

export async function storeFile(f: File, meta: { kind?: string; uploadedById?: string | null; cartToken?: string | null; orderId?: string | null; orderItemId?: string | null }) {
  const ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const day = new Date().toISOString().slice(0, 7);
  const dir = path.join(UPLOAD_DIR, day);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await f.arrayBuffer()));
  return db.fileAsset.create({
    data: {
      name: f.name.slice(0, 180), mime: f.type || 'application/octet-stream', size: f.size, path: path.join(day, name),
      kind: meta.kind || 'ARTWORK', uploadedById: meta.uploadedById ?? null, cartToken: meta.cartToken ?? null, orderId: meta.orderId ?? null, orderItemId: meta.orderItemId ?? null,
    },
  });
}

export async function readStored(p: string) {
  const full = path.resolve(UPLOAD_DIR, p);
  if (!full.startsWith(UPLOAD_DIR + path.sep)) throw new Error('bad path');
  return readFile(full);
}

export const fileUrl = (id: string) => `/api/files/${id}`;
export const prettySize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
