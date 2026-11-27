import type { Db } from './db';
import { getDb } from './db';
import { DEFAULT_SETTINGS, type Dataset, type Settings, type StatusVersion, type Registration } from './engine/types';

type R = Record<string, unknown>;
const n = (v: unknown) => (v == null ? 0 : Number(v));
const ts = (v: unknown) => (v == null ? null : v instanceof Date ? v.getTime() : Date.parse(String(v)));
const s = (v: unknown) => (v == null ? null : String(v));

export async function getDataVersion(db: Db): Promise<string> {
  const rows = await db.query<{ value: string }>(`select value from meta where key = 'data_version'`);
  return rows[0]?.value ?? '0';
}

export async function readSettings(db: Db): Promise<Settings> {
  const rows = await db.query<{ key: string; value: unknown }>(`select key, value from settings`);
  const out: Settings = { ...DEFAULT_SETTINGS, showRateByCampaign: { ...DEFAULT_SETTINGS.showRateByCampaign } };
  for (const r of rows) {
    const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = v;
  }
  return out;
}

/** Load every source table into memory. ~25k rows; the engine computes all metrics from this snapshot. */
export async function loadDataset(db: Db): Promise<Dataset> {
  const version = await getDataVersion(db);
  const [ev, targets, team, campaigns, daily, people, inter, regs, hist, chk, settings, imp] = await Promise.all([
    db.query<R>(`select event_name, history_start::text as hs, history_end::text as he, event_starts_at, event_ends_at, timezone, currency from event_info where id = 1`),
    db.query<R>(`select id, effective_at, identified_external_people_goal, registration_goal, unique_external_visitors_goal, marketing_budget_inr, target_version, origin from targets order by effective_at, id`),
    db.query<R>(`select owner_id, owner_name, role from team order by owner_id`),
    db.query<R>(`select * from campaigns order by campaign_id`),
    db.query<R>(`select activity_id, campaign_id, activity_date::text as d, impressions, clicks, reported_reach, landing_page_sessions, registration_starts, marketing_spend_inr, platform from daily_marketing`),
    db.query<R>(`select person_id, person_name, person_type, first_seen_at, first_touch_source, first_campaign_id from people`),
    db.query<R>(`select person_id, campaign_id, occurred_at, event_type from interactions`),
    db.query<R>(`select registration_id, person_id, campaign_id, registered_at from registrations`),
    db.query<R>(`select history_id, registration_id, effective_at, status from registration_history`),
    db.query<R>(`select event_id, person_id, registration_id, campaign_id, occurred_at, result, verification, source from checkins`),
    readSettings(db),
    db.query<R>(`select at, source, stats from import_log order by id desc limit 1`),
  ]);
  const e = ev[0];
  if (!e) throw new Error('No event data loaded. Import the attendee dataset first (Data page or `npm run seed`).');

  const history = new Map<string, StatusVersion[]>();
  for (const h of hist) {
    const v: StatusVersion = { historyId: String(h.history_id), registrationId: String(h.registration_id), at: ts(h.effective_at)!, status: String(h.status) };
    const arr = history.get(v.registrationId);
    if (arr) arr.push(v);
    else history.set(v.registrationId, [v]);
  }
  for (const arr of history.values()) arr.sort((a, b) => a.at - b.at || (a.historyId < b.historyId ? -1 : a.historyId > b.historyId ? 1 : 0));

  const registrations: Registration[] = regs.map((r) => ({ registrationId: String(r.registration_id), personId: String(r.person_id), campaignId: s(r.campaign_id), at: ts(r.registered_at)! }));
  const regsByPerson = new Map<string, Registration[]>();
  for (const r of registrations) {
    const arr = regsByPerson.get(r.personId);
    if (arr) arr.push(r);
    else regsByPerson.set(r.personId, [r]);
  }
  for (const arr of regsByPerson.values()) arr.sort((a, b) => a.at - b.at);

  const impStats = imp[0]?.stats ? (typeof imp[0].stats === 'string' ? JSON.parse(imp[0].stats as string) : imp[0].stats) : null;

  return {
    version,
    loadedAt: Date.now(),
    event: {
      name: String(e.event_name),
      historyStart: String(e.hs),
      historyEnd: String(e.he),
      startsAt: ts(e.event_starts_at)!,
      endsAt: ts(e.event_ends_at)!,
      timezone: String(e.timezone ?? 'Asia/Kolkata'),
      currency: String(e.currency ?? 'INR'),
    },
    targets: targets.map((t) => ({
      id: n(t.id),
      effectiveAt: ts(t.effective_at)!,
      identifiedGoal: n(t.identified_external_people_goal),
      registrationGoal: n(t.registration_goal),
      visitorsGoal: n(t.unique_external_visitors_goal),
      budget: n(t.marketing_budget_inr),
      version: String(t.target_version ?? `Target ${t.id}`),
      origin: String(t.origin ?? 'dataset'),
    })),
    team: new Map(team.map((t) => [String(t.owner_id), { ownerId: String(t.owner_id), ownerName: String(t.owner_name), role: s(t.role) }])),
    campaigns: campaigns.map((c) => ({
      campaignId: String(c.campaign_id),
      name: String(c.campaign_name),
      channel: s(c.channel),
      targetAudience: s(c.target_audience),
      objective: s(c.objective),
      ownerId: s(c.owner_id),
      createdAt: ts(c.created_at),
      plannedStartAt: ts(c.planned_start_at),
      plannedEndAt: ts(c.planned_end_at),
      status: String(c.status ?? 'active'),
      plannedBudget: c.planned_budget_inr == null ? null : n(c.planned_budget_inr),
      notes: s(c.notes),
      origin: String(c.origin ?? 'dataset'),
    })),
    daily: daily.map((d) => ({
      activityId: String(d.activity_id),
      campaignId: String(d.campaign_id),
      date: String(d.d),
      impressions: n(d.impressions),
      clicks: n(d.clicks),
      reach: n(d.reported_reach),
      lpSessions: n(d.landing_page_sessions),
      regStarts: n(d.registration_starts),
      spend: n(d.marketing_spend_inr),
      platform: s(d.platform),
    })),
    people: new Map(
      people.map((p) => [
        String(p.person_id),
        { personId: String(p.person_id), name: s(p.person_name), type: String(p.person_type), firstSeenAt: ts(p.first_seen_at) ?? Number.MAX_SAFE_INTEGER, firstTouch: s(p.first_touch_source), firstCampaignId: s(p.first_campaign_id) },
      ]),
    ),
    interactions: inter.map((i) => ({ personId: String(i.person_id), campaignId: s(i.campaign_id), at: ts(i.occurred_at)!, type: String(i.event_type) })),
    registrations,
    history,
    checkins: chk.map((c) => ({
      eventId: String(c.event_id),
      personId: String(c.person_id),
      registrationId: s(c.registration_id),
      campaignId: s(c.campaign_id),
      at: ts(c.occurred_at)!,
      result: String(c.result),
      verification: String(c.verification),
      source: s(c.source),
    })),
    settings,
    importStats: impStats ? { at: imp[0].at ? new Date(imp[0].at as string).toISOString() : null, source: s(imp[0].source), tables: impStats.tables ?? {}, warnings: impStats.warnings ?? [] } : null,
    regsByPerson,
  };
}

const g = globalThis as unknown as { __gcDataset?: Dataset; __gcLoading?: Promise<Dataset> };

/** Cached dataset; reloads when meta.data_version changes (every write bumps it). */
export async function getDataset(): Promise<Dataset> {
  const db = await getDb();
  const version = await getDataVersion(db);
  if (g.__gcDataset && g.__gcDataset.version === version) return g.__gcDataset;
  if (!g.__gcLoading) {
    g.__gcLoading = loadDataset(db)
      .then((d) => {
        g.__gcDataset = d;
        return d;
      })
      .finally(() => {
        g.__gcLoading = undefined;
      });
  }
  return g.__gcLoading;
}

export function invalidateDataset() {
  g.__gcDataset = undefined;
}
