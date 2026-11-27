import { dateLabel } from '@/lib/format';

/** Typographic clean-up for engine sentences: true minus signs, arrows, rupee sign before the minus. */
export function tidy(s: string): string {
  return s
    .replace(/₹-(\d)/g, '−₹$1')
    .replace(/ -> /g, ' → ')
    .replace(/(^|[\s(])-(?=\d)/g, '$1−')
    .replace(/ flat \+0 \(/g, ' flat (');
}

/** Numeric ranges in engine labels take an en dash: "0-14 days before" → "0–14 days before". Not for ISO dates. */
export function rangeDash(s: string): string {
  return s.replace(/\b(\d{1,3})-(\d{1,3})\b/g, '$1–$2');
}

/** Gap rounded to the precision it is displayed at, so a cell's colour always matches its printed value. */
export function shownGap(gap: number): number {
  return Number(gap.toFixed(1));
}

/** Gaps under 1 point either way are treated as no real difference (the grey band on the heatmap). */
export const NEUTRAL_PTS = 1;

/** "Identified → registered (cohort identified 14+ days ago)" → main + qualifier. */
export function splitStage(stage: string): { main: string; qualifier: string | null } {
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(stage);
  return m ? { main: m[1], qualifier: m[2] } : { main: stage, qualifier: null };
}

/** Gap in percentage points with a true minus sign: "−18.4 pts", "+6.7 pts". */
export function pts(gap: number, digits = 1): string {
  const v = Math.abs(gap).toFixed(digits);
  if (Number(v) === 0) return `${(0).toFixed(digits)} pts`;
  return `${gap > 0 ? '+' : '−'}${v} pts`;
}

/** "2025-03-03 to 2025-03-09 vs previous 7 days" → "3 Mar to 9 Mar 2025 vs previous 7 days". */
export function windowLabel(w: string): string {
  const m = /^(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})(.*)$/.exec(w);
  return m ? `${dateLabel(m[1])} to ${dateLabel(m[2], true)}${m[3]}` : w;
}

/** Visitors lost: whole numbers once they are material, one decimal below 10. */
export function lostLabel(x: number): string {
  if (x >= 10) return Math.round(x).toLocaleString('en-IN');
  return x.toFixed(1);
}
