/** Calendar month in India time. `ym` like "2026-11"; returns UTC instants for the start and end. */
export function monthRange(ym?: string | null) {
  const now = new Date(Date.now() + 5.5 * 3600000);
  const m = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const [y, mo] = m.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, 1) - 5.5 * 3600000);
  const end = new Date(Date.UTC(y, mo, 1) - 5.5 * 3600000);
  const label = new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, '0')}`;
  const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}`;
  return { ym: m, start, end, label, prev, next };
}
