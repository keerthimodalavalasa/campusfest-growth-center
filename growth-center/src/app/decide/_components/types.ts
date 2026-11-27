import type { Decision, DecisionBoard, Recommendation } from '@/server/engine/decide';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import type { Settings } from '@/server/engine/types';
import { dateLabel, inr, pct } from '@/lib/format';

/** GET /api/decide response: the decision board plus the snapshot campaigns and current settings. */
export type DecideResponse = DecisionBoard & { campaigns: CampaignMetrics[]; settings: Settings };

export type { Decision, Recommendation };

/** Board column order, left to right. */
export const COLUMNS: Decision[] = ['stop', 'change', 'keep', 'scale'];

export const isPost = (phase: DecisionBoard['phase']) => phase === 'event' || phase === 'post-event';

/** "per verified visitor" or "per expected visitor" */
export const perUnit = (phase: DecisionBoard['phase']) => (isPost(phase) ? 'per verified visitor' : 'per expected visitor');

export const ratioLabel = (r: number | null | undefined) => (r == null || !Number.isFinite(r) ? '–' : `${r.toFixed(2)}×`);

/** Short, card-sized wording of a failed (or passed) rule check. */
export function shortCheck(check: Recommendation['checks'][number], rec: Recommendation, s: Settings): string {
  const detail = check.detail.replace(/\.$/, '');
  switch (check.rule) {
    case 'Efficiency':
      if (rec.ratioToMedian == null) return detail;
      return `Efficiency ${ratioLabel(rec.ratioToMedian)} the median ${inr(rec.portfolioMedian)} (${rec.ratioToMedian >= s.stopCostFactor ? `stop at ${s.stopCostFactor}×` : `change above ${s.changeCostFactor}×`})`;
    case 'Momentum':
      return `Momentum: ${detail.charAt(0).toLowerCase()}${detail.slice(1)} (trigger below ${pct(s.momentumDropRatio)})`;
    case 'Show-up quality':
      return `Show-up: ${detail}`;
    default:
      return detail;
  }
}

/**
 * The one-line reason shown when no check failed. The engine's canned Keep/Scale sentence assumes an efficiency
 * figure exists; when it does not (no paid spend, or no visitors yet) say what is actually true instead.
 */
export function passReason(rec: Recommendation, phase: DecisionBoard['phase']): string {
  const guard = rec.checks.length ? 'every guardrail passes' : 'no guardrail has enough data yet';
  if (rec.spend <= 0) return `No paid spend, so cost is not a constraint; ${guard}.`;
  if (rec.efficiency == null) return `No ${isPost(phase) ? 'verified' : 'expected'} visitors yet, so there is no cost per visitor to judge; ${guard}.`;
  return tidy(rec.reasons[0] ?? `Every check passes.`);
}

/** A check as a chip label of a few words with its number: "Cost 3.48×", "Opt-outs 8.8%", "Cancels +3.7 pts". */
export function checkChip(check: Recommendation['checks'][number], rec: Recommendation): string {
  const d = check.detail;
  switch (check.rule) {
    case 'Efficiency':
      return rec.spend <= 0 || rec.ratioToMedian == null ? 'No paid spend' : `Cost ${ratioLabel(rec.ratioToMedian)}`;
    case 'Opt-out guardrail': {
      const m = d.match(/(\d+(?:\.\d+)?%)/);
      return m ? `Opt-outs ${m[1]}` : 'Opt-outs';
    }
    case 'Cancellation guardrail': {
      const m = d.match(/\(([+-]?\d+(?:\.\d+)?) pts/);
      return m ? `Cancels ${m[1].startsWith('-') ? `−${m[1].slice(1)}` : m[1].startsWith('+') ? m[1] : `+${m[1]}`} pts` : 'Cancellations';
    }
    case 'Show-up quality': {
      const m = d.match(/(\d+(?:\.\d+)?%)/);
      return m ? `Show-up ${m[1]}` : 'Show-up';
    }
    case 'Momentum': {
      const m = d.match(/last 7 days (\d+) vs previous 7 days (\d+)/);
      return m ? `Sign-ups ${m[1]} vs ${m[2]}` : 'Momentum';
    }
    default:
      return check.rule;
  }
}

/** The suggested action in six words or fewer; the full sentence stays in the tooltip and the task. */
export function shortAction(rec: Recommendation): string {
  if (rec.decision === 'stop') return 'Pause spend, move budget to Scale';
  if (rec.decision === 'scale') return 'Add about 20% a week';
  if (rec.decision === 'keep') return 'Hold budget, review weekly';
  const failed = rec.checks.filter((k) => !k.passed && k.rule !== 'Efficiency');
  return failed.length ? `Fix ${failed[0].rule.replace(/ guardrail| quality/i, '').toLowerCase()}, re-test a week` : 'Cut cost, re-test a week';
}

/** Task decisions allowed by the tasks API: keep maps to monitor. */
export const taskDecision = (d: Decision) => (d === 'keep' ? 'monitor' : d);

/**
 * Server rule text uses capitalised decision words, "2.82x" multipliers, "a x b" products and ISO dates.
 * Bring it to the app's display conventions: sentence case, "2.82×", "a × b", en-dash ranges, "9 Mar 2025".
 */
export const tidy = (s: string) =>
  s
    .replace(/\bSCALE\b/g, 'Scale')
    .replace(/\bCHANGE\b/g, 'Change')
    .replace(/\bSTOP\b/g, 'Stop')
    .replace(/\bKEEP\b/g, 'Keep')
    .replace(/\bCONFIRMED\b/g, 'confirmed')
    .replace(/(\d)-(\d+(?:\.\d+)?x\b)/g, '$1–$2')
    .replace(/(\d)x\b/g, '$1×')
    .replace(/ x /g, ' × ')
    .replace(/ -> /g, ' to ')
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => dateLabel(iso, true));
