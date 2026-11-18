import { readdirSync } from 'fs';
import path from 'path';
import { fileUrl } from './files';

let stills: Set<string> | null = null;

/** The pre-rendered 3D still for a product (public/mockups/<slug>.webp), if one was made. */
export function mockupFor(slug: string): string | null {
  if (!stills) {
    try { stills = new Set(readdirSync(path.join(process.cwd(), 'public', 'mockups')).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5))); }
    catch { stills = new Set(); }
  }
  return stills.has(slug) ? `/mockups/${slug}.webp` : null;
}

/** Picture for a product card: the cover photo if there is one, else the 3D still. */
export function productImage(slug: string, coverId?: string | null): { src: string; photo: boolean } | null {
  if (coverId) return { src: fileUrl(coverId), photo: true };
  const m = mockupFor(slug);
  return m ? { src: m, photo: false } : null;
}
