import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Db } from './db';
import { parseWorkbook, writeWorkbook, type ImportResult } from './importer';
import { DEFAULT_SETTINGS } from './engine/types';

const SETTING_DESCRIPTIONS: Record<string, string> = {
  showRateAssumption: 'Share of CONFIRMED registrants expected to attend, used only for pre-event projections. Default 0.75 from PheedLoop 2026 (free events with 500+ registrants: ~24% no-show). Not derived from this dataset.',
  showRateByCampaign: 'Optional per-campaign override of the show-rate assumption, e.g. {"C02": 0.6}.',
  scaleCostFactor: 'SCALE when cost per (expected) visitor is at or below this multiple of the portfolio median.',
  changeCostFactor: 'CHANGE when cost per (expected) visitor is above this multiple of the portfolio median.',
  stopCostFactor: 'STOP when cost per (expected) visitor is at or above this multiple of the portfolio median.',
  maxOptOutRate: 'Quality guardrail: opt-outs / identified people above this share block SCALE and trigger CHANGE.',
  maxCancelRateGapPts: 'Quality guardrail: cancellation rate more than this many points above the portfolio rate triggers CHANGE.',
  momentumDropRatio: 'Momentum guardrail: last-7-day registrations below this share of the previous 7 days (with spend) triggers CHANGE.',
  spendElasticity: 'Budget simulator: visitors scale with (new spend / current spend)^elasticity. 0.6 means doubling spend yields ~1.52x visitors (diminishing returns); an assumption, not measured.',
};

export async function readSchema(): Promise<string> {
  return readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8');
}

export async function originalWorkbook(): Promise<Buffer> {
  return readFile(path.join(process.cwd(), 'data', 'attendee-dataset.xlsx'));
}

export async function ensureSchema(db: Db) {
  await db.exec(await readSchema());
  await db.query(`insert into meta (key, value) values ('data_version', '0') on conflict (key) do nothing`);
}

export async function seedSettings(db: Db, overwrite = false) {
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query(
      `insert into settings (key, value, description) values ($1, $2::jsonb, $3)
       on conflict (key) do ${overwrite ? 'update set value = excluded.value, description = excluded.description' : 'update set description = excluded.description'}`,
      [k, JSON.stringify(v), SETTING_DESCRIPTIONS[k] ?? null],
    );
  }
}

/** Load (or reload) the original attendee dataset from data/attendee-dataset.xlsx. */
export async function importOriginal(db: Db): Promise<ImportResult> {
  const parsed = await parseWorkbook(await originalWorkbook());
  return writeWorkbook(db, parsed, 'original: Attendee Dataset.xlsx');
}

export interface ManagementSeed {
  team?: { owner_id: string; owner_name: string; role: string }[];
  initiatives?: Record<string, unknown>[];
  tasks?: Record<string, unknown>[];
}

export async function seedManagement(db: Db, seed: ManagementSeed, replace = false) {
  await db.tx(async (c) => {
    for (const t of seed.team ?? []) {
      await c.query(`insert into team (owner_id, owner_name, role) values ($1,$2,$3) on conflict (owner_id) do update set owner_name = excluded.owner_name, role = excluded.role`, [t.owner_id, t.owner_name, t.role]);
    }
    if (replace) {
      await c.query('delete from tasks');
      await c.query('delete from initiatives');
    }
    for (const i of seed.initiatives ?? []) {
      const cols = Object.keys(i);
      await c.query(
        `insert into initiatives (${cols.join(',')}) values (${cols.map((_, k) => `$${k + 1}`).join(',')}) on conflict (id) do nothing`,
        cols.map((k) => (Array.isArray(i[k]) ? i[k] : i[k])),
      );
    }
    const existing = await c.query<{ n: string }>(`select count(*)::text as n from tasks`);
    if (Number(existing[0].n) === 0) {
      for (const t of seed.tasks ?? []) {
        const cols = Object.keys(t);
        await c.query(`insert into tasks (${cols.join(',')}) values (${cols.map((_, k) => `$${k + 1}`).join(',')})`, cols.map((k) => t[k]));
      }
    }
    await c.query(`insert into meta (key, value) values ('data_version', '1') on conflict (key) do update set value = (meta.value::bigint + 1)::text`);
  });
}
