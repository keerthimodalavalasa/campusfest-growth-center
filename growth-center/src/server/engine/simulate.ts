import { UNATTRIBUTED, type Snapshot } from './snapshot';
import type { Settings } from './types';

export interface Move {
  from: string;
  to: string;
  amount: number;
}

export interface SimulationRow {
  campaignId: string;
  name: string;
  spendBefore: number;
  spendAfter: number;
  visitorsBefore: number;
  visitorsAfter: number;
  delta: number;
  note: string | null;
}

export interface Simulation {
  basis: string;
  elasticity: number;
  rows: SimulationRow[];
  totalBefore: number;
  totalAfter: number;
  delta: number;
  warnings: string[];
}

/**
 * Budget what-if. Each campaign's (expected) visitors follow a spend-response curve
 *   V(s) = V0 * (s / s0) ^ elasticity
 * anchored on its current spend s0 and visitors V0 (actual after the event, expected before it).
 * elasticity < 1 encodes diminishing returns. This is an ASSUMPTION for planning, not a measured curve.
 */
export function simulateReallocation(snap: Snapshot, moves: Move[], settings: Settings): Simulation {
  const k = settings.spendElasticity;
  const warnings: string[] = [];
  const camps = snap.campaigns.filter((c) => c.campaignId !== UNATTRIBUTED);
  const delta = new Map<string, number>();
  for (const m of moves) {
    if (!(m.amount > 0)) {
      warnings.push(`Ignored a move of ${m.amount}: amount must be positive.`);
      continue;
    }
    const f = camps.find((c) => c.campaignId === m.from);
    const t = camps.find((c) => c.campaignId === m.to);
    if (!f || !t) {
      warnings.push(`Unknown campaign in move ${m.from} -> ${m.to}.`);
      continue;
    }
    delta.set(m.from, (delta.get(m.from) ?? 0) - m.amount);
    delta.set(m.to, (delta.get(m.to) ?? 0) + m.amount);
  }
  const rows: SimulationRow[] = camps.map((c) => {
    const s0 = c.spend;
    const v0 = c.expectedVisitors;
    const d = delta.get(c.campaignId) ?? 0;
    let s1 = s0 + d;
    let note: string | null = null;
    if (s1 < 0) {
      warnings.push(`${c.name}: cannot move more than its current spend; capped at ₹${Math.round(s0).toLocaleString('en-IN')}.`);
      s1 = 0;
    }
    let v1 = v0;
    if (d !== 0) {
      if (s0 > 0) v1 = v0 * Math.pow(s1 / s0, k);
      else {
        // no spend baseline: use portfolio average cost per (expected) visitor with a 1.5x novelty penalty
        const avg = snap.totals.expectedVisitors > 0 ? snap.totals.spend / snap.totals.expectedVisitors : null;
        v1 = avg ? v0 + d / (avg * 1.5) : v0;
        note = 'No paid baseline: used 1.5x the portfolio average cost per visitor.';
      }
    }
    return { campaignId: c.campaignId, name: c.name, spendBefore: s0, spendAfter: s1, visitorsBefore: v0, visitorsAfter: v1, delta: v1 - v0, note };
  });
  const totalBefore = rows.reduce((s, r) => s + r.visitorsBefore, 0);
  const totalAfter = rows.reduce((s, r) => s + r.visitorsAfter, 0);
  return {
    basis: `${snap.phase === 'post-event' || snap.phase === 'event' ? 'Actual verified visitors' : 'Expected visitors (confirmed x show-rate assumption)'} as of ${snap.asOf}; response curve V = V0 x (spend ratio)^${k}.`,
    elasticity: k,
    rows,
    totalBefore,
    totalAfter,
    delta: totalAfter - totalBefore,
    warnings,
  };
}
