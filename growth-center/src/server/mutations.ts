import type { Db, Sql } from './db';
import { TABLES, type ColSpec, type TableSpec } from './tables';
import { toDateOnly, toIstTimestamp } from './engine/time';

export class ValidationError extends Error {
  status = 400;
}

export async function bumpVersion(c: Sql) {
  await c.query(`insert into meta (key, value) values ('data_version', '1') on conflict (key) do update set value = (meta.value::bigint + 1)::text`);
}

export async function logChange(c: Sql, actor: string, entity: string, entityId: string | null, action: string, detail: unknown) {
  await c.query(`insert into change_log (actor, entity, entity_id, action, detail) values ($1,$2,$3,$4,$5)`, [actor, entity, entityId, action, JSON.stringify(detail ?? null)]);
}

// ------------------------------------------------------------------ tasks
export const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const;
export const TASK_PRIORITIES = ['high', 'medium', 'low'] as const;
export const DECISIONS = ['scale', 'change', 'stop', 'fix', 'monitor'] as const;

export interface TaskInput {
  title?: string;
  description?: string | null;
  campaign_id?: string | null;
  initiative_id?: string | null;
  owner_id?: string | null;
  due_date?: string | null;
  status?: string;
  priority?: string;
  decision?: string | null;
  source?: string;
  evidence?: string | null;
}

async function checkRefs(db: Sql, t: TaskInput) {
  if (t.campaign_id) {
    const r = await db.query(`select 1 from campaigns where campaign_id = $1`, [t.campaign_id]);
    if (!r.length) throw new ValidationError(`Unknown campaign_id "${t.campaign_id}".`);
  }
  if (t.owner_id) {
    const r = await db.query(`select 1 from team where owner_id = $1`, [t.owner_id]);
    if (!r.length) throw new ValidationError(`Unknown owner_id "${t.owner_id}".`);
  }
  if (t.initiative_id) {
    const r = await db.query(`select 1 from initiatives where id = $1`, [t.initiative_id]);
    if (!r.length) throw new ValidationError(`Unknown initiative_id "${t.initiative_id}".`);
  }
  if (t.status && !TASK_STATUSES.includes(t.status as never)) throw new ValidationError(`status must be one of ${TASK_STATUSES.join(', ')}.`);
  if (t.priority && !TASK_PRIORITIES.includes(t.priority as never)) throw new ValidationError(`priority must be one of ${TASK_PRIORITIES.join(', ')}.`);
  if (t.decision && !DECISIONS.includes(t.decision as never)) throw new ValidationError(`decision must be one of ${DECISIONS.join(', ')}.`);
  if (t.due_date && !toDateOnly(t.due_date)) throw new ValidationError('due_date must be YYYY-MM-DD.');
}

export async function listTasks(db: Db, f: { status?: string; owner_id?: string; campaign_id?: string; initiative_id?: string } = {}) {
  const where: string[] = [];
  const params: unknown[] = [];
  for (const [k, v] of Object.entries(f)) {
    if (!v) continue;
    params.push(v);
    where.push(`t.${k} = $${params.length}`);
  }
  return db.query(
    `select t.*, t.due_date::text as due_date, tm.owner_name, c.campaign_name, i.name as initiative_name
     from tasks t left join team tm on tm.owner_id = t.owner_id left join campaigns c on c.campaign_id = t.campaign_id left join initiatives i on i.id = t.initiative_id
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by case t.status when 'blocked' then 0 when 'in_progress' then 1 when 'todo' then 2 else 3 end, t.due_date nulls last, t.id`,
    params,
  );
}

export async function createTask(db: Db, t: TaskInput, actor = 'user') {
  if (!t.title || !t.title.trim()) throw new ValidationError('title is required.');
  await checkRefs(db, t);
  return db.tx(async (c) => {
    const rows = await c.query<{ id: number }>(
      `insert into tasks (title, description, campaign_id, initiative_id, owner_id, due_date, status, priority, decision, source, evidence)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [t.title!.trim(), t.description ?? null, t.campaign_id ?? null, t.initiative_id ?? null, t.owner_id ?? null, t.due_date ? toDateOnly(t.due_date) : null, t.status ?? 'todo', t.priority ?? 'medium', t.decision ?? null, t.source ?? 'manual', t.evidence ?? null],
    );
    await logChange(c, actor, 'task', String(rows[0].id), 'create', t);
    return rows[0].id;
  });
}

export async function updateTask(db: Db, id: number, patch: TaskInput, actor = 'user') {
  await checkRefs(db, patch);
  const allowed = ['title', 'description', 'campaign_id', 'initiative_id', 'owner_id', 'due_date', 'status', 'priority', 'decision', 'evidence'] as const;
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const k of allowed) {
    if (!(k in patch)) continue;
    params.push(k === 'due_date' ? (patch.due_date ? toDateOnly(patch.due_date) : null) : (patch as Record<string, unknown>)[k]);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) throw new ValidationError('Nothing to update.');
  params.push(id);
  return db.tx(async (c) => {
    const r = await c.query(`update tasks set ${sets.join(', ')}, updated_at = now() where id = $${params.length} returning id`, params);
    if (!r.length) throw new ValidationError(`Task ${id} not found.`);
    await logChange(c, actor, 'task', String(id), 'update', patch);
    return id;
  });
}

export async function deleteTask(db: Db, id: number, actor = 'user') {
  return db.tx(async (c) => {
    const r = await c.query(`delete from tasks where id = $1 returning id`, [id]);
    if (!r.length) throw new ValidationError(`Task ${id} not found.`);
    await logChange(c, actor, 'task', String(id), 'delete', null);
  });
}

// ------------------------------------------------------------------ campaigns
export const CAMPAIGN_STATUSES = ['planned', 'active', 'paused', 'stopped', 'completed'] as const;

export interface CampaignInput {
  campaign_id?: string;
  campaign_name?: string;
  channel?: string | null;
  target_audience?: string | null;
  objective?: string | null;
  owner_id?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  status?: string;
  planned_budget_inr?: number | null;
  notes?: string | null;
}

export async function createCampaign(db: Db, c: CampaignInput, actor = 'user') {
  if (!c.campaign_name?.trim()) throw new ValidationError('campaign_name is required.');
  if (c.status && !CAMPAIGN_STATUSES.includes(c.status as never)) throw new ValidationError(`status must be one of ${CAMPAIGN_STATUSES.join(', ')}.`);
  return db.tx(async (q) => {
    let id = c.campaign_id?.trim();
    if (!id) {
      const rows = await q.query<{ n: number }>(`select coalesce(max(substring(campaign_id from 2)::int), 0) + 1 as n from campaigns where campaign_id ~ '^C[0-9]+$'`);
      id = `C${String(rows[0].n).padStart(2, '0')}`;
    }
    const exists = await q.query(`select 1 from campaigns where campaign_id = $1`, [id]);
    if (exists.length) throw new ValidationError(`Campaign ${id} already exists.`);
    await q.query(
      `insert into campaigns (campaign_id, campaign_name, channel, target_audience, objective, owner_id, created_at, planned_start_at, planned_end_at, status, planned_budget_inr, notes, origin)
       values ($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10,$11,'app')`,
      [id, c.campaign_name!.trim(), c.channel ?? null, c.target_audience ?? null, c.objective ?? null, c.owner_id ?? null, toIstTimestamp(c.planned_start_at), toIstTimestamp(c.planned_end_at), c.status ?? 'planned', c.planned_budget_inr ?? null, c.notes ?? null],
    );
    await logChange(q, actor, 'campaign', id, 'create', c);
    await bumpVersion(q);
    return id;
  });
}

export async function updateCampaign(db: Db, id: string, patch: CampaignInput, actor = 'user') {
  if (patch.status && !CAMPAIGN_STATUSES.includes(patch.status as never)) throw new ValidationError(`status must be one of ${CAMPAIGN_STATUSES.join(', ')}.`);
  if (patch.owner_id) {
    const r = await db.query(`select 1 from team where owner_id = $1`, [patch.owner_id]);
    if (!r.length) throw new ValidationError(`Unknown owner_id "${patch.owner_id}".`);
  }
  const allowed = ['campaign_name', 'channel', 'target_audience', 'objective', 'owner_id', 'planned_start_at', 'planned_end_at', 'status', 'planned_budget_inr', 'notes'] as const;
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const k of allowed) {
    if (!(k in patch)) continue;
    let v = (patch as Record<string, unknown>)[k];
    if (k === 'planned_start_at' || k === 'planned_end_at') v = toIstTimestamp(v);
    if (k === 'planned_budget_inr' && v != null && !Number.isFinite(Number(v))) throw new ValidationError('planned_budget_inr must be a number.');
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) throw new ValidationError('Nothing to update.');
  params.push(id);
  return db.tx(async (q) => {
    const r = await q.query(`update campaigns set ${sets.join(', ')}, updated_at = now() where campaign_id = $${params.length} returning campaign_id`, params);
    if (!r.length) throw new ValidationError(`Campaign ${id} not found.`);
    await logChange(q, actor, 'campaign', id, 'update', patch);
    await bumpVersion(q);
    return id;
  });
}

/** Only campaigns created in the app can be deleted; dataset campaigns are referenced by the source data. */
export async function deleteCampaign(db: Db, id: string, actor = 'user') {
  return db.tx(async (q) => {
    const rows = await q.query<{ origin: string }>(`select origin from campaigns where campaign_id = $1`, [id]);
    if (!rows.length) throw new ValidationError(`Campaign ${id} not found.`);
    if (rows[0].origin !== 'app') throw new ValidationError(`${id} comes from the source dataset and cannot be deleted. Set its status to stopped instead.`);
    const used = await q.query<{ n: string }>(
      `select ((select count(*) from daily_marketing where campaign_id = $1) + (select count(*) from registrations where campaign_id = $1) + (select count(*) from people where first_campaign_id = $1))::text as n`,
      [id],
    );
    if (Number(used[0].n) > 0) throw new ValidationError(`${id} already has data rows (${used[0].n}). Remove them on the Data page first, or set the status to stopped.`);
    await q.query(`update tasks set campaign_id = null, updated_at = now() where campaign_id = $1`, [id]);
    await q.query(`delete from campaigns where campaign_id = $1`, [id]);
    await logChange(q, actor, 'campaign', id, 'delete', null);
    await bumpVersion(q);
  });
}

// ------------------------------------------------------------------ initiatives
export async function updateInitiative(db: Db, id: string, patch: Record<string, unknown>, actor = 'user') {
  const allowed = ['status', 'owner_id', 'budget_inr', 'expected_visitors', 'start_date', 'end_date', 'scale_rule', 'change_rule', 'stop_rule', 'primary_kpi', 'name', 'concept'];
  const statuses = ['planned', 'testing', 'scaling', 'changed', 'stopped', 'done'];
  if (patch.status && !statuses.includes(String(patch.status))) throw new ValidationError(`status must be one of ${statuses.join(', ')}.`);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const k of allowed) {
    if (!(k in patch)) continue;
    params.push(patch[k]);
    sets.push(`${k} = $${params.length}`);
  }
  if (!sets.length) throw new ValidationError('Nothing to update.');
  params.push(id);
  return db.tx(async (q) => {
    const r = await q.query(`update initiatives set ${sets.join(', ')}, updated_at = now() where id = $${params.length} returning id`, params);
    if (!r.length) throw new ValidationError(`Initiative ${id} not found.`);
    await logChange(q, actor, 'initiative', id, 'update', patch);
    return id;
  });
}

// ------------------------------------------------------------------ settings
export async function updateSettings(db: Db, patch: Record<string, unknown>, actor = 'user') {
  const numeric = ['showRateAssumption', 'scaleCostFactor', 'changeCostFactor', 'stopCostFactor', 'maxOptOutRate', 'maxCancelRateGapPts', 'momentumDropRatio', 'spendElasticity'];
  return db.tx(async (q) => {
    for (const [k, v] of Object.entries(patch)) {
      if (numeric.includes(k)) {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${k} must be a non-negative number.`);
        if ((k === 'showRateAssumption' || k === 'maxOptOutRate' || k === 'momentumDropRatio') && n > 1) throw new ValidationError(`${k} is a share between 0 and 1.`);
      } else if (k === 'showRateByCampaign') {
        if (typeof v !== 'object' || v == null) throw new ValidationError('showRateByCampaign must be an object of campaign_id -> share.');
      } else throw new ValidationError(`Unknown setting ${k}.`);
      await q.query(`insert into settings (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`, [k, JSON.stringify(v)]);
    }
    await logChange(q, actor, 'settings', null, 'update', patch);
    await bumpVersion(q);
  });
}

// ------------------------------------------------------------------ generic source-table editing
function coerce(col: ColSpec, v: unknown): unknown {
  if (v === undefined) return undefined;
  if (v === null || v === '') {
    if (col.required) throw new ValidationError(`${col.label} is required.`);
    return null;
  }
  switch (col.type) {
    case 'int':
    case 'num': {
      const n = Number(String(v).replace(/[,₹\s]/g, ''));
      if (!Number.isFinite(n)) throw new ValidationError(`${col.label} must be a number.`);
      return col.type === 'int' ? Math.round(n) : n;
    }
    case 'date': {
      const d = toDateOnly(v);
      if (!d) throw new ValidationError(`${col.label} must be a date (YYYY-MM-DD).`);
      return d;
    }
    case 'ts': {
      const t = toIstTimestamp(v);
      if (!t || Number.isNaN(Date.parse(t))) throw new ValidationError(`${col.label} must be a date-time like 2025-03-02 10:00 (IST).`);
      return t;
    }
    case 'enum': {
      const s = String(v).trim().toLowerCase();
      if (col.options && !col.options.includes(s)) throw new ValidationError(`${col.label} must be one of ${col.options.join(', ')}.`);
      return s;
    }
    case 'bool':
      return v === true || String(v).toLowerCase() === 'true';
    default:
      return String(v).trim();
  }
}

export function spec(key: string): TableSpec {
  const s = TABLES[key];
  if (!s) throw new ValidationError(`Unknown table "${key}".`);
  return s;
}

const selectCols = (s: TableSpec) =>
  s.columns
    .map((c) => (c.type === 'date' ? `${c.name}::text as ${c.name}` : c.type === 'ts' ? `to_char(${c.name} at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS') as ${c.name}` : c.name))
    .join(', ');

export async function listRows(db: Db, key: string, q: string | null, limit = 50, offset = 0) {
  const s = spec(key);
  const params: unknown[] = [];
  let where = '';
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    where = `where ${s.search.map((c) => `${c}::text ilike $1`).join(' or ')}`;
  }
  const total = await db.query<{ n: string }>(`select count(*)::text as n from ${s.table} ${where}`, params);
  params.push(Math.min(200, Math.max(1, limit)), Math.max(0, offset));
  const rows = await db.query(`select ${selectCols(s)} from ${s.table} ${where} order by ${s.orderBy} limit $${params.length - 1} offset $${params.length}`, params);
  return { total: Number(total[0].n), rows };
}

export async function insertRow(db: Db, key: string, values: Record<string, unknown>, actor = 'user') {
  const s = spec(key);
  if (!s.insertable) throw new ValidationError(`${s.label} rows cannot be added.`);
  const cols: string[] = [];
  const params: unknown[] = [];
  for (const c of s.columns) {
    if (c.name === s.pk && s.pkGenerated) continue;
    const v = coerce(c, values[c.name]);
    if (v === undefined) {
      if (c.required) throw new ValidationError(`${c.label} is required.`);
      continue;
    }
    cols.push(c.name);
    params.push(v);
  }
  return db.tx(async (q) => {
    if (!s.pkGenerated) {
      const dup = await q.query(`select 1 from ${s.table} where ${s.pk} = $1`, [values[s.pk]]);
      if (dup.length) throw new ValidationError(`${s.pk} "${values[s.pk]}" already exists.`);
    }
    const r = await q.query<Record<string, unknown>>(`insert into ${s.table} (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) returning ${s.pk}`, params);
    const id = String(r[0][s.pk]);
    await logChange(q, actor, s.table, id, 'insert', values);
    if (s.affectsAnalytics) await bumpVersion(q);
    return id;
  });
}

export async function updateRow(db: Db, key: string, id: string, patch: Record<string, unknown>, actor = 'user') {
  const s = spec(key);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const c of s.columns) {
    if (!(c.name in patch) || !c.editable) continue;
    params.push(coerce(c, patch[c.name]));
    sets.push(`${c.name} = $${params.length}`);
  }
  if (!sets.length) throw new ValidationError('Nothing to update (no editable columns supplied).');
  params.push(id);
  return db.tx(async (q) => {
    const before = await q.query(`select ${selectCols(s)} from ${s.table} where ${s.pk}::text = $1`, [id]);
    if (!before.length) throw new ValidationError(`${s.label}: ${id} not found.`);
    await q.query(`update ${s.table} set ${sets.join(', ')} where ${s.pk}::text = $${params.length}`, params);
    await logChange(q, actor, s.table, id, 'update', { before: before[0], patch });
    if (s.affectsAnalytics) await bumpVersion(q);
    return id;
  });
}

export async function deleteRow(db: Db, key: string, id: string, actor = 'user') {
  const s = spec(key);
  if (!s.deletable) throw new ValidationError(`${s.label} rows cannot be deleted.`);
  return db.tx(async (q) => {
    const before = await q.query(`select ${selectCols(s)} from ${s.table} where ${s.pk}::text = $1`, [id]);
    if (!before.length) throw new ValidationError(`${s.label}: ${id} not found.`);
    await q.query(`delete from ${s.table} where ${s.pk}::text = $1`, [id]);
    await logChange(q, actor, s.table, id, 'delete', { before: before[0] });
    if (s.affectsAnalytics) await bumpVersion(q);
  });
}

export async function recentChanges(db: Db, limit = 50) {
  return db.query(`select id, at, actor, entity, entity_id, action, detail from change_log order by id desc limit $1`, [limit]);
}
