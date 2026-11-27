import { cutoffFor, daysBetween, addDays, istDate, isoWeek } from './time';
import { isExternal, targetAt, verifiedVisitorFirstEntry, visitorCampaign, UNATTRIBUTED } from './snapshot';
import type { Dataset } from './types';

export interface DailyPoint {
  date: string;
  newIdentified: number;
  identified: number;
  newRegistrations: number;
  registrations: number;
  confirmed: number;
  cancelled: number;
  waitlisted: number;
  interested: number;
  newVisitors: number;
  visitors: number;
  spend: number;
  cumSpend: number;
  impressions: number;
  clicks: number;
  lpSessions: number;
  regStarts: number;
  optOuts: number;
  registrationGoal: number | null;
  visitorsGoal: number | null;
  budget: number | null;
  /** Linear pace toward the registration goal in force (campaign start -> event start). */
  registrationPace: number | null;
  /** Linear pace toward the budget in force. */
  spendPace: number | null;
}

export interface Series {
  asOf: string;
  campaignId: string | null;
  start: string;
  points: DailyPoint[];
  byCampaign: Record<string, { registrations: number[]; spend: number[]; identified: number[]; visitors: number[] }>;
}

/**
 * Day-by-day series from the first covered day to the as-of date.
 * Stocks (registrations, statuses, visitors) are computed as they stood at the END of each IST day,
 * so a past day never reflects later changes.
 */
export function computeDaily(ds: Dataset, asOf: string, campaignId: string | null = null): Series {
  const start = ds.event.historyStart;
  const end = asOf < start ? start : asOf;
  const n = daysBetween(start, end) + 1;
  const dates = Array.from({ length: n }, (_, i) => addDays(start, i));
  const cut = cutoffFor(asOf);
  const idx = (ts: number) => {
    const i = daysBetween(start, istDate(ts));
    return i >= 0 && i < n ? i : -1;
  };
  const z = () => new Array<number>(n).fill(0);
  const newIdent = z(), newRegs = z(), newVis = z(), spend = z(), imp = z(), clk = z(), lps = z(), rst = z(), opt = z();
  const byCampaign: Series['byCampaign'] = {};
  const cb = (id: string) => (byCampaign[id] ??= { registrations: z(), spend: z(), identified: z(), visitors: z() });
  const match = (id: string | null | undefined) => campaignId === null || (id ?? UNATTRIBUTED) === campaignId;

  for (const p of ds.people.values()) {
    if (p.type !== 'external' || p.firstSeenAt > cut || !match(p.firstCampaignId)) continue;
    const i = idx(p.firstSeenAt);
    if (i < 0) continue;
    newIdent[i]++;
    cb(p.firstCampaignId ?? UNATTRIBUTED).identified[i]++;
  }

  // registrations: first registration per external person; statuses swept day by day
  const regIds: string[] = [];
  for (const [personId, regs] of ds.regsByPerson) {
    if (!isExternal(ds, personId)) continue;
    const counted = regs.filter((r) => r.at <= cut);
    if (!counted.length) continue;
    const latest = counted[counted.length - 1];
    if (!match(latest.campaignId)) continue;
    const i = idx(counted[0].at);
    if (i >= 0) {
      newRegs[i]++;
      cb(latest.campaignId ?? UNATTRIBUTED).registrations[i]++;
    }
    regIds.push(latest.registrationId);
  }
  const events = regIds
    .flatMap((rid) => (ds.history.get(rid) ?? []).filter((v) => v.at <= cut))
    .sort((a, b) => a.at - b.at || (a.historyId < b.historyId ? -1 : 1));
  const statusOf = new Map<string, string>();
  const counts: Record<string, number> = { confirmed: 0, cancelled: 0, waitlisted: 0, interested: 0 };
  const stock = { confirmed: z(), cancelled: z(), waitlisted: z(), interested: z() };
  let e = 0;
  for (let i = 0; i < n; i++) {
    const dayEnd = cutoffFor(dates[i]);
    while (e < events.length && events[e].at <= Math.min(dayEnd, cut)) {
      const v = events[e++];
      const prev = statusOf.get(v.registrationId);
      if (prev && prev in counts) counts[prev]--;
      const st = v.status in counts ? v.status : 'interested';
      counts[st]++;
      statusOf.set(v.registrationId, st);
    }
    stock.confirmed[i] = counts.confirmed;
    stock.cancelled[i] = counts.cancelled;
    stock.waitlisted[i] = counts.waitlisted;
    stock.interested[i] = counts.interested;
  }

  for (const [personId, at] of verifiedVisitorFirstEntry(ds, cut)) {
    const c = visitorCampaign(ds, personId, cut);
    if (!match(c === UNATTRIBUTED ? null : c)) continue;
    const i = idx(at);
    if (i < 0) continue;
    newVis[i]++;
    cb(c).visitors[i]++;
  }

  for (const d of ds.daily) {
    if (d.date > asOf || !match(d.campaignId)) continue;
    const i = daysBetween(start, d.date);
    if (i < 0 || i >= n) continue;
    spend[i] += d.spend;
    imp[i] += d.impressions;
    clk[i] += d.clicks;
    lps[i] += d.lpSessions;
    rst[i] += d.regStarts;
    cb(d.campaignId).spend[i] += d.spend;
  }
  for (const it of ds.interactions) {
    if (it.type !== 'opted_out' || it.at > cut || !isExternal(ds, it.personId) || !match(it.campaignId)) continue;
    const i = idx(it.at);
    if (i >= 0) opt[i]++;
  }

  const startTs = Date.parse(`${start}T00:00:00+05:30`);
  const span = Math.max(1, ds.event.startsAt - startTs);
  let ci = 0, cr = 0, cv = 0, cs = 0;
  const points: DailyPoint[] = dates.map((date, i) => {
    ci += newIdent[i];
    cr += newRegs[i];
    cv += newVis[i];
    cs += spend[i];
    const t = targetAt(ds, cutoffFor(date));
    const frac = Math.min(1, Math.max(0, (cutoffFor(date) - startTs) / span));
    const whole = campaignId === null;
    return {
      date,
      newIdentified: newIdent[i],
      identified: ci,
      newRegistrations: newRegs[i],
      registrations: cr,
      confirmed: stock.confirmed[i],
      cancelled: stock.cancelled[i],
      waitlisted: stock.waitlisted[i],
      interested: stock.interested[i],
      newVisitors: newVis[i],
      visitors: cv,
      spend: spend[i],
      cumSpend: cs,
      impressions: imp[i],
      clicks: clk[i],
      lpSessions: lps[i],
      regStarts: rst[i],
      optOuts: opt[i],
      registrationGoal: whole && t ? t.registrationGoal : null,
      visitorsGoal: whole && t ? t.visitorsGoal : null,
      budget: whole && t ? t.budget : null,
      registrationPace: whole && t ? Math.round(t.registrationGoal * frac) : null,
      spendPace: whole && t ? Math.round(t.budget * frac) : null,
    };
  });
  return { asOf, campaignId, start, points, byCampaign };
}

export interface WeeklyPoint {
  week: string;
  monday: string;
  newIdentified: number;
  newRegistrations: number;
  newVisitors: number;
  spend: number;
  impressions: number;
  clicks: number;
  optOuts: number;
  registrations: number;
  confirmed: number;
  costPerRegistration: number | null;
  byCampaign: Record<string, { registrations: number; spend: number; identified: number }>;
}

export function toWeekly(series: Series): WeeklyPoint[] {
  const out = new Map<string, WeeklyPoint>();
  series.points.forEach((p, i) => {
    const w = isoWeek(p.date);
    let row = out.get(w.label);
    if (!row) {
      row = { week: w.label, monday: w.monday, newIdentified: 0, newRegistrations: 0, newVisitors: 0, spend: 0, impressions: 0, clicks: 0, optOuts: 0, registrations: 0, confirmed: 0, costPerRegistration: null, byCampaign: {} };
      out.set(w.label, row);
    }
    row.newIdentified += p.newIdentified;
    row.newRegistrations += p.newRegistrations;
    row.newVisitors += p.newVisitors;
    row.spend += p.spend;
    row.impressions += p.impressions;
    row.clicks += p.clicks;
    row.optOuts += p.optOuts;
    row.registrations = p.registrations;
    row.confirmed = p.confirmed;
    for (const [cid, s] of Object.entries(series.byCampaign)) {
      const b = (row.byCampaign[cid] ??= { registrations: 0, spend: 0, identified: 0 });
      b.registrations += s.registrations[i];
      b.spend += s.spend[i];
      b.identified += s.identified[i];
    }
  });
  for (const r of out.values()) r.costPerRegistration = r.newRegistrations > 0 ? r.spend / r.newRegistrations : null;
  return [...out.values()];
}
