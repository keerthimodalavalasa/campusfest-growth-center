/**
 * Time rules from the dataset "Read me":
 *  - every source timestamp is India time (+05:30)
 *  - a selected date means the END of that day in Asia/Kolkata
 */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** Inclusive cutoff instant (epoch ms) for the end of an IST calendar day. */
export function cutoffFor(asOf: string): number {
  if (!isIsoDate(asOf)) throw new Error(`as_of must be YYYY-MM-DD, got "${asOf}"`);
  return Date.parse(`${asOf}T23:59:59.999+05:30`);
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(ts: number): string {
  return new Date(ts + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** IST hour of day (0-23). */
export function istHour(ts: number): number {
  return new Date(ts + IST_OFFSET_MS).getUTCHours();
}

/** Human label like "12 Apr 2025, 10:00 IST". */
export function istLabel(ts: number): string {
  const d = new Date(ts + IST_OFFSET_MS);
  const m = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${d.getUTCDate()} ${m} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} IST`;
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** ISO-8601 week label, e.g. "2025-W10", plus its Monday. */
export function isoWeek(date: string): { label: string; monday: string } {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0
  const monday = new Date(d.getTime() - dow * DAY_MS);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = 1 + Math.floor((thursday.getTime() - yearStart) / (7 * DAY_MS));
  return { label: `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`, monday: monday.toISOString().slice(0, 10) };
}

/**
 * Convert a spreadsheet value to an IST timestamp string ("…+05:30").
 * exceljs returns naive wall-clock datetimes as Date objects whose UTC fields hold the IST wall clock.
 */
export function toIstTimestamp(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().replace('Z', '+05:30');
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).toISOString(); // explicit offset: keep the instant
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return `${m[1]}T${m[2] ?? '00'}:${m[3] ?? '00'}:${m[4] ?? '00'}+05:30`;
}

/** Convert a spreadsheet value to a plain date string (YYYY-MM-DD). */
export function toDateOnly(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
