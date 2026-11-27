import { computeSnapshot, UNATTRIBUTED, type CampaignMetrics, type Snapshot } from './snapshot';
import type { Dataset } from './types';

export type Decision = 'scale' | 'keep' | 'change' | 'stop';

export interface Recommendation {
  campaignId: string;
  name: string;
  ownerName: string | null;
  decision: Decision;
  efficiencyMetric: 'cost per verified visitor' | 'cost per expected visitor';
  efficiency: number | null; // INR per (expected) visitor
  portfolioMedian: number | null;
  ratioToMedian: number | null;
  reasons: string[]; // the rules that fired, with numbers
  checks: { rule: string; passed: boolean; detail: string }[];
  suggestedAction: string;
  spend: number;
  visitorsOrExpected: number;
}

export interface Reallocation {
  from: string;
  to: string;
  amount: number;
  rationale: string;
}

export interface DecisionBoard {
  asOf: string;
  phase: Snapshot['phase'];
  basis: string;
  thresholds: { scaleAtOrBelow: number | null; changeAbove: number | null; stopAtOrAbove: number | null };
  recommendations: Recommendation[];
  reallocations: Reallocation[];
  notes: string[];
}

const pct = (x: number | null) => (x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const inr = (x: number | null) => (x == null ? 'n/a' : `₹${Math.round(x).toLocaleString('en-IN')}`);

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Transparent rule engine. Efficiency = net spend / verified visitors (after the event)
 * or net spend / (confirmed x show-rate assumption) before it. Thresholds are multiples of the
 * portfolio median, so they adapt when the data changes.
 */
export function computeDecisions(ds: Dataset, asOf: string, snap: Snapshot = computeSnapshot(ds, asOf)): DecisionBoard {
  const S = ds.settings;
  const post = snap.phase === 'event' || snap.phase === 'post-event';
  const camps = snap.campaigns.filter((c) => c.campaignId !== UNATTRIBUTED && (c.registrations > 0 || c.spend !== 0 || c.identified > 0));
  const eff = (c: CampaignMetrics) => (post ? c.costs.perVisitor : c.costs.perExpectedVisitor);
  const paid = camps.filter((c) => c.spend > 0 && eff(c) != null);
  const med = median(paid.map((c) => eff(c)!));
  const portfolioCancel = (() => {
    const r = camps.reduce((s, c) => s + c.registrations, 0);
    return r ? camps.reduce((s, c) => s + c.cancelled, 0) / r : null;
  })();
  const portfolioShow = (() => {
    const r = camps.reduce((s, c) => s + c.registrations, 0);
    return post && r ? camps.reduce((s, c) => s + c.registeredVisitors, 0) / r : null;
  })();

  const recommendations: Recommendation[] = camps.map((c) => {
    const e = eff(c);
    const ratio = e != null && med ? e / med : null;
    const checks: Recommendation['checks'] = [];
    const reasons: string[] = [];
    const add = (rule: string, passed: boolean, detail: string) => {
      checks.push({ rule, passed, detail });
      if (!passed) reasons.push(detail);
    };
    if (c.spend <= 0) {
      add('Efficiency', true, `No net paid spend (${inr(c.spend)}); efficiency is not a constraint.`);
    } else if (ratio != null) {
      add('Efficiency', ratio <= S.changeCostFactor, `${post ? 'Cost per verified visitor' : 'Cost per expected visitor'} ${inr(e)} = ${ratio.toFixed(2)}x portfolio median ${inr(med)} (change above ${S.changeCostFactor}x, stop at ${S.stopCostFactor}x).`);
    }
    if (c.rates.optOutRate != null && c.identified >= 30) {
      add('Opt-out guardrail', c.rates.optOutRate <= S.maxOptOutRate, `Opt-out rate ${pct(c.rates.optOutRate)} (limit ${pct(S.maxOptOutRate)}).`);
    }
    if (c.rates.cancelRate != null && portfolioCancel != null && c.registrations >= 30) {
      const gap = (c.rates.cancelRate - portfolioCancel) * 100;
      add('Cancellation guardrail', gap <= S.maxCancelRateGapPts, `Cancellation rate ${pct(c.rates.cancelRate)} vs portfolio ${pct(portfolioCancel)} (${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts; limit +${S.maxCancelRateGapPts}).`);
    }
    if (post && c.rates.regToVisit != null && portfolioShow != null && c.registrations >= 30) {
      add('Show-up quality', c.rates.regToVisit >= portfolioShow - 0.1, `${pct(c.rates.regToVisit)} of registrants attended vs portfolio ${pct(portfolioShow)}.`);
    }
    if (!post && snap.phase === 'campaign') {
      const m = c.momentum;
      const ok = !(m.regsPrev7 >= 10 && m.regsLast7 < S.momentumDropRatio * m.regsPrev7 && m.spendLast14 > 0);
      add('Momentum', ok, `Registrations last 7 days ${m.regsLast7} vs previous 7 days ${m.regsPrev7}.`);
    }
    const qualityFails = checks.filter((k) => k.rule !== 'Efficiency' && !k.passed).length;
    let decision: Decision;
    if (ratio != null && ratio >= S.stopCostFactor) decision = 'stop';
    else if ((ratio != null && ratio > S.changeCostFactor) || qualityFails > 0) decision = 'change';
    else if ((ratio == null && c.spend <= 0) || (ratio != null && ratio <= S.scaleCostFactor)) decision = qualityFails === 0 ? 'scale' : 'change';
    else decision = 'keep';
    if (c.spend <= 0 && c.registrations < 10) decision = 'keep';

    const action =
      decision === 'stop'
        ? `Stop or restructure: pause new spend on ${c.name}, keep only retargeting of warm audiences, and move the freed budget to SCALE campaigns.`
        : decision === 'change'
          ? `Change before adding budget: fix the failing guardrail (${checks.filter((k) => !k.passed).map((k) => k.rule.toLowerCase()).join(', ') || 'efficiency'}) and re-test for one week.`
          : decision === 'scale'
            ? `Scale: add budget in steps of ~20% per week while cost per ${post ? 'visitor' : 'expected visitor'} stays under ${inr(med ? med * S.changeCostFactor : null)}.`
            : 'Keep: hold budget steady and monitor weekly.';
    if (decision === 'scale' && reasons.length === 0) reasons.push(`${post ? 'Cost per verified visitor' : 'Cost per expected visitor'} ${inr(e)} is ${ratio != null ? `${ratio.toFixed(2)}x` : 'below'} the portfolio median and every guardrail passes.`);
    if (decision === 'keep' && reasons.length === 0) reasons.push(`Efficiency within ${S.scaleCostFactor}-${S.changeCostFactor}x of the median and guardrails pass.`);
    return {
      campaignId: c.campaignId,
      name: c.name,
      ownerName: c.ownerName,
      decision,
      efficiencyMetric: post ? 'cost per verified visitor' : 'cost per expected visitor',
      efficiency: e,
      portfolioMedian: med,
      ratioToMedian: ratio,
      reasons,
      checks,
      suggestedAction: action,
      spend: c.spend,
      visitorsOrExpected: c.expectedVisitors,
    };
  });

  const order: Record<Decision, number> = { stop: 0, change: 1, scale: 2, keep: 3 };
  recommendations.sort((a, b) => order[a.decision] - order[b.decision] || (b.ratioToMedian ?? 0) - (a.ratioToMedian ?? 0));

  // suggested reallocation: half of each STOP campaign's spend, split across SCALE campaigns by efficiency
  const stops = recommendations.filter((r) => r.decision === 'stop' && r.spend > 0);
  const scales = recommendations.filter((r) => r.decision === 'scale' && r.efficiency != null && r.efficiency > 0);
  const reallocations: Reallocation[] = [];
  if (stops.length && scales.length) {
    const weights = scales.map((s) => 1 / s.efficiency!);
    const wsum = weights.reduce((a, b) => a + b, 0);
    for (const s of stops) {
      const pool = Math.round((s.spend * 0.5) / 1000) * 1000;
      scales.forEach((t, i) => {
        const amt = Math.round((pool * weights[i]) / wsum / 500) * 500;
        if (amt > 0) reallocations.push({ from: s.campaignId, to: t.campaignId, amount: amt, rationale: `${s.name} costs ${inr(s.efficiency)} per ${post ? 'visitor' : 'expected visitor'} vs ${inr(t.efficiency)} for ${t.name}.` });
      });
    }
  }

  return {
    asOf,
    phase: snap.phase,
    basis: post
      ? 'Efficiency = net spend / unique verified external visitors (actual attendance).'
      : `Efficiency = net spend / expected visitors, where expected visitors = confirmed registrants x ${pct(S.showRateAssumption)} show-rate assumption (event has not happened yet).`,
    thresholds: { scaleAtOrBelow: med ? med * S.scaleCostFactor : null, changeAbove: med ? med * S.changeCostFactor : null, stopAtOrAbove: med ? med * S.stopCostFactor : null },
    recommendations,
    reallocations,
    notes: [
      'Thresholds are relative to the portfolio median, so they move when the data changes.',
      'Channel attribution is the recorded source (first touch for identified people, registration campaign for registrations); it is not proof of incremental lift.',
      'Organic campaigns with no paid spend are not cost-constrained; scale them through effort and content rather than cash.',
    ],
  };
}
