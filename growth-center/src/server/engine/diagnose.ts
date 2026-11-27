import { addDays, cutoffFor, DAY_MS } from './time';
import { computeSnapshot, isExternal, registrationAt, statusAt, UNATTRIBUTED, verifiedVisitorFirstEntry, type CampaignMetrics, type Snapshot } from './snapshot';
import type { Dataset } from './types';

const fmtPct = (x: number | null | undefined) => (x == null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
const inr = (x: number) => `₹${Math.round(x).toLocaleString('en-IN')}`;

export interface StageBottleneck {
  campaignId: string;
  name: string;
  stage: string;
  rate: number;
  portfolioRate: number;
  gapPts: number; // percentage points (negative = worse than portfolio)
  peopleLost: number; // people lost at this stage vs portfolio rate
  visitorsLost: number; // converted into the common currency of verified visitors
  explanation: string;
}

export interface Signal {
  id: string;
  severity: 'high' | 'medium' | 'low';
  campaignId: string | null;
  title: string;
  evidence: string;
  suggestedAction: string;
}

export interface Driver {
  campaignId: string;
  name: string;
  regsLast7: number;
  regsPrev7: number;
  delta: number;
  shareOfChange: number | null;
  spendLast7: number;
  spendPrev7: number;
  identLast7: number;
  identPrev7: number;
  read: string;
}

export interface ShowUpDriver {
  factor: string;
  group: string;
  registrants: number;
  visitors: number;
  showRate: number | null;
}

export interface Diagnosis {
  asOf: string;
  phase: Snapshot['phase'];
  funnel: { stage: string; count: number; rateFromPrev: number | null; note: string }[];
  biggestDrop: { from: string; to: string; lost: number; rate: number | null } | null;
  bottlenecks: StageBottleneck[]; // worst stage per campaign, ranked by visitors lost
  allStageGaps: StageBottleneck[];
  signals: Signal[];
  drivers: { window: string; totalLast7: number; totalPrev7: number; delta: number; rows: Driver[] };
  showUpDrivers: ShowUpDriver[];
  dataQuality: { item: string; value: number | string; note: string }[];
}

function portfolio(snap: Snapshot) {
  const cs = snap.campaigns.filter((c) => c.campaignId !== UNATTRIBUTED);
  const sum = (k: keyof CampaignMetrics) => cs.reduce((s, c) => s + (c[k] as number), 0);
  const r = (a: number, b: number) => (b > 0 ? a / b : null);
  return {
    identToReg: r(sum('registrations'), sum('identified')),
    identToRegMature: r(sum('matureRegistered'), sum('matureIdentified')),
    regToConfirmed: r(sum('confirmed'), sum('registrations')),
    confirmedToVisit: r(sum('registeredVisitors'), sum('confirmed')),
    regToVisit: r(sum('registeredVisitors'), sum('registrations')),
    cancelRate: r(sum('cancelled'), sum('registrations')),
    optOutRate: r(sum('optOuts'), sum('identified')),
    ctr: r(sum('clicks'), sum('impressions')),
  };
}

export function computeDiagnosis(ds: Dataset, asOf: string, snap: Snapshot = computeSnapshot(ds, asOf)): Diagnosis {
  const post = snap.phase === 'event' || snap.phase === 'post-event';
  const p = portfolio(snap);
  const t = snap.totals;
  const showDown = post ? p.confirmedToVisit ?? ds.settings.showRateAssumption : ds.settings.showRateAssumption;

  // ---- overall funnel
  const funnel: Diagnosis['funnel'] = [
    { stage: 'Impressions', count: t.impressions, rateFromPrev: null, note: 'Anonymous platform events, not people.' },
    { stage: 'Clicks', count: t.clicks, rateFromPrev: t.rates.ctr, note: 'CTR' },
    { stage: 'Landing-page sessions', count: t.lpSessions, rateFromPrev: t.rates.clickToLp, note: 'Anonymous sessions incl. repeats.' },
    { stage: 'Registration form starts', count: t.regStarts, rateFromPrev: t.rates.lpToStart, note: 'Anonymous form starts.' },
    { stage: 'Identified external people', count: t.identified, rateFromPrev: null, note: 'Distinct people (identity switch: not comparable with the anonymous rows above).' },
    { stage: 'Registered', count: t.registrations, rateFromPrev: t.rates.identToReg, note: 'Distinct external people with a registration.' },
    { stage: 'Confirmed', count: t.confirmed, rateFromPrev: t.rates.regToConfirmed, note: 'Latest status = confirmed at the cutoff.' },
    { stage: 'Verified visitors', count: t.visitors, rateFromPrev: post ? (t.confirmed > 0 ? t.registeredVisitors / t.confirmed : null) : null, note: post ? `Includes ${snap.excluded.walkInVisitors} walk-ins without registration.` : 'Event has not happened at this date.' },
  ];
  let biggestDrop: Diagnosis['biggestDrop'] = null;
  const peopleStages: [string, string, number, number][] = [
    ['Identified', 'Registered', t.identified, t.registrations],
    ['Registered', 'Confirmed', t.registrations, t.confirmed],
  ];
  if (post) peopleStages.push(['Confirmed', 'Attended (registered)', t.confirmed, t.registeredVisitors]);
  for (const [from, to, a, b] of peopleStages) {
    const lost = a - b;
    if (!biggestDrop || lost > biggestDrop.lost) biggestDrop = { from, to, lost, rate: a > 0 ? b / a : null };
  }

  // ---- stage gaps per campaign, in the common currency of verified visitors
  const all: StageBottleneck[] = [];
  for (const c of snap.campaigns) {
    if (c.campaignId === UNATTRIBUTED) continue;
    const stages: [string, number | null, number | null, number, number][] = [
      ['Identified → registered (cohort identified 14+ days ago)', c.rates.identToRegMature, p.identToRegMature, c.matureIdentified, (p.regToConfirmed ?? 0) * showDown],
      ['Registered → confirmed', c.rates.regToConfirmed, p.regToConfirmed, c.registrations, showDown],
    ];
    if (post) stages.push(['Confirmed → attended', c.rates.confirmedToVisit, p.confirmedToVisit, c.confirmed, 1]);
    for (const [stage, rate, pr, input, down] of stages) {
      if (rate == null || pr == null || input <= 0) continue;
      const gap = rate - pr;
      const lost = Math.max(0, -gap * input);
      all.push({
        campaignId: c.campaignId,
        name: c.name,
        stage,
        rate,
        portfolioRate: pr,
        gapPts: gap * 100,
        peopleLost: lost,
        visitorsLost: lost * down,
        explanation: `${c.name}: ${stage} ${fmtPct(rate)} vs portfolio ${fmtPct(pr)} (${gap >= 0 ? '+' : ''}${(gap * 100).toFixed(1)} pts) on ${Math.round(input).toLocaleString('en-IN')} people${lost > 0 ? `; ~${Math.round(lost)} people (~${Math.round(lost * down)} visitors) lost` : ''}.`,
      });
    }
  }
  const worst = new Map<string, StageBottleneck>();
  for (const s of all) if (s.visitorsLost > 0 && (!worst.get(s.campaignId) || s.visitorsLost > worst.get(s.campaignId)!.visitorsLost)) worst.set(s.campaignId, s);
  const bottlenecks = [...worst.values()].sort((a, b) => b.visitorsLost - a.visitorsLost);

  // ---- signals
  const S = ds.settings;
  const signals: Signal[] = [];
  const cut = snap.cutoff;
  for (const c of snap.campaigns) {
    if (c.campaignId === UNATTRIBUTED) continue;
    const m = c.momentum;
    if (snap.phase === 'campaign') {
      if (m.regsPrev7 >= 10 && m.regsLast7 < S.momentumDropRatio * m.regsPrev7 && m.spendLast14 > 0) {
        signals.push({ id: `momentum-${c.campaignId}`, severity: 'high', campaignId: c.campaignId, title: `${c.name}: registrations fell ${Math.round((1 - m.regsLast7 / m.regsPrev7) * 100)}% week over week`, evidence: `${m.regsLast7} registrations in the last 7 days vs ${m.regsPrev7} in the previous 7; ${inr(m.spendLast14)} spent in the last 14 days.`, suggestedAction: 'Check creative fatigue or audience saturation; refresh creative or pause the spend until the cause is fixed.' });
      }
      if (m.spendLast7 > 0 && m.regsLast7 === 0) {
        signals.push({ id: `spend-noresult-${c.campaignId}`, severity: 'high', campaignId: c.campaignId, title: `${c.name}: spend with zero registrations this week`, evidence: `${inr(m.spendLast7)} posted in the last 7 days and no new registrations.`, suggestedAction: 'Pause and audit tracking and landing flow before more spend posts.' });
      }
    }
    if (c.rates.optOutRate != null && c.identified >= 30 && c.rates.optOutRate > S.maxOptOutRate) {
      signals.push({ id: `optout-${c.campaignId}`, severity: c.rates.optOutRate > 2 * S.maxOptOutRate ? 'high' : 'medium', campaignId: c.campaignId, title: `${c.name}: opt-out rate ${fmtPct(c.rates.optOutRate)}`, evidence: `${c.optOuts} of ${c.identified} identified people opted out (guardrail ${fmtPct(S.maxOptOutRate)}).`, suggestedAction: 'Cut message frequency, move follow-ups to opt-in WhatsApp utility messages, tighten audience targeting.' });
    }
    if (c.rates.cancelRate != null && p.cancelRate != null && c.registrations >= 30 && (c.rates.cancelRate - p.cancelRate) * 100 > S.maxCancelRateGapPts) {
      signals.push({ id: `cancel-${c.campaignId}`, severity: 'medium', campaignId: c.campaignId, title: `${c.name}: cancellations ${fmtPct(c.rates.cancelRate)} vs ${fmtPct(p.cancelRate)} portfolio`, evidence: `${c.cancelled} of ${c.registrations} registrations are cancelled at the cutoff.`, suggestedAction: 'Run a win-back nudge (36 cancellations were reconfirmed last edition) and check what was promised in the ad.' });
    }
    if (post && c.rates.regToVisit != null && p.regToVisit != null && c.registrations >= 30 && c.rates.regToVisit < p.regToVisit - 0.1) {
      signals.push({ id: `showrate-${c.campaignId}`, severity: 'high', campaignId: c.campaignId, title: `${c.name}: only ${fmtPct(c.rates.regToVisit)} of registrants attended`, evidence: `Portfolio show rate ${fmtPct(p.regToVisit)}; ${c.registrations - c.registeredVisitors} registrants did not attend.`, suggestedAction: 'Treat registrations from this channel as low-intent: require confirmation, add reminders, or stop optimising for registrations.' });
    }
  }
  if (t.waitlisted > 0) {
    signals.push({ id: 'waitlist', severity: snap.phase === 'campaign' ? 'medium' : 'low', campaignId: null, title: `${t.waitlisted} registrants are waitlisted`, evidence: `Waitlisted people never attended last edition (0 of 88). ${snap.phase === 'campaign' ? 'Release spots in batches as cancellations come in.' : ''}`.trim(), suggestedAction: 'Auto-promote waitlisted registrants when cancellations free capacity; send a confirmation link.' });
  }
  const stale = [...ds.regsByPerson.entries()].filter(([pid]) => isExternal(ds, pid)).map(([pid]) => registrationAt(ds, pid, cut)).filter((r) => r && r.at < cut - 3 * DAY_MS && statusAt(ds, r.registrationId, cut) === 'interested').length;
  if (stale > 0) {
    signals.push({ id: 'stale-interested', severity: 'low', campaignId: null, title: `${stale} registrations stuck in "interested" for 3+ days`, evidence: 'They never confirmed; unconfirmed registrants did not attend last edition.', suggestedAction: 'Send a one-tap confirmation message; release their spot if still unconfirmed 72 hours before the event.' });
  }
  if (snap.projection && snap.target) {
    const pr = snap.projection;
    if (pr.registrations < snap.target.registrationGoal) {
      signals.push({ id: 'pace-registrations', severity: 'high', campaignId: null, title: `On pace for ${Math.round(pr.registrations).toLocaleString('en-IN')} registrations vs goal ${snap.target.registrationGoal.toLocaleString('en-IN')}`, evidence: `Current pace ${pr.currentDailyRegistrations.toFixed(1)}/day; needed ${pr.requiredDailyRegistrations?.toFixed(1)}/day for ${pr.daysLeft.toFixed(0)} days.`, suggestedAction: 'Shift budget to the most efficient channels and add capacity to college partnerships and referrals.' });
    }
    if (pr.visitors < snap.target.visitorsGoal) {
      signals.push({ id: 'pace-visitors', severity: 'high', campaignId: null, title: `Projected ${Math.round(pr.visitors).toLocaleString('en-IN')} visitors vs goal ${snap.target.visitorsGoal.toLocaleString('en-IN')}`, evidence: `Assumes ${fmtPct(ds.settings.showRateAssumption)} of confirmed registrants attend (planning assumption).`, suggestedAction: 'Close the gap with show-up work (reminders, squads, transport) as well as acquisition.' });
    }
    if (pr.spend > snap.target.budget) {
      signals.push({ id: 'budget-over', severity: 'medium', campaignId: null, title: `Spend on track to exceed budget: ${inr(pr.spend)} vs ${inr(snap.target.budget)}`, evidence: 'Run-rate projection of the last 14 days of net spend.', suggestedAction: 'Cap the weakest campaign before the next invoice posts.' });
    }
  }
  const sevRank = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  // ---- week-over-week drivers (registrations)
  // differences of three end-of-day snapshots: asOf, asOf-7, asOf-14
  const prev1 = computeSnapshot(ds, addDays(asOf, -7));
  const prev2 = computeSnapshot(ds, addDays(asOf, -14));
  const get = (s: Snapshot, id: string) => s.campaigns.find((x) => x.campaignId === id);
  const rows: Driver[] = snap.campaigns
    .filter((c) => c.campaignId !== UNATTRIBUTED)
    .map((c) => {
      const a = get(prev1, c.campaignId);
      const b = get(prev2, c.campaignId);
      const regsLast7 = c.registrations - (a?.registrations ?? 0);
      const regsPrev7 = (a?.registrations ?? 0) - (b?.registrations ?? 0);
      return {
        campaignId: c.campaignId,
        name: c.name,
        regsLast7,
        regsPrev7,
        delta: regsLast7 - regsPrev7,
        shareOfChange: null,
        spendLast7: c.spend - (a?.spend ?? 0),
        spendPrev7: (a?.spend ?? 0) - (b?.spend ?? 0),
        identLast7: c.identified - (a?.identified ?? 0),
        identPrev7: (a?.identified ?? 0) - (b?.identified ?? 0),
        read: '',
      };
    });
  const totalLast7 = rows.reduce((s, r) => s + r.regsLast7, 0);
  const totalPrev7 = rows.reduce((s, r) => s + r.regsPrev7, 0);
  const totDelta = totalLast7 - totalPrev7;
  const absSum = rows.reduce((s, r) => s + Math.abs(r.delta), 0);
  for (const r of rows) {
    r.shareOfChange = absSum > 0 ? r.delta / absSum : null;
    const dir = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'flat';
    const sp = r.spendLast7 - r.spendPrev7;
    const why = r.identLast7 < r.identPrev7 * 0.7 ? 'fewer new people identified (top-of-funnel volume)' : r.identLast7 > 0 && r.regsLast7 / Math.max(1, r.identLast7) < 0.5 ? 'weaker conversion of identified people' : sp > 0 && r.delta < 0 ? 'more spend but fewer registrations (efficiency drop)' : 'volume and conversion broadly stable';
    r.read = `${r.name} ${dir} ${r.delta >= 0 ? '+' : ''}${r.delta} (${r.regsPrev7} -> ${r.regsLast7}); likely driver: ${why}.`;
  }
  rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // ---- show-up drivers (only once attendance exists)
  const showUpDrivers: ShowUpDriver[] = [];
  if (post) {
    const vis = verifiedVisitorFirstEntry(ds, cut);
    const regs: { personId: string; at: number; status: string | null }[] = [];
    for (const [pid] of ds.regsByPerson) {
      if (!isExternal(ds, pid)) continue;
      const r = registrationAt(ds, pid, cut);
      if (r) regs.push({ personId: pid, at: r.at, status: statusAt(ds, r.registrationId, cut) });
    }
    const add = (factor: string, group: string, list: typeof regs) => {
      const v = list.filter((r) => vis.has(r.personId)).length;
      showUpDrivers.push({ factor, group, registrants: list.length, visitors: v, showRate: list.length ? v / list.length : null });
    };
    for (const st of ['confirmed', 'cancelled', 'waitlisted', 'interested']) add('Final status', st, regs.filter((r) => (r.status ?? 'interested') === st));
    const conf = regs.filter((r) => r.status === 'confirmed');
    const lead = (r: { at: number }) => (ds.event.startsAt - r.at) / DAY_MS;
    for (const [label, lo, hi] of [['0-14 days before', -1, 14], ['15-30 days before', 14, 30], ['31-60 days before', 30, 60], ['60+ days before', 60, 1e9]] as const) {
      add('Lead time (confirmed only)', label, conf.filter((r) => lead(r) > lo && lead(r) <= hi));
    }
    const did = new Map<string, Set<string>>();
    for (const i of ds.interactions) {
      if (i.at > cut) continue;
      (did.get(i.type) ?? did.set(i.type, new Set()).get(i.type)!).add(i.personId);
    }
    for (const [type, label] of [['brochure_download', 'Downloaded programme'], ['event_question_submitted', 'Asked a question'], ['nurture_email_clicked', 'Clicked nurture email']] as const) {
      const set = did.get(type) ?? new Set();
      add(label, 'yes', regs.filter((r) => set.has(r.personId)));
      add(label, 'no', regs.filter((r) => !set.has(r.personId)));
    }
  }

  // ---- data quality
  const it = ds.importStats?.tables ?? {};
  const dup = (k: string) => it[k]?.duplicateIds ?? 0;
  const knownCampaigns = new Set(ds.campaigns.map((c) => c.campaignId));
  const orphanDaily = ds.daily.filter((d) => !knownCampaigns.has(d.campaignId)).length;
  const postEventSpend = ds.daily.filter((d) => cutoffFor(d.date) > ds.event.endsAt && d.date <= asOf).reduce((s, d) => s + d.spend, 0);
  const dataQuality: Diagnosis['dataQuality'] = [
    { item: 'Duplicate import rows removed', value: dup('daily') + dup('history') + dup('checkins') + dup('interactions') + dup('registrations') + dup('people'), note: `daily ${dup('daily')}, status history ${dup('history')}, check-ins ${dup('checkins')}, interactions ${dup('interactions')}` },
    { item: 'Non-external admissions excluded', value: snap.excluded.nonExternalAdmissions, note: 'internal, staff and test people never count as visitors' },
    { item: 'Denied or unverified check-ins excluded', value: snap.excluded.deniedOrPending, note: 'only admitted + verified records establish attendance' },
    { item: 'Walk-in visitors (no registration)', value: snap.excluded.walkInVisitors, note: 'counted as visitors, shown as an unattributed bucket' },
    { item: 'Manual admissions among verified external', value: snap.excluded.manualAdmissions, note: 'manual records can overlap scanner records; deduplicated by person' },
    { item: 'Negative spend rows (vendor credits)', value: snap.excluded.negativeSpendRows, note: 'netted into spend on their posting date' },
    { item: 'Net spend posted after the event', value: inr(postEventSpend), note: 'post-event ledger adjustments are included only when the as-of date reaches them' },
    { item: 'Daily rows for unknown campaigns', value: orphanDaily, note: orphanDaily ? 'check campaign IDs' : 'none' },
  ];

  return {
    asOf,
    phase: snap.phase,
    funnel,
    biggestDrop,
    bottlenecks,
    allStageGaps: all,
    signals,
    drivers: { window: `${addDays(asOf, -6)} to ${asOf} vs previous 7 days`, totalLast7, totalPrev7, delta: totDelta, rows },
    showUpDrivers,
    dataQuality,
  };
}

