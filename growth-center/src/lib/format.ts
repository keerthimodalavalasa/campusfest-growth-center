const IN = new Intl.NumberFormat('en-IN');
const IN1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export const num = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '–' : IN.format(Math.round(x)));
export const num1 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '–' : IN1.format(x));
export const inr = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '–' : `${x < 0 ? '−' : ''}₹${IN.format(Math.abs(Math.round(x)))}`);
/** ₹2.74L style for compact displays */
export const inrShort = (x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return '–';
  const a = Math.abs(x);
  const s = x < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return `${s}₹${Math.round(a)}`;
};
export const pct = (x: number | null | undefined, digits = 1) => (x == null || !Number.isFinite(x) ? '–' : `${(x * 100).toFixed(digits)}%`);
export const signed = (x: number, f: (n: number) => string = num) => (x > 0 ? `+${f(x)}` : x < 0 ? `−${f(Math.abs(x))}` : f(0));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dateLabel = (iso: string | null | undefined, withYear = false) => {
  if (!iso) return '–';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
};
export const weekday = (iso: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${iso}T00:00:00Z`).getUTCDay()];
export const istTime = (ms: number) => {
  const d = new Date(ms + 5.5 * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const todayIST = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
