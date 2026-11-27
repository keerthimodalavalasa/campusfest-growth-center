import ExcelJS from 'exceljs';
import type { Db, Sql } from './db';
import { toDateOnly, toIstTimestamp } from './engine/time';

/** Sheet specs: the workbook's sheet names (plus CSV-style aliases) and the columns we need. */
const SHEETS = {
  event: { names: ['Event', 'event'], id: null, cols: ['event_name', 'history_start', 'history_end', 'event_starts_at', 'event_ends_at', 'timezone', 'currency', 'fictional'] },
  targets: { names: ['Targets', 'targets'], id: null, cols: ['effective_at', 'identified_external_people_goal', 'registration_goal', 'unique_external_visitors_goal', 'marketing_budget_inr', 'target_version'] },
  campaigns: { names: ['Campaigns', 'campaigns'], id: 'campaign_id', cols: ['campaign_id', 'campaign_name', 'channel', 'target_audience', 'objective', 'owner_name', 'owner_id', 'created_at', 'planned_start_at', 'planned_end_at'] },
  daily: { names: ['Daily Marketing', 'campaign_daily', 'Campaign Daily'], id: 'activity_id', cols: ['activity_id', 'campaign_id', 'activity_date', 'impressions', 'clicks', 'reported_reach', 'landing_page_sessions', 'registration_starts', 'marketing_spend_inr', 'platform', 'owner_id', 'owner_name'] },
  people: { names: ['People', 'people'], id: 'person_id', cols: ['person_id', 'person_name', 'person_type', 'first_seen_at', 'first_touch_source', 'first_campaign_id', 'owner_id', 'owner_name'] },
  interactions: { names: ['Interest and Engagement', 'lead_interactions', 'Interactions'], id: 'interaction_id', cols: ['interaction_id', 'person_id', 'campaign_id', 'occurred_at', 'event_type', 'detail', 'owner_id', 'owner_name'] },
  registrations: { names: ['Registrations', 'registrations'], id: 'registration_id', cols: ['registration_id', 'person_id', 'campaign_id', 'registered_at', 'owner_id', 'owner_name'] },
  history: { names: ['Registration History', 'registration_history'], id: 'history_id', cols: ['history_id', 'registration_id', 'person_id', 'campaign_id', 'effective_at', 'status', 'owner_id', 'owner_name'] },
  checkins: { names: ['Check-ins', 'checkins', 'Checkins'], id: 'event_id', cols: ['event_id', 'person_id', 'registration_id', 'campaign_id', 'occurred_at', 'result', 'verification', 'source', 'owner_id', 'owner_name'] },
} as const;
type SheetKey = keyof typeof SHEETS;
type Row = Record<string, unknown>;

export interface TableStats {
  sheet: string;
  rowsRead: number;
  imported: number;
  duplicateIds: number;
  conflictingDuplicates: number;
  skippedInvalid: number;
}
export interface ImportResult {
  source: string;
  tables: Record<SheetKey, TableStats>;
  warnings: string[];
}

function cellValue(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>;
    if ('result' in o) return o.result as unknown; // formula
    if ('text' in o) return o.text as unknown; // hyperlink
    if ('richText' in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join('');
  }
  return v;
}

function readSheet(ws: ExcelJS.Worksheet): Row[] {
  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).slice(1).map((h) => String(cellValue(h) ?? '').trim());
  const out: Row[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    if (n === 1) return;
    const vals = (row.values as ExcelJS.CellValue[]).slice(1);
    const r: Row = {};
    let any = false;
    header.forEach((h, i) => {
      if (!h) return;
      const v = cellValue(vals[i] ?? null);
      if (v !== null && v !== '') any = true;
      r[h] = v === '' ? null : v;
    });
    if (any) out.push(r);
  });
  return out;
}

const str = (v: unknown) => (v == null || v === '' ? null : String(v).trim());
const num = (v: unknown) => {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const bool = (v: unknown) => v === true || String(v).toLowerCase() === 'true';

export interface ParsedWorkbook {
  event: Row | null;
  tables: Record<SheetKey, Row[]>;
  stats: Record<SheetKey, TableStats>;
  team: Map<string, string>;
  warnings: string[];
}

/** Parse an attendee workbook. Applies the source rules: dedupe identical stable IDs, normalise IST timestamps. */
export async function parseWorkbook(buf: ArrayBuffer | Buffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const warnings: string[] = [];
  const byName = new Map(wb.worksheets.map((w) => [w.name.trim().toLowerCase(), w]));
  const tables = {} as Record<SheetKey, Row[]>;
  const stats = {} as Record<SheetKey, TableStats>;
  const team = new Map<string, string>();

  for (const key of Object.keys(SHEETS) as SheetKey[]) {
    const spec = SHEETS[key];
    const ws = spec.names.map((n) => byName.get(n.toLowerCase())).find(Boolean);
    if (!ws) {
      throw new Error(`Workbook is missing the "${spec.names[0]}" sheet. Expected sheets: ${Object.values(SHEETS).map((s) => s.names[0]).join(', ')}.`);
    }
    const raw = readSheet(ws);
    const present = new Set(raw.length ? Object.keys(raw[0]) : []);
    const required = spec.cols.filter((c) => !c.endsWith('owner_name') && c !== 'detail' && c !== 'platform');
    const missing = raw.length ? required.filter((c) => !present.has(c)) : [];
    if (missing.length) throw new Error(`Sheet "${ws.name}" is missing columns: ${missing.join(', ')}`);

    const st: TableStats = { sheet: ws.name, rowsRead: raw.length, imported: 0, duplicateIds: 0, conflictingDuplicates: 0, skippedInvalid: 0 };
    const seen = new Map<string, string>();
    const rows: Row[] = [];
    for (const r of raw) {
      if (r.owner_id && r.owner_name) team.set(String(r.owner_id), String(r.owner_name));
      if (spec.id) {
        const id = str(r[spec.id]);
        if (!id) {
          st.skippedInvalid++;
          continue;
        }
        const sig = JSON.stringify(r, (_k, v) => (v instanceof Date ? v.toISOString() : v));
        if (seen.has(id)) {
          st.duplicateIds++;
          if (seen.get(id) !== sig) st.conflictingDuplicates++;
          continue;
        }
        seen.set(id, sig);
      }
      rows.push(r);
    }
    if (st.conflictingDuplicates) warnings.push(`${ws.name}: ${st.conflictingDuplicates} rows reuse an existing ID with different values; the first occurrence was kept.`);
    tables[key] = rows;
    stats[key] = st;
  }
  const event = tables.event[0] ?? null;
  if (!event) throw new Error('The Event sheet has no rows.');
  return { event, tables, stats, team, warnings };
}

async function insertRows(c: Sql, table: string, cols: string[], rows: unknown[][], chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const params: unknown[] = [];
    const tuples = part.map((r) => `(${r.map((v) => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await c.query(`insert into ${table} (${cols.join(',')}) values ${tuples.join(',')}`, params);
  }
}

/** Replace all source tables with the parsed workbook (management tables are kept). */
export async function writeWorkbook(db: Db, parsed: ParsedWorkbook, source: string): Promise<ImportResult> {
  const { tables, stats, event, team, warnings } = parsed;
  const valid = <T,>(key: SheetKey, rows: Row[], map: (r: Row) => T | null): T[] => {
    const out: T[] = [];
    for (const r of rows) {
      const m = map(r);
      if (m === null) stats[key].skippedInvalid++;
      else out.push(m);
    }
    stats[key].imported = out.length;
    return out;
  };

  const targets = valid('targets', tables.targets, (r) => {
    const at = toIstTimestamp(r.effective_at);
    return at ? [at, num(r.identified_external_people_goal), num(r.registration_goal), num(r.unique_external_visitors_goal), num(r.marketing_budget_inr), str(r.target_version), 'dataset'] : null;
  });
  const campaigns = valid('campaigns', tables.campaigns, (r) => [str(r.campaign_id), str(r.campaign_name) ?? str(r.campaign_id), str(r.channel), str(r.target_audience), str(r.objective), str(r.owner_id), toIstTimestamp(r.created_at), toIstTimestamp(r.planned_start_at), toIstTimestamp(r.planned_end_at)]);
  const daily = valid('daily', tables.daily, (r) => {
    const d = toDateOnly(r.activity_date);
    return d && str(r.campaign_id) ? [str(r.activity_id), str(r.campaign_id), d, num(r.impressions), num(r.clicks), num(r.reported_reach), num(r.landing_page_sessions), num(r.registration_starts), num(r.marketing_spend_inr), str(r.platform), str(r.owner_id)] : null;
  });
  const people = valid('people', tables.people, (r) => (str(r.person_type) ? [str(r.person_id), str(r.person_name), str(r.person_type)!.toLowerCase(), toIstTimestamp(r.first_seen_at), str(r.first_touch_source), str(r.first_campaign_id), str(r.owner_id)] : null));
  const interactions = valid('interactions', tables.interactions, (r) => {
    const at = toIstTimestamp(r.occurred_at);
    return at && str(r.person_id) && str(r.event_type) ? [str(r.interaction_id), str(r.person_id), str(r.campaign_id), at, str(r.event_type), str(r.detail), str(r.owner_id)] : null;
  });
  const registrations = valid('registrations', tables.registrations, (r) => {
    const at = toIstTimestamp(r.registered_at);
    return at && str(r.person_id) ? [str(r.registration_id), str(r.person_id), str(r.campaign_id), at, str(r.owner_id)] : null;
  });
  const history = valid('history', tables.history, (r) => {
    const at = toIstTimestamp(r.effective_at);
    return at && str(r.registration_id) && str(r.status) ? [str(r.history_id), str(r.registration_id), str(r.person_id), str(r.campaign_id), at, str(r.status)!.toLowerCase(), str(r.owner_id)] : null;
  });
  const checkins = valid('checkins', tables.checkins, (r) => {
    const at = toIstTimestamp(r.occurred_at);
    return at && str(r.person_id) && str(r.result) ? [str(r.event_id), str(r.person_id), str(r.registration_id), str(r.campaign_id), at, str(r.result)!.toLowerCase(), (str(r.verification) ?? 'unverified').toLowerCase(), str(r.source), str(r.owner_id)] : null;
  });
  stats.event.imported = 1;

  await db.tx(async (c) => {
    for (const t of ['checkins', 'registration_history', 'registrations', 'interactions', 'people', 'daily_marketing', 'targets']) {
      await c.query(`delete from ${t}`);
    }
    await c.query('delete from event_info');
    await c.query(
      `insert into event_info (id,event_name,history_start,history_end,event_starts_at,event_ends_at,timezone,currency,fictional) values (1,$1,$2,$3,$4,$5,$6,$7,$8)`,
      [str(event!.event_name), toDateOnly(event!.history_start), toDateOnly(event!.history_end), toIstTimestamp(event!.event_starts_at), toIstTimestamp(event!.event_ends_at), str(event!.timezone) ?? 'Asia/Kolkata', str(event!.currency) ?? 'INR', bool(event!.fictional)],
    );
    for (const [id, name] of team) {
      await c.query(`insert into team (owner_id, owner_name) values ($1,$2) on conflict (owner_id) do update set owner_name = excluded.owner_name`, [id, name]);
    }
    // dataset campaigns are replaced (management fields reset); campaigns created in the app are kept
    await c.query(`delete from campaigns where origin = 'dataset'`);
    for (const r of campaigns) {
      await c.query(
        `insert into campaigns (campaign_id,campaign_name,channel,target_audience,objective,owner_id,created_at,planned_start_at,planned_end_at,status,origin)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active','dataset')
         on conflict (campaign_id) do update set campaign_name=excluded.campaign_name, channel=excluded.channel, target_audience=excluded.target_audience,
           objective=excluded.objective, owner_id=excluded.owner_id, created_at=excluded.created_at, planned_start_at=excluded.planned_start_at,
           planned_end_at=excluded.planned_end_at, origin='dataset', updated_at=now()`,
        r,
      );
    }
    await insertRows(c, 'targets', ['effective_at', 'identified_external_people_goal', 'registration_goal', 'unique_external_visitors_goal', 'marketing_budget_inr', 'target_version', 'origin'], targets);
    await insertRows(c, 'daily_marketing', ['activity_id', 'campaign_id', 'activity_date', 'impressions', 'clicks', 'reported_reach', 'landing_page_sessions', 'registration_starts', 'marketing_spend_inr', 'platform', 'owner_id'], daily);
    await insertRows(c, 'people', ['person_id', 'person_name', 'person_type', 'first_seen_at', 'first_touch_source', 'first_campaign_id', 'owner_id'], people);
    await insertRows(c, 'interactions', ['interaction_id', 'person_id', 'campaign_id', 'occurred_at', 'event_type', 'detail', 'owner_id'], interactions);
    await insertRows(c, 'registrations', ['registration_id', 'person_id', 'campaign_id', 'registered_at', 'owner_id'], registrations);
    await insertRows(c, 'registration_history', ['history_id', 'registration_id', 'person_id', 'campaign_id', 'effective_at', 'status', 'owner_id'], history);
    await insertRows(c, 'checkins', ['event_id', 'person_id', 'registration_id', 'campaign_id', 'occurred_at', 'result', 'verification', 'source', 'owner_id'], checkins);
    await c.query(`insert into import_log (source, stats) values ($1, $2)`, [source, JSON.stringify({ tables: stats, warnings })]);
    await c.query(`insert into change_log (actor, entity, action, detail) values ('system', 'dataset', 'import', $1)`, [JSON.stringify({ source })]);
    await c.query(`insert into meta (key, value) values ('data_version', '1') on conflict (key) do update set value = (meta.value::bigint + 1)::text`);
  });
  return { source, tables: stats, warnings };
}
