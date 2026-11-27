import { addDays, cutoffFor, DAY_MS, istDate } from './time';
import type { Campaign, Dataset, Registration, Target } from './types';

export const UNATTRIBUTED = 'UNATTRIBUTED';

export interface Counts {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number; // platform daily reach summed: NOT unique people
  lpSessions: number;
  regStarts: number; // anonymous form starts
  identified: number; // distinct external people (first-touch campaign)
  registrations: number; // distinct external people with a registration (registration campaign)
  confirmed: number;
  cancelled: number;
  waitlisted: number;
  interested: number;
  visitors: number; // distinct verified external visitors
  registeredVisitors: number; // visitors who hold a registration
  optOuts: number;
  questions: number;
  brochures: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  identifiedRegStarts: number;
  matureIdentified: number; // identified 14+ days before the cutoff (had time to register)
  matureRegistered: number; // ...of whom registered by the cutoff
}

/** People take up to 14 days (median 7) from first identification to registration in the source data. */
export const MATURITY_DAYS = 14;

export interface CampaignMetrics extends Counts {
  campaignId: string;
  name: string;
  channel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  origin: string;
  plannedBudget: number | null;
  rates: {
    ctr: number | null;
    clickToLp: number | null;
    lpToStart: number | null;
    identToReg: number | null;
    identToRegMature: number | null; // cohort identified 14+ days ago: unbiased by recency
    regToConfirmed: number | null;
    confirmedToVisit: number | null;
    regToVisit: number | null; // show-up rate of registrants
    cancelRate: number | null;
    optOutRate: number | null;
    questionRate: number | null;
    brochureRate: number | null;
  };
  costs: {
    perIdentified: number | null;
    perRegistration: number | null;
    perConfirmed: number | null;
    perVisitor: number | null; // actual verified visitors (post-event)
    perExpectedVisitor: number | null; // pre-event: spend / (confirmed x show-rate assumption)
  };
  shares: { spend: number | null; registrations: number | null; visitors: number | null };
  momentum: { regsLast7: number; regsPrev7: number; regsLast14: number; identLast14: number; spendLast14: number; spendLast7: number };
  expectedVisitors: number; // post-event = actual visitors; before = confirmed x show-rate assumption
  showRateAssumption: number;
}

export type Phase = 'pre-launch' | 'campaign' | 'event' | 'post-event';

export interface Projection {
  daysLeft: number;
  method: string;
  assumptions: string[];
  registrations: number;
  confirmed: number;
  visitors: number;
  identified: number;
  spend: number;
  requiredDailyRegistrations: number | null;
  currentDailyRegistrations: number;
  byCampaign: { campaignId: string; registrations: number; confirmed: number; visitors: number }[];
}

export interface Snapshot {
  asOf: string;
  cutoff: number;
  phase: Phase;
  daysToEvent: number;
  event: Dataset['event'];
  dataVersion: string;
  target: Target | null;
  targetHistory: Target[];
  campaigns: CampaignMetrics[]; // includes UNATTRIBUTED bucket last when non-empty
  totals: CampaignMetrics;
  attainment: { identified: number | null; registrations: number | null; visitors: number | null; budgetUsed: number | null };
  projection: Projection | null;
  excluded: { nonExternalAdmissions: number; deniedOrPending: number; walkInVisitors: number; manualAdmissions: number; negativeSpendRows: number };
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

function emptyCounts(): Counts {
  return {
    spend: 0, impressions: 0, clicks: 0, reach: 0, lpSessions: 0, regStarts: 0, identified: 0, registrations: 0, confirmed: 0, cancelled: 0,
    waitlisted: 0, interested: 0, visitors: 0, registeredVisitors: 0, optOuts: 0, questions: 0, brochures: 0, emailsSent: 0, emailsOpened: 0,
    emailsClicked: 0, identifiedRegStarts: 0, matureIdentified: 0, matureRegistered: 0,
  };
}

export function targetAt(ds: Dataset, cut: number): Target | null {
  let cur: Target | null = null;
  for (const t of ds.targets) if (t.effectiveAt <= cut) cur = t;
  return cur;
}

/** Latest full-state status of a registration at the cutoff (never a later version). */
export function statusAt(ds: Dataset, registrationId: string, cut: number): string | null {
  const versions = ds.history.get(registrationId);
  if (!versions) return null;
  let st: string | null = null;
  for (const v of versions) {
    if (v.at <= cut) st = v.status;
    else break;
  }
  return st;
}

export function isExternal(ds: Dataset, personId: string) {
  return ds.people.get(personId)?.type === 'external';
}

/** A person's registration that counts at the cutoff: their most recent registration created on/before it. */
export function registrationAt(ds: Dataset, personId: string, cut: number): Registration | null {
  const regs = ds.regsByPerson.get(personId);
  if (!regs) return null;
  let r: Registration | null = null;
  for (const x of regs) if (x.at <= cut) r = x;
  return r;
}

/** Verified admission = result admitted AND verification verified AND person_type external. */
export function verifiedVisitorFirstEntry(ds: Dataset, cut: number): Map<string, number> {
  const first = new Map<string, number>();
  for (const c of ds.checkins) {
    if (c.at > cut || c.result !== 'admitted' || c.verification !== 'verified' || !isExternal(ds, c.personId)) continue;
    const prev = first.get(c.personId);
    if (prev === undefined || c.at < prev) first.set(c.personId, c.at);
  }
  return first;
}

export function visitorCampaign(ds: Dataset, personId: string, cut: number): string {
  const reg = registrationAt(ds, personId, cut) ?? ds.regsByPerson.get(personId)?.[0] ?? null;
  if (reg?.campaignId) return reg.campaignId;
  const chk = ds.checkins.find((c) => c.personId === personId && c.campaignId);
  if (chk?.campaignId) return chk.campaignId;
  return ds.people.get(personId)?.firstCampaignId ?? UNATTRIBUTED;
}

export function showRateFor(ds: Dataset, campaignId: string) {
  return ds.settings.showRateByCampaign[campaignId] ?? ds.settings.showRateAssumption;
}

export function phaseAt(ds: Dataset, cut: number): Phase {
  if (cut < Date.parse(`${ds.event.historyStart}T00:00:00+05:30`)) return 'pre-launch';
  if (cut < ds.event.startsAt) return 'campaign';
  if (cut < ds.event.endsAt) return 'event';
  return 'post-event';
}

export function computeSnapshot(ds: Dataset, asOf: string): Snapshot {
  const cut = cutoffFor(asOf);
  const phase = phaseAt(ds, cut);
  const last7Start = cutoffFor(addDays(asOf, -7)); // exclusive lower bound
  const prev7Start = cutoffFor(addDays(asOf, -14));
  const last14Date = addDays(asOf, -13);
  const last7Date = addDays(asOf, -6);

  const campaignById = new Map<string, Campaign>(ds.campaigns.map((c) => [c.campaignId, c]));
  const buckets = new Map<string, Counts & { regsLast7: number; regsPrev7: number; identLast14: number; spendLast14: number; spendLast7: number }>();
  const bucket = (id: string | null | undefined) => {
    const k = id ?? UNATTRIBUTED;
    let b = buckets.get(k);
    if (!b) {
      b = { ...emptyCounts(), regsLast7: 0, regsPrev7: 0, identLast14: 0, spendLast14: 0, spendLast7: 0 };
      buckets.set(k, b);
    }
    return b;
  };
  for (const c of ds.campaigns) bucket(c.campaignId);

  // anonymous daily activity and net spend (activity_date <= selected day)
  let negativeSpendRows = 0;
  for (const d of ds.daily) {
    if (d.date > asOf) continue;
    const b = bucket(d.campaignId);
    b.spend += d.spend;
    b.impressions += d.impressions;
    b.clicks += d.clicks;
    b.reach += d.reach;
    b.lpSessions += d.lpSessions;
    b.regStarts += d.regStarts;
    if (d.date >= last14Date) b.spendLast14 += d.spend;
    if (d.date >= last7Date) b.spendLast7 += d.spend;
    if (d.spend < 0) negativeSpendRows++;
  }

  // identified external people by fixed first-touch campaign
  const matureCut = cut - MATURITY_DAYS * DAY_MS;
  for (const p of ds.people.values()) {
    if (p.type !== 'external' || p.firstSeenAt > cut) continue;
    const b = bucket(p.firstCampaignId);
    b.identified++;
    if (p.firstSeenAt > prev7Start) b.identLast14++;
    if (p.firstSeenAt <= matureCut && p.firstTouch !== 'walk_in' && p.firstTouch !== 'event_access') {
      b.matureIdentified++;
      if (registrationAt(ds, p.personId, cut)) b.matureRegistered++;
    }
  }

  // registrations: distinct external people, counted once, attributed to their registration's campaign
  const registeredPeople = new Set<string>();
  for (const [personId, regs] of ds.regsByPerson) {
    if (!isExternal(ds, personId)) continue;
    const reg = registrationAt(ds, personId, cut);
    if (!reg) continue;
    registeredPeople.add(personId);
    const b = bucket(reg.campaignId);
    b.registrations++;
    const firstAt = regs[0].at;
    if (firstAt > last7Start) b.regsLast7++;
    else if (firstAt > prev7Start) b.regsPrev7++;
    const st = statusAt(ds, reg.registrationId, cut) ?? 'interested';
    if (st === 'confirmed') b.confirmed++;
    else if (st === 'cancelled') b.cancelled++;
    else if (st === 'waitlisted') b.waitlisted++;
    else b.interested++;
  }

  // identified engagement (distinct external people per campaign context)
  const seen = new Map<string, Set<string>>();
  const mark = (key: string, campaignId: string | null, personId: string) => {
    const k = `${key}|${campaignId ?? UNATTRIBUTED}`;
    let s = seen.get(k);
    if (!s) seen.set(k, (s = new Set()));
    if (s.has(personId)) return false;
    s.add(personId);
    return true;
  };
  for (const i of ds.interactions) {
    if (i.at > cut || !isExternal(ds, i.personId)) continue;
    if (!mark(i.type, i.campaignId, i.personId)) continue;
    const b = bucket(i.campaignId);
    switch (i.type) {
      case 'opted_out': b.optOuts++; break;
      case 'event_question_submitted': b.questions++; break;
      case 'brochure_download': b.brochures++; break;
      case 'nurture_email_sent': b.emailsSent++; break;
      case 'nurture_email_opened': b.emailsOpened++; break;
      case 'nurture_email_clicked': b.emailsClicked++; break;
      case 'registration_start': b.identifiedRegStarts++; break;
    }
  }

  // verified external visitors
  const firstEntry = verifiedVisitorFirstEntry(ds, cut);
  let walkInVisitors = 0;
  for (const personId of firstEntry.keys()) {
    const b = bucket(visitorCampaign(ds, personId, cut));
    b.visitors++;
    if (registeredPeople.has(personId)) b.registeredVisitors++;
    else walkInVisitors++;
  }
  let nonExternalAdmissions = 0;
  let deniedOrPending = 0;
  let manualAdmissions = 0;
  for (const c of ds.checkins) {
    if (c.at > cut) continue;
    if (c.result !== 'admitted' || c.verification !== 'verified') deniedOrPending++;
    else if (!isExternal(ds, c.personId)) nonExternalAdmissions++;
    else if (c.source === 'manual') manualAdmissions++;
  }

  const postEvent = phase === 'post-event' || phase === 'event';
  const toMetrics = (id: string, b: Counts & { regsLast7: number; regsPrev7: number; identLast14: number; spendLast14: number; spendLast7: number }, total?: Counts): CampaignMetrics => {
    const c = campaignById.get(id);
    const showRate = id === 'ALL' ? ds.settings.showRateAssumption : showRateFor(ds, id);
    const expectedVisitors = postEvent ? b.visitors : b.confirmed * showRate;
    return {
      ...b,
      campaignId: id,
      name: id === UNATTRIBUTED ? 'Walk-ins / unattributed' : id === 'ALL' ? 'All campaigns' : c?.name ?? id,
      channel: c?.channel ?? (id === UNATTRIBUTED ? 'walk_in' : null),
      ownerId: c?.ownerId ?? null,
      ownerName: c?.ownerId ? ds.team.get(c.ownerId)?.ownerName ?? c.ownerId : null,
      status: c?.status ?? (id === UNATTRIBUTED ? 'n/a' : 'active'),
      origin: c?.origin ?? 'derived',
      plannedBudget: c?.plannedBudget ?? null,
      rates: {
        ctr: div(b.clicks, b.impressions),
        clickToLp: div(b.lpSessions, b.clicks),
        lpToStart: div(b.regStarts, b.lpSessions),
        identToReg: div(b.registrations, b.identified),
        identToRegMature: div(b.matureRegistered, b.matureIdentified),
        regToConfirmed: div(b.confirmed, b.registrations),
        confirmedToVisit: postEvent ? div(b.registeredVisitors, b.confirmed) : null,
        regToVisit: postEvent ? div(b.registeredVisitors, b.registrations) : null,
        cancelRate: div(b.cancelled, b.registrations),
        optOutRate: div(b.optOuts, b.identified),
        questionRate: div(b.questions, b.identified),
        brochureRate: div(b.brochures, b.identified),
      },
      costs: {
        perIdentified: div(b.spend, b.identified),
        perRegistration: div(b.spend, b.registrations),
        perConfirmed: div(b.spend, b.confirmed),
        perVisitor: postEvent ? div(b.spend, b.visitors) : null,
        perExpectedVisitor: div(b.spend, expectedVisitors),
      },
      shares: {
        spend: total ? div(b.spend, total.spend) : 1,
        registrations: total ? div(b.registrations, total.registrations) : 1,
        visitors: total ? div(b.visitors, total.visitors) : 1,
      },
      momentum: { regsLast7: b.regsLast7, regsPrev7: b.regsPrev7, regsLast14: b.regsLast7 + b.regsPrev7, identLast14: b.identLast14, spendLast14: b.spendLast14, spendLast7: b.spendLast7 },
      expectedVisitors,
      showRateAssumption: showRate,
    };
  };

  const tot = { ...emptyCounts(), regsLast7: 0, regsPrev7: 0, identLast14: 0, spendLast14: 0, spendLast7: 0 };
  for (const b of buckets.values()) for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += b[k];
  const ids = [...buckets.keys()].filter((k) => k !== UNATTRIBUTED);
  ids.sort((a, b) => a.localeCompare(b));
  const unattr = buckets.get(UNATTRIBUTED);
  if (unattr && (unattr.identified || unattr.visitors || unattr.registrations || unattr.spend)) ids.push(UNATTRIBUTED);
  const campaigns = ids.map((id) => toMetrics(id, buckets.get(id)!, tot));
  const totals = toMetrics('ALL', tot);
  // total expected visitors = sum of per-campaign expectations (respects per-campaign show-rate overrides)
  if (!postEvent) {
    totals.expectedVisitors = campaigns.reduce((s, c) => s + c.expectedVisitors, 0);
    totals.costs.perExpectedVisitor = div(totals.spend, totals.expectedVisitors);
  }

  const target = targetAt(ds, cut);
  const daysToEvent = (ds.event.startsAt - cut) / DAY_MS;

  let projection: Projection | null = null;
  if (phase === 'campaign' || phase === 'pre-launch') {
    const daysLeft = Math.max(0, daysToEvent);
    const by = campaigns
      .filter((c) => c.campaignId !== UNATTRIBUTED)
      .map((c) => {
        const rate = c.momentum.regsLast14 / 14;
        const regs = c.registrations + rate * daysLeft;
        const ratio = c.registrations > 0 ? c.confirmed / c.registrations : totals.registrations > 0 ? totals.confirmed / totals.registrations : 0.85;
        const confirmed = regs * ratio;
        return { campaignId: c.campaignId, registrations: regs, confirmed, visitors: confirmed * c.showRateAssumption };
      });
    const registrations = by.reduce((s, x) => s + x.registrations, 0);
    const currentDaily = totals.momentum.regsLast14 / 14;
    projection = {
      daysLeft,
      method: 'Linear run-rate: each campaign keeps its last-14-day registration pace until the event opens; confirmed share stays at today\'s level; visitors = projected confirmed x show-rate assumption.',
      assumptions: [
        `Show-rate assumption ${(ds.settings.showRateAssumption * 100).toFixed(0)}% of confirmed registrants (planning assumption from Settings, not observed data${Object.keys(ds.settings.showRateByCampaign).length ? '; some campaigns overridden' : ''}).`,
        'No walk-ins are added to the projection (walk-ins are only known on event days).',
        'Spend continues at the last-14-day net average.',
      ],
      registrations,
      confirmed: by.reduce((s, x) => s + x.confirmed, 0),
      visitors: by.reduce((s, x) => s + x.visitors, 0),
      identified: totals.identified + (totals.momentum.identLast14 / 14) * daysLeft,
      spend: totals.spend + (totals.momentum.spendLast14 / 14) * daysLeft,
      requiredDailyRegistrations: target && daysLeft > 0 ? Math.max(0, (target.registrationGoal - totals.registrations) / daysLeft) : null,
      currentDailyRegistrations: currentDaily,
      byCampaign: by,
    };
  }

  return {
    asOf,
    cutoff: cut,
    phase,
    daysToEvent,
    event: ds.event,
    dataVersion: ds.version,
    target,
    targetHistory: ds.targets.filter((t) => t.effectiveAt <= cut),
    campaigns,
    totals,
    attainment: {
      identified: target ? div(totals.identified, target.identifiedGoal) : null,
      registrations: target ? div(totals.registrations, target.registrationGoal) : null,
      visitors: target ? div(totals.visitors, target.visitorsGoal) : null,
      budgetUsed: target ? div(totals.spend, target.budget) : null,
    },
    projection,
    excluded: { nonExternalAdmissions, deniedOrPending, walkInVisitors, manualAdmissions, negativeSpendRows },
  };
}

/** Latest date covered by any source record (used as the default as-of date). */
export function latestDataDate(ds: Dataset): string {
  let max = ds.event.historyEnd;
  for (const d of ds.daily) if (d.date > max) max = d.date;
  const lastTs = Math.max(
    ...ds.checkins.map((c) => c.at),
    ...ds.registrations.map((r) => r.at),
    0,
  );
  if (lastTs) {
    const d = istDate(lastTs);
    if (d > max) max = d;
  }
  return max;
}
