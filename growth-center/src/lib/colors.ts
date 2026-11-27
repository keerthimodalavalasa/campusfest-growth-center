/**
 * Colour by job (Charminar Bento, .proto/overview/v2-bento.md).
 *
 * Campaigns: one fixed categorical palette, keyed by campaign ID, used by every chart. Colour follows the
 * campaign, never its rank. Order chosen by enumerating all 5,040 assignments for the best worst-adjacent
 * CVD separation; dataviz validator on stone #EEF0EB: worst adjacent CVD dE 14.7, normal-vision 20.7,
 * every slot >= 3:1. Charts still ship a legend or a "View data" table so identity is never colour alone.
 */
export const CAMPAIGN_COLORS: Readonly<Record<string, string>> = {
  C01: '#6E8A12', // Campus Ambassadors: neem
  C02: '#2E78D2', // Paid Social: Hussain Sagar blue
  C03: '#D95A12', // Creator Partners: genda marigold
  C04: '#00909C', // College Partnerships: Qutb Shahi tile teal
  C05: '#9C5F22', // Student Referrals: Irani chai
  C06: '#7346D1', // Organic Search: baingan
  C07: '#D23C7E', // Community Groups: gulab
  UNATTRIBUTED: '#C8B48F', // walk-ins: sandstone (a mark only)
};

/** Campaigns created in the app after the dataset: deeper steps of the same hues, never a generated hue. */
const EXTRA = ['#3F5208', '#1B4F8F', '#9A3D0A', '#005F67', '#6B3F14', '#4B2A94', '#962656'];

export function campaignColor(id: string): string {
  const c = CAMPAIGN_COLORS[id];
  if (c) return c;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

/** Metric families: each owns one Hyderabad hue. A hue always means its family. */
export const FAMILY = {
  lac: { label: 'Visitors', color: 'var(--lac)' },
  nizami: { label: 'Registrations', color: 'var(--nizami)' },
  haldi: { label: 'Money', color: 'var(--haldi)' },
  pista: { label: 'Audience', color: 'var(--pista)' },
} as const;
export type FamilyKey = keyof typeof FAMILY;

/**
 * Status calls: reserved colours that always travel with a glyph and a label (`StatusPill`, `RuleStrip`).
 * `fg` is the status colour, text-safe on white and limestone. There are no status tints: zones are neutral washes.
 */
export const DECISION = {
  scale: { label: 'Scale', fg: 'var(--st-scale)', glyph: 'up' },
  keep: { label: 'Keep', fg: 'var(--st-keep)', glyph: 'check' },
  change: { label: 'Change', fg: 'var(--st-change)', glyph: 'rotate' },
  stop: { label: 'Stop', fg: 'var(--st-stop)', glyph: 'stop' },
} as const;
export type DecisionKey = keyof typeof DECISION;

/** Severity is fill weight, not a new colour: high = solid ink, medium = stone step, low = faint. */
export const SEVERITY = {
  high: { label: 'High', fg: '#ffffff', bg: 'var(--ink)', level: 3 },
  medium: { label: 'Medium', fg: 'var(--ink)', bg: 'var(--stone-3)', level: 2 },
  low: { label: 'Low', fg: 'var(--ink-2)', bg: 'var(--stone-2)', level: 1 },
} as const;
