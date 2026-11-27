import { tool } from 'ai';
import { z } from 'zod';
import { evaluate } from 'mathjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '../db';
import { getDataset } from '../dataset';
import { computeSnapshot, latestDataDate, UNATTRIBUTED, type CampaignMetrics, type Snapshot } from '../engine/snapshot';
import { computeDiagnosis } from '../engine/diagnose';
import { computeDecisions } from '../engine/decide';
import { simulateReallocation } from '../engine/simulate';
import { computeEventDays } from '../engine/eventday';
import { computeDaily, toWeekly } from '../engine/timeseries';
import { isIsoDate, istLabel } from '../engine/time';
import { createTask, listTasks, updateCampaign, updateTask, ValidationError } from '../mutations';
import { resolveCampaign, resolveOwner } from './resolve';
import type { Dataset } from '../engine/types';

const r1 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const r0 = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
const pct = (x: number | null | undefined) => (x == null ? null : Math.round(x * 1000) / 10);

function compactCampaign(c: CampaignMetrics, post: boolean) {
  return {
    campaign_id: c.campaignId,
    campaign: c.name,
    channel: c.channel,
    owner: c.ownerName,
    status: c.status,
    net_spend_inr: r0(c.spend),
    impressions: r0(c.impressions),
    clicks: r0(c.clicks),
    landing_page_sessions: r0(c.lpSessions),
    anonymous_form_starts: r0(c.regStarts),
    identified_people: c.identified,
    registrations: c.registrations,
    confirmed: c.confirmed,
    cancelled: c.cancelled,
    waitlisted: c.waitlisted,
    still_interested: c.interested,
    verified_visitors: post ? c.visitors : 'event not yet held at this date',
    rates_pct: {
      ctr: pct(c.rates.ctr),
      click_to_landing: pct(c.rates.clickToLp),
      landing_to_form_start: pct(c.rates.lpToStart),
      identified_to_registered: pct(c.rates.identToReg),
      identified_to_registered_mature_cohort: pct(c.rates.identToRegMature),
      registered_to_confirmed: pct(c.rates.regToConfirmed),
      confirmed_to_attended: post ? pct(c.rates.confirmedToVisit) : null,
      registrant_show_rate: post ? pct(c.rates.regToVisit) : null,
      cancellation_rate: pct(c.rates.cancelRate),
      opt_out_rate: pct(c.rates.optOutRate),
      question_rate: pct(c.rates.questionRate),
      programme_download_rate: pct(c.rates.brochureRate),
    },
    cost_inr: {
      per_identified: r0(c.costs.perIdentified),
      per_registration: r0(c.costs.perRegistration),
      per_confirmed: r0(c.costs.perConfirmed),
      per_verified_visitor: post ? r0(c.costs.perVisitor) : null,
      per_expected_visitor: post ? null : r0(c.costs.perExpectedVisitor),
    },
    share_pct: { of_spend: pct(c.shares.spend), of_registrations: pct(c.shares.registrations), of_visitors: post ? pct(c.shares.visitors) : null },
    last_7_days: { registrations: c.momentum.regsLast7, previous_7_days_registrations: c.momentum.regsPrev7, net_spend_inr: r0(c.momentum.spendLast7) },
    expected_visitors: post ? null : r1(c.expectedVisitors),
    planned_budget_inr: c.plannedBudget,
  };
}

const METRICS = [
  'net_spend_inr', 'registrations', 'confirmed', 'verified_visitors', 'identified_people', 'cost_per_verified_visitor', 'cost_per_registration', 'cost_per_expected_visitor',
  'registrant_show_rate', 'identified_to_registered', 'registered_to_confirmed', 'cancellation_rate', 'opt_out_rate', 'ctr', 'landing_to_form_start', 'cancelled', 'waitlisted', 'clicks', 'impressions',
] as const;

function metricValue(c: CampaignMetrics, m: (typeof METRICS)[number], post: boolean): number | null {
  switch (m) {
    case 'net_spend_inr': return c.spend;
    case 'registrations': return c.registrations;
    case 'confirmed': return c.confirmed;
    case 'verified_visitors': return post ? c.visitors : null;
    case 'identified_people': return c.identified;
    case 'cost_per_verified_visitor': return post ? c.costs.perVisitor : null;
    case 'cost_per_registration': return c.costs.perRegistration;
    case 'cost_per_expected_visitor': return c.costs.perExpectedVisitor;
    case 'registrant_show_rate': return post ? c.rates.regToVisit : null;
    case 'identified_to_registered': return c.rates.identToReg;
    case 'registered_to_confirmed': return c.rates.regToConfirmed;
    case 'cancellation_rate': return c.rates.cancelRate;
    case 'opt_out_rate': return c.rates.optOutRate;
    case 'ctr': return c.rates.ctr;
    case 'landing_to_form_start': return c.rates.lpToStart;
    case 'cancelled': return c.cancelled;
    case 'waitlisted': return c.waitlisted;
    case 'clicks': return c.clicks;
    case 'impressions': return c.impressions;
  }
}

export interface ToolContext {
  db: Db;
  defaultAsOf: string;
  today: string;
}

const SQL_FORBIDDEN = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|vacuum|analyze|reindex|cluster|comment|lock|listen|notify|prepare|execute|set|reset|discard|refresh|security|pg_sleep|dblink|lo_import|lo_export)\b/i;

export function buildTools(ctx: TaskCtx) {
  const asOfOf = (ds: Dataset, v?: string) => {
    if (!v) return ctx.defaultAsOf;
    if (!isIsoDate(v)) throw new Error(`as_of must be a date like 2025-03-15 (got "${v}").`);
    return v;
  };
  const isPost = (s: Snapshot) => s.phase === 'event' || s.phase === 'post-event';
  const asOfDesc = 'Snapshot date YYYY-MM-DD (end of that day, India time). Omit to use the dashboard\'s selected date.';

  return {
    get_overview: tool({
      description:
        'Headline status at a date: identified people, registrations, confirmed, unique verified external visitors, net spend vs budget, the target version in force and attainment, campaign phase, and (before the event) run-rate projections with their assumptions. Start here for most questions.',
      inputSchema: z.object({ as_of: z.string().optional().describe(asOfDesc) }),
      execute: async ({ as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const s = computeSnapshot(ds, asOf);
        const post = isPost(s);
        const t = s.totals;
        return {
          as_of: asOf,
          cutoff: `end of ${asOf} IST`,
          phase: s.phase,
          event: { name: ds.event.name, starts: istLabel(ds.event.startsAt), ends: istLabel(ds.event.endsAt), data_covers: `${ds.event.historyStart} to ${latestDataDate(ds)}` },
          target_in_force: s.target ? { version: s.target.version, effective_from: istLabel(s.target.effectiveAt), identified_goal: s.target.identifiedGoal, registration_goal: s.target.registrationGoal, unique_visitors_goal: s.target.visitorsGoal, marketing_budget_inr: s.target.budget } : 'no target version effective yet',
          actuals: {
            identified_external_people: t.identified,
            registered_external_people: t.registrations,
            confirmed: t.confirmed,
            cancelled: t.cancelled,
            waitlisted: t.waitlisted,
            still_interested_unconfirmed: t.interested,
            unique_verified_external_visitors: post ? t.visitors : 'event not yet held at this date',
            walk_in_visitors_without_registration: post ? s.excluded.walkInVisitors : null,
            net_marketing_spend_inr: r0(t.spend),
          },
          attainment_pct: { identified: pct(s.attainment.identified), registrations: pct(s.attainment.registrations), visitors: post ? pct(s.attainment.visitors) : null, budget_used: pct(s.attainment.budgetUsed) },
          blended: { cost_per_registration_inr: r0(t.costs.perRegistration), cost_per_verified_visitor_inr: post ? r0(t.costs.perVisitor) : null, registrant_show_rate_pct: post ? pct(t.rates.regToVisit) : null, confirmed_show_rate_pct: post ? pct(t.rates.confirmedToVisit) : null },
          projection_to_event: s.projection
            ? { days_left: r1(s.projection.daysLeft), registrations: r0(s.projection.registrations), confirmed: r0(s.projection.confirmed), visitors: r0(s.projection.visitors), net_spend_inr: r0(s.projection.spend), current_registrations_per_day: r1(s.projection.currentDailyRegistrations), required_registrations_per_day_for_goal: r1(s.projection.requiredDailyRegistrations), method: s.projection.method, assumptions: s.projection.assumptions }
            : null,
          excluded_from_counts: { non_external_admissions: s.excluded.nonExternalAdmissions, denied_or_unverified_checkins: s.excluded.deniedOrPending },
          data_version: ds.version,
        };
      },
    }),

    get_campaign_metrics: tool({
      description:
        'Full funnel, rates, costs, shares and 7-day momentum for one campaign (by ID like C02, name like "Paid Social", or channel like "referrals") or for all campaigns when campaign is omitted. Includes the walk-in/unattributed bucket.',
      inputSchema: z.object({ campaign: z.string().optional().describe('Campaign ID, name or channel; omit for all campaigns'), as_of: z.string().optional().describe(asOfDesc) }),
      execute: async ({ campaign, as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const s = computeSnapshot(ds, asOf);
        const post = isPost(s);
        if (campaign) {
          const c = resolveCampaign(ds, campaign);
          if (!c) return { error: `No campaign matches "${campaign}".`, campaigns: ds.campaigns.map((x) => `${x.campaignId} ${x.name}`) };
          const m = s.campaigns.find((x) => x.campaignId === c.id);
          if (!m) return { as_of: asOf, campaign: c.name, note: 'No activity recorded for this campaign up to this date.' };
          return { as_of: asOf, phase: s.phase, ...compactCampaign(m, post) };
        }
        return { as_of: asOf, phase: s.phase, campaigns: s.campaigns.map((m) => compactCampaign(m, post)), totals: compactCampaign(s.totals, post) };
      },
    }),

    compare_campaigns: tool({
      description: 'Rank campaigns on one metric at a date (rates are percentages, costs in INR). Returns every campaign value plus the portfolio value. Use for "which campaign is best/worst at X".',
      inputSchema: z.object({
        metric: z.enum(METRICS),
        order: z.enum(['desc', 'asc']).optional().describe('desc = highest first (default)'),
        as_of: z.string().optional().describe(asOfDesc),
      }),
      execute: async ({ metric, order, as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const s = computeSnapshot(ds, asOf);
        const post = isPost(s);
        const isRate = /rate|ctr|_to_|show/.test(metric);
        const rows = s.campaigns
          .filter((c) => c.campaignId !== UNATTRIBUTED)
          .map((c) => ({ campaign_id: c.campaignId, campaign: c.name, value: metricValue(c, metric, post) }))
          .map((r) => ({ ...r, value: r.value == null ? null : isRate ? pct(r.value) : r1(r.value) }));
        const withVal = rows.filter((r) => r.value != null) as { campaign_id: string; campaign: string; value: number }[];
        withVal.sort((a, b) => (order === 'asc' ? a.value - b.value : b.value - a.value));
        const total = metricValue(s.totals, metric, post);
        return {
          as_of: asOf,
          metric,
          unit: isRate ? 'percent' : /cost|spend/.test(metric) ? 'INR' : 'count',
          ranking: withVal,
          not_available: rows.filter((r) => r.value == null).map((r) => r.campaign),
          portfolio_value: total == null ? null : isRate ? pct(total) : r1(total),
          note: !post && /visitor|show/.test(metric) && !/expected/.test(metric) ? 'The event has not happened at this date, so attendance metrics are not available; use cost_per_expected_visitor instead.' : undefined,
        };
      },
    }),

    get_trend: tool({
      description: 'Time series of one metric by day or ISO week, optionally for one campaign and a date window. Stocks (registrations, confirmed, cancelled, visitors) are cumulative as of each day; flows (new_*, spend, impressions, clicks, opt_outs) are per period.',
      inputSchema: z.object({
        metric: z.enum(['new_registrations', 'registrations_cumulative', 'new_identified', 'confirmed', 'cancelled', 'waitlisted', 'new_visitors', 'net_spend_inr', 'impressions', 'clicks', 'opt_outs', 'cost_per_registration']),
        granularity: z.enum(['day', 'week']),
        campaign: z.string().optional().describe('Campaign ID, name or channel; omit for all'),
        start_date: z.string().optional().describe('YYYY-MM-DD, inclusive'),
        end_date: z.string().optional().describe('YYYY-MM-DD, inclusive; defaults to the as-of date'),
      }),
      execute: async ({ metric, granularity, campaign, start_date, end_date }) => {
        const ds = await getDataset();
        const end = end_date && isIsoDate(end_date) ? end_date : ctx.defaultAsOf;
        let cid: string | null = null;
        if (campaign) {
          const c = resolveCampaign(ds, campaign);
          if (!c) return { error: `No campaign matches "${campaign}".` };
          cid = c.id;
        }
        const series = computeDaily(ds, end, cid);
        const pick = (p: (typeof series.points)[number]) =>
          ({ new_registrations: p.newRegistrations, registrations_cumulative: p.registrations, new_identified: p.newIdentified, confirmed: p.confirmed, cancelled: p.cancelled, waitlisted: p.waitlisted, new_visitors: p.newVisitors, net_spend_inr: p.spend, impressions: p.impressions, clicks: p.clicks, opt_outs: p.optOuts, cost_per_registration: p.newRegistrations ? p.spend / p.newRegistrations : null })[metric];
        if (granularity === 'week') {
          const w = toWeekly(series).filter((x) => !start_date || addDaysSafe(x.monday, 6) >= start_date.slice(0, 10));
          const val = (x: (typeof w)[number]) =>
            ({ new_registrations: x.newRegistrations, registrations_cumulative: x.registrations, new_identified: x.newIdentified, confirmed: x.confirmed, cancelled: null, waitlisted: null, new_visitors: x.newVisitors, net_spend_inr: x.spend, impressions: x.impressions, clicks: x.clicks, opt_outs: x.optOuts, cost_per_registration: x.costPerRegistration })[metric];
          return { metric, granularity, campaign: cid, through: end, points: w.map((x) => ({ week: x.week, week_starting: x.monday, value: r1(val(x) ?? null) })) };
        }
        const pts = series.points.filter((p) => !start_date || p.date >= start_date).map((p) => ({ date: p.date, value: r1(pick(p) ?? null) }));
        return { metric, granularity, campaign: cid, through: end, points: pts.length > 120 ? pts.slice(-120) : pts, truncated: pts.length > 120 };
      },
    }),

    diagnose: tool({
      description: 'Diagnosis at a date: overall funnel and its biggest drop, the worst stage per campaign vs the portfolio (people and visitors lost), alert signals (momentum drops, opt-outs, cancellations, waitlist, pacing vs target, budget), week-over-week drivers of registrations, show-up drivers (after the event) and data-quality notes.',
      inputSchema: z.object({ as_of: z.string().optional().describe(asOfDesc) }),
      execute: async ({ as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const d = computeDiagnosis(ds, asOf);
        return {
          as_of: asOf,
          phase: d.phase,
          funnel: d.funnel.map((f) => ({ stage: f.stage, count: r0(f.count), rate_from_previous_pct: pct(f.rateFromPrev), note: f.note })),
          biggest_drop: d.biggestDrop ? { ...d.biggestDrop, rate: pct(d.biggestDrop.rate) } : null,
          bottlenecks: d.bottlenecks.map((b) => b.explanation),
          signals: d.signals.map((s) => ({ severity: s.severity, title: s.title, evidence: s.evidence, suggested_action: s.suggestedAction })),
          week_over_week: { window: d.drivers.window, total_last_7: d.drivers.totalLast7, total_previous_7: d.drivers.totalPrev7, by_campaign: d.drivers.rows.slice(0, 7).map((r) => r.read) },
          show_up_drivers: d.showUpDrivers.map((x) => ({ factor: x.factor, group: x.group, registrants: x.registrants, attended: x.visitors, show_rate_pct: pct(x.showRate) })),
          data_quality: d.dataQuality,
          caveat: 'Associations, not proven causes: attribution is the recorded source and there was no holdout group.',
        };
      },
    }),

    get_decisions: tool({
      description: 'Scale / keep / change / stop recommendation per campaign with the rules that fired (efficiency vs portfolio median, opt-out, cancellation, show-up and momentum guardrails) and a suggested budget reallocation.',
      inputSchema: z.object({ as_of: z.string().optional().describe(asOfDesc) }),
      execute: async ({ as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const b = computeDecisions(ds, asOf);
        return {
          as_of: asOf,
          basis: b.basis,
          thresholds_inr: { scale_at_or_below: r0(b.thresholds.scaleAtOrBelow), change_above: r0(b.thresholds.changeAbove), stop_at_or_above: r0(b.thresholds.stopAtOrAbove) },
          recommendations: b.recommendations.map((r) => ({ campaign_id: r.campaignId, campaign: r.name, owner: r.ownerName, decision: r.decision, efficiency_inr: r0(r.efficiency), ratio_to_median: r.ratioToMedian == null ? null : Math.round(r.ratioToMedian * 100) / 100, reasons: r.reasons, action: r.suggestedAction })),
          suggested_reallocations: b.reallocations,
          notes: b.notes,
        };
      },
    }),

    simulate_budget_shift: tool({
      description: 'What-if: move an INR amount from one campaign to another and estimate the change in (expected) visitors using a diminishing-returns response curve. The curve is an assumption; say so when reporting.',
      inputSchema: z.object({
        from_campaign: z.string().describe('Campaign to take budget from (ID, name or channel)'),
        to_campaign: z.string().describe('Campaign to give budget to'),
        amount_inr: z.number().describe('Amount in INR, positive'),
        as_of: z.string().optional().describe(asOfDesc),
      }),
      execute: async ({ from_campaign, to_campaign, amount_inr, as_of }) => {
        const ds = await getDataset();
        const f = resolveCampaign(ds, from_campaign);
        const t = resolveCampaign(ds, to_campaign);
        if (!f || !t) return { error: `Could not resolve ${!f ? from_campaign : to_campaign} to a campaign.` };
        const asOf = asOfOf(ds, as_of);
        const s = computeSnapshot(ds, asOf);
        const sim = simulateReallocation(s, [{ from: f.id, to: t.id, amount: amount_inr }], ds.settings);
        return {
          as_of: asOf,
          basis: sim.basis,
          changed: sim.rows.filter((r) => r.delta !== 0 || r.spendAfter !== r.spendBefore).map((r) => ({ campaign: r.name, spend_before: r0(r.spendBefore), spend_after: r0(r.spendAfter), visitors_before: r1(r.visitorsBefore), visitors_after: r1(r.visitorsAfter), change: r1(r.delta), note: r.note })),
          campaign_attributed_visitors_before: r1(sim.totalBefore),
          campaign_attributed_visitors_after: r1(sim.totalAfter),
          scope_note: "Campaign-attributed (registered) visitors only; walk-ins without a registration are not affected by spend and are excluded from these totals.",
          net_change: r1(sim.delta),
          warnings: sim.warnings,
          assumption: `Response curve V = V0 x (spend ratio)^${sim.elasticity} (Settings > spendElasticity). Not a measured curve.`,
        };
      },
    }),

    get_event_day: tool({
      description:
        'Festival-day gate analytics (same engine as the dashboard\'s gate clock): per event day, unique verified visitors, people new to the event, first entries and all verified admission scans by India-time hour, the peak arrival hour, denied/pending scans, and how many people came on both days. Use for any question about arrivals, entry times, peak hours, gate load or repeat visits.',
      inputSchema: z.object({ as_of: z.string().optional().describe(asOfDesc) }),
      execute: async ({ as_of }) => {
        const ds = await getDataset();
        const asOf = asOfOf(ds, as_of);
        const e = computeEventDays(ds, asOf);
        if (!e.days.some((d) => d.uniqueVisitors > 0)) return { as_of: asOf, note: 'No verified admissions by this date: the event had not happened yet.' };
        const hh = (h: number) => `${String(h).padStart(2, '0')}:00-${String((h + 1) % 24).padStart(2, '0')}:00 IST`;
        return {
          as_of: asOf,
          unique_verified_visitors_across_event: e.uniqueVisitors,
          came_on_both_days: e.bothDays,
          days: e.days.map((d) => ({
            date: d.date,
            unique_visitors_that_day: d.uniqueVisitors,
            new_to_event_that_day: d.newVisitors,
            peak_first_entry_hour: d.peakHour == null ? null : hh(d.peakHour),
            peak_first_entries: d.peakFirstEntries,
            manual_scan_share_pct: pct(d.manualShare),
            by_hour: d.hours.filter((x) => x.firstEntries || x.admissions || x.deniedOrPending).map((x) => ({ hour: hh(x.hour), first_entries: x.firstEntries, verified_admission_scans: x.admissions, denied_or_pending_scans: x.deniedOrPending })),
          })),
          definitions: e.note,
        };
      },
    }),

    get_data_dictionary: tool({
      description: 'What data exists, how every metric is defined, which rules are applied, and which questions the data CANNOT answer. Call this when unsure whether the data supports a question.',
      inputSchema: z.object({}),
      execute: async () => DATA_DICTIONARY,
    }),

    query_data: tool({
      description: `Run ONE read-only SQL SELECT on the Postgres source tables for questions the other tools do not cover (e.g. counts by hour, specific people/IDs, custom breakdowns). Max 200 rows, 5 s timeout. Tables: event_info, targets, team(owner_id, owner_name), campaigns(campaign_id, campaign_name, channel, owner_id, status, planned_budget_inr), daily_marketing(activity_id, campaign_id, activity_date date, impressions, clicks, reported_reach, landing_page_sessions, registration_starts, marketing_spend_inr, platform), people(person_id, person_name, person_type, first_seen_at, first_touch_source, first_campaign_id), interactions(interaction_id, person_id, campaign_id, occurred_at, event_type, detail), registrations(registration_id, person_id, campaign_id, registered_at), registration_history(history_id, registration_id, person_id, campaign_id, effective_at, status), checkins(event_id, person_id, registration_id, campaign_id, occurred_at, result, verification, source), tasks(id, title, owner_id, campaign_id, due_date, status, priority), initiatives(id, rank, name, budget_inr, expected_visitors, status). Views: v_external_people, v_registration_current_status (latest status overall, NOT as-of), v_verified_external_admissions. Timestamps are timestamptz; for India dates use (col at time zone 'Asia/Kolkata'). Rules: visitors = count(distinct person_id) from v_verified_external_admissions; count external people only; history tables need latest version <= cutoff (use distinct on). Prefer the metric tools for standard KPIs.`,
      inputSchema: z.object({ sql: z.string().describe('A single SELECT (or WITH ... SELECT) statement'), purpose: z.string().describe('What question this query answers') }),
      execute: async ({ sql }) => {
        const q = sql.trim().replace(/;+\s*$/, '');
        if (!/^(select|with)\b/i.test(q)) return { error: 'Only a single SELECT/WITH query is allowed.' };
        if (q.includes(';')) return { error: 'Only one statement is allowed.' };
        if (SQL_FORBIDDEN.test(q.replace(/'[^']*'/g, "''"))) return { error: 'The query contains a keyword that is not allowed in read-only analysis.' };
        try {
          const rows = await ctx.db.readOnly((c) => c.query(`select * from (${q}) as q limit 200`), 5000);
          return { row_count: rows.length, rows, capped_at_200: rows.length === 200 };
        } catch (e) {
          return { error: `SQL error: ${(e as Error).message.slice(0, 300)}` };
        }
      },
    }),

    calculate: tool({
      description: 'Evaluate an arithmetic expression exactly (e.g. "2050/2800*100", "(274000-93000)/1925"). Use instead of mental math for any derived number.',
      inputSchema: z.object({ expression: z.string() }),
      execute: async ({ expression }) => {
        if (!/^[0-9+\-*/().,%\s^a-z_]*$/i.test(expression) || /[a-z]{4,}/i.test(expression.replace(/\b(sqrt|round|abs|min|max|log|exp|floor|ceil|mean|median)\b/gi, ''))) {
          return { error: 'Only numbers, operators and basic functions (sqrt, round, abs, min, max, log, exp, floor, ceil, mean, median) are allowed.' };
        }
        try {
          const v = evaluate(expression.replace(/,(?=\d{3})/g, ''));
          return { expression, result: typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : String(v) };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    }),

    get_plan: tool({
      description:
        'The Hyderabad 2027 plan model (analysis/model.py): base / stretch / floor targets with cost per visitor, the waterfall from 2,050, the funnel, budget lines, timeline gates, sensitivities and key assumptions (each flagged fact or assumption). Use for any question about 2027 targets, budget or plan logic. These are plan estimates, not observed data.',
      inputSchema: z.object({ section: z.enum(['summary', 'waterfall', 'funnel', 'budget', 'timeline', 'sensitivities', 'assumptions']).optional().describe('Default: summary') }),
      execute: async ({ section }) => {
        const plan = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'plan.json'), 'utf8'));
        const sc = (x: { rounded: number; cost_per_visitor_inr: number; registrations: number; registrant_show: number }) => ({ verified_visitors: x.rounded, cost_per_visitor_inr: r0(x.cost_per_visitor_inr), registrations: r0(x.registrations), registrant_show_pct: pct(x.registrant_show) });
        const note = 'Plan estimates for 13-14 Mar 2027 built on 2025 channel data; not observed outcomes.';
        switch (section ?? 'summary') {
          case 'waterfall':
            return { note, base: plan.waterfall.base.map((w: { step: string; integer: number }) => ({ step: w.step, visitors: w.integer })), stretch: plan.waterfall.stretch.map((w: { step: string; integer: number }) => ({ step: w.step, visitors: w.integer })) };
          case 'funnel':
            return { note, base: plan.funnel.base.map((f: { stage: string; count: number; rate?: number }) => ({ stage: f.stage, count: r0(f.count), rate_pct: pct(f.rate) })), stretch: plan.funnel.stretch.map((f: { stage: string; count: number }) => ({ stage: f.stage, count: r0(f.count) })) };
          case 'budget':
            return { note, total_inr: plan.budget.total, lines: plan.budget.lines.map((l: { line: string; inr: number }) => ({ line: l.line, inr: l.inr })) };
          case 'timeline':
            return { note, phases: plan.timeline };
          case 'sensitivities':
            return { note, base: plan.sensitivities.base.map((x: { sensitivity: string; delta_visitors: number; basis: string }) => ({ sensitivity: x.sensitivity, delta_visitors: r0(x.delta_visitors), basis: x.basis })) };
          case 'assumptions':
            return { note, inputs: Object.entries(plan.inputs).filter(([, v]) => v && typeof v === 'object' && 'flag' in (v as object)).map(([k, v]) => ({ input: k, ...(v as object) })).slice(0, 60) };
          default:
            return {
              note,
              fest: plan.meta.fest,
              north_star: plan.meta.north_star,
              floor: sc(plan.floor),
              base: sc(plan.base),
              base_with_sponsor: r0(plan.sponsor_band.base_plus_band),
              stretch: sc(plan.stretch),
              vs_2025: { visitors_2025: 2050, cost_per_visitor_2025_inr: 134 },
              growth_split_base: plan.growth_split_base,
              five_bets: plan.ideas.map((i: { rank: number; name: string; budget_inr: number; incremental_visitors_base: number; incremental_visitors_stretch: number; leading_indicator: string }) => ({ rank: i.rank, name: i.name, budget_inr: i.budget_inr, base_visitors: r0(i.incremental_visitors_base), stretch_visitors: r0(i.incremental_visitors_stretch), leading_indicator: i.leading_indicator })),
              model_checks_passed: `${plan.checks.filter((c: { pass: boolean }) => c.pass).length}/${plan.checks.length}`,
            };
        }
      },
    }),

    list_initiatives: tool({
      description: 'The five ranked growth bets for the Hyderabad 2027 edition (from the strategy): concept, budget, expected incremental visitors, owner, timeline, primary KPI, and scale/change/stop rules, with live status.',
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await ctx.db.query(`select i.id, i.rank, i.name, i.concept, i.campaign_ids, tm.owner_name as owner, i.budget_inr, i.expected_visitors, i.start_date::text, i.end_date::text, i.primary_kpi, i.scale_rule, i.change_rule, i.stop_rule, i.status from initiatives i left join team tm on tm.owner_id = i.owner_id order by i.rank`);
        return { initiatives: rows, note: 'Expected visitors are plan estimates for the Hyderabad 2027 edition, not observed data.' };
      },
    }),

    list_tasks: tool({
      description: 'List tasks/action items in the management tool, optionally filtered by status (todo, in_progress, blocked, done), owner (name or ID) or campaign.',
      inputSchema: z.object({ status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(), owner: z.string().optional(), campaign: z.string().optional() }),
      execute: async ({ status, owner, campaign }) => {
        const ds = await getDataset();
        const o = owner ? resolveOwner(ds, owner) : null;
        const c = campaign ? resolveCampaign(ds, campaign) : null;
        if (owner && !o) return { error: `No team member matches "${owner}".`, team: [...ds.team.values()].map((t) => t.ownerName) };
        if (campaign && !c) return { error: `No campaign matches "${campaign}".` };
        const rows = await listTasks(ctx.db, { status, owner_id: o?.id, campaign_id: c?.id });
        return { count: rows.length, tasks: rows.map((t) => { const r = t as Record<string, unknown>; return { id: r.id, title: r.title, status: r.status, priority: r.priority, owner: r.owner_name, campaign: r.campaign_name, initiative: r.initiative_name, due_date: r.due_date, decision: r.decision, source: r.source }; }), today: ctx.today };
      },
    }),

    create_task: tool({
      description: 'Create a task/action item in the management tool. REQUIRES the user to approve the card in the chat before it is saved. Use after a recommendation the user wants to act on. Resolve relative dates against today.',
      inputSchema: z.object({
        title: z.string().describe('Short imperative title'),
        description: z.string().optional().describe('What to do and why, including the evidence'),
        owner: z.string().optional().describe('Team member name or ID'),
        campaign: z.string().optional().describe('Campaign ID, name or channel'),
        due_date: z.string().optional().describe('YYYY-MM-DD'),
        priority: z.enum(['high', 'medium', 'low']).optional(),
        decision: z.enum(['scale', 'change', 'stop', 'fix', 'monitor']).optional(),
        evidence: z.string().optional().describe('The metric evidence behind the task'),
      }),
      execute: async (input) => {
        const ds = await getDataset();
        const o = input.owner ? resolveOwner(ds, input.owner) : null;
        const c = input.campaign ? resolveCampaign(ds, input.campaign) : null;
        if (input.owner && !o) return { error: `No team member matches "${input.owner}". Team: ${[...ds.team.values()].map((t) => t.ownerName).join(', ')}` };
        if (input.campaign && !c) return { error: `No campaign matches "${input.campaign}".` };
        try {
          const id = await createTask(ctx.db, { title: input.title, description: input.description, owner_id: o?.id ?? null, campaign_id: c && c.id !== UNATTRIBUTED ? c.id : null, due_date: input.due_date, priority: input.priority, decision: input.decision, evidence: input.evidence, source: 'copilot' }, 'copilot');
          return { created: true, task_id: id, title: input.title, owner: o?.name ?? null, campaign: c?.name ?? null, due_date: input.due_date ?? null, view: '/execute' };
        } catch (e) {
          return { created: false, error: e instanceof ValidationError ? e.message : 'Could not save the task.' };
        }
      },
    }),

    update_task: tool({
      description: 'Update an existing task (status, owner, due date, priority). REQUIRES user approval in the chat.',
      inputSchema: z.object({
        task_id: z.number(),
        status: z.enum(['todo', 'in_progress', 'blocked', 'done']).optional(),
        owner: z.string().optional(),
        due_date: z.string().optional(),
        priority: z.enum(['high', 'medium', 'low']).optional(),
      }),
      execute: async ({ task_id, status, owner, due_date, priority }) => {
        const ds = await getDataset();
        const o = owner ? resolveOwner(ds, owner) : null;
        if (owner && !o) return { error: `No team member matches "${owner}".` };
        try {
          await updateTask(ctx.db, task_id, { ...(status ? { status } : {}), ...(o ? { owner_id: o.id } : {}), ...(due_date ? { due_date } : {}), ...(priority ? { priority } : {}) }, 'copilot');
          return { updated: true, task_id };
        } catch (e) {
          return { updated: false, error: e instanceof ValidationError ? e.message : 'Could not update the task.' };
        }
      },
    }),

    update_campaign: tool({
      description: 'Change a campaign\'s management fields: status (planned, active, paused, stopped, completed), planned budget in INR, owner, or notes. REQUIRES user approval in the chat. Analytics refresh immediately after.',
      inputSchema: z.object({
        campaign: z.string(),
        status: z.enum(['planned', 'active', 'paused', 'stopped', 'completed']).optional(),
        planned_budget_inr: z.number().optional(),
        owner: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ campaign, status, planned_budget_inr, owner, notes }) => {
        const ds = await getDataset();
        const c = resolveCampaign(ds, campaign);
        if (!c || c.id === UNATTRIBUTED) return { error: `No campaign matches "${campaign}".` };
        const o = owner ? resolveOwner(ds, owner) : null;
        if (owner && !o) return { error: `No team member matches "${owner}".` };
        try {
          await updateCampaign(ctx.db, c.id, { ...(status ? { status } : {}), ...(planned_budget_inr != null ? { planned_budget_inr } : {}), ...(o ? { owner_id: o.id } : {}), ...(notes ? { notes } : {}) }, 'copilot');
          return { updated: true, campaign: c.name };
        } catch (e) {
          return { updated: false, error: e instanceof ValidationError ? e.message : 'Could not update the campaign.' };
        }
      },
    }),
  };
}

type TaskCtx = ToolContext;

function addDaysSafe(d: string, n: number) {
  const t = Date.parse(`${d.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? d : new Date(t + n * 86400000).toISOString().slice(0, 10);
}

export const WRITE_TOOLS = ['create_task', 'update_task', 'update_campaign'] as const;

export const DATA_DICTIONARY = {
  dataset: 'CampusFest 2025 attendee acquisition data (synthetic, provided by RISA). Records cover 15 Jan to 20 Apr 2025; the event ran 12-13 Apr 2025. The city of this past edition is not stated. The team uses it as the evidence base for the Hyderabad 2027 plan.',
  rules_applied: [
    'A selected date means the END of that day in India time (Asia/Kolkata); nothing later leaks into an earlier snapshot.',
    'Exact duplicate rows with the same stable ID (import retries) are counted once.',
    'History tables are full-state versions: the latest version on or before the cutoff wins; versions are never summed.',
    'Only person_type = external counts toward targets. Internal, staff and test people are excluded.',
    'A verified visitor is a distinct external person with at least one admitted AND verified check-in. Denied, pending or unverified check-ins do not count; repeat entries count once.',
    'Identified people are attributed to their fixed first-touch campaign; registrations to the registration campaign; visitors to their registration campaign (walk-ins form an unattributed bucket).',
    'Spend is net posted ledger amount (debits minus credits) on its posting date; negative values are vendor credits.',
    'Targets and budget change over time; the version in force at the cutoff is used (launch plan from 15 Jan, revised plan from 15 Mar 2025 09:00 IST).',
  ],
  definitions: {
    identified_people: 'Distinct external people first seen on or before the cutoff.',
    registrations: 'Distinct external people with a registration created on or before the cutoff.',
    confirmed: 'Registrations whose latest status at the cutoff is confirmed.',
    registrant_show_rate: 'Registered people who became verified visitors / registered people.',
    cost_per_verified_visitor: 'Net spend / unique verified external visitors (after the event).',
    expected_visitors: 'Before the event: confirmed registrants x show-rate assumption (Settings, default 75% from PheedLoop 2026 free-event benchmark). An assumption, not data.',
    reach: 'Platform-reported DAILY reach; summing it does not give unique people.',
  },
  cannot_answer: [
    'Demographics: age, gender, year of study, college or university names, city or distance from the venue.',
    'Why someone cancelled, was waitlisted or did not attend (no reason codes).',
    'Ticket prices, revenue, sponsorship income, venue, capacity limits or programme line-up.',
    'Creative-, ad-set-, influencer- or post-level performance (only campaign-day aggregates).',
    'Incremental (causal) lift of any channel: there were no holdout or control groups; attribution is the recorded source only.',
    'Unique reach across days, email deliverability, or satisfaction/NPS.',
    'Anything about the Hyderabad 2027 edition beyond the plan (no 2027 actuals exist yet).',
  ],
};
