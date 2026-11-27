/**
 * Categorical colours per campaign, fixed by campaign ID (colour follows the entity, never its rank).
 * Validated with the dataviz validator (light surface): lightness band, chroma floor, adjacent CVD ΔE >= 11.8,
 * normal-vision ΔE >= 20.5. Four slots are below 3:1 on white, so every chart ships a legend or table view.
 */
const PALETTE: Record<string, string> = {
  C01: '#257de0', // Campus Ambassadors: blue
  C02: '#f47230', // Paid Social: orange
  C03: '#00b894', // Creator Partners: aqua
  C04: '#f2a600', // College Partnerships: yellow
  C05: '#ee7fac', // Student Referrals: magenta
  C06: '#008a17', // Organic Search: green
  C07: '#6a4ce2', // Community Groups: violet
  UNATTRIBUTED: '#8a929c',
};
const EXTRA = ['#475569', '#9333ea', '#0369a1', '#a16207', '#15803d', '#db2777'];

export function campaignColor(id: string): string {
  if (PALETTE[id]) return PALETTE[id];
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA[h % EXTRA.length];
}

export const DECISION = {
  scale: { label: 'Scale', fg: 'var(--bangle)', bg: 'var(--bangle-soft)' },
  keep: { label: 'Keep', fg: 'var(--sagar)', bg: 'var(--sagar-soft)' },
  change: { label: 'Change', fg: 'var(--zari)', bg: 'var(--zari-soft)' },
  stop: { label: 'Stop', fg: 'var(--lac)', bg: 'var(--lac-soft)' },
} as const;
export type DecisionKey = keyof typeof DECISION;

export const SEVERITY = {
  high: { label: 'High', fg: 'var(--lac)', bg: 'var(--lac-soft)' },
  medium: { label: 'Medium', fg: 'var(--zari)', bg: 'var(--zari-soft)' },
  low: { label: 'Low', fg: 'var(--sagar)', bg: 'var(--sagar-soft)' },
} as const;
