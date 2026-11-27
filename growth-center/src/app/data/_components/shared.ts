import type { ColumnSpec, TableMeta } from '@/lib/app-state';

/** One row as the data API returns it. Postgres numerics arrive as strings. */
export type Row = Record<string, string | number | boolean | null>;

/** What the row dialog is doing. `initial` pre-fills values (quick actions, "New version"). */
export interface RowDialogState {
  mode: 'edit' | 'add';
  table: TableMeta;
  row?: Row;
  initial?: Record<string, string>;
  note?: string;
}

/** Singular names used in dialog titles and buttons. */
export const SINGULAR: Record<string, string> = {
  daily_marketing: 'daily marketing row',
  targets: 'target version',
  people: 'person',
  registrations: 'registration',
  registration_history: 'status version',
  checkins: 'check-in',
  interactions: 'interaction',
};

/** Columns the server searches with ?q= (mirrors src/server/tables.ts `search`). */
export const SEARCHES: Record<string, string> = {
  daily_marketing: 'activity ID, campaign or platform',
  targets: 'version name',
  people: 'person ID, name or first campaign',
  registrations: 'registration ID, person ID or campaign',
  registration_history: 'history ID, registration ID, person ID, status or campaign',
  checkins: 'event ID, person ID, registration ID, campaign or result',
  interactions: 'interaction ID, person ID, campaign or event type',
};

/** Short search placeholders that fit the search box; the full column list is in SEARCHES. */
export const SEARCH_SHORT: Record<string, string> = {
  daily_marketing: 'activity ID, campaign or platform',
  targets: 'version name',
  people: 'person ID, name or campaign',
  registrations: 'registration, person or campaign ID',
  registration_history: 'any ID, status or campaign',
  checkins: 'any ID, campaign or result',
  interactions: 'any ID, campaign or event type',
};

/** Tables whose rows are full-state versions: a change is a new version, not an edit. */
export const VERSIONED = new Set(['registration_history', 'targets']);

const ID_PREFIX: Record<string, string> = {
  daily_marketing: 'AD-APP',
  people: 'P-APP',
  registrations: 'R-APP',
  registration_history: 'RH-APP',
  checkins: 'CHK-APP',
  interactions: 'LI-APP',
};

/** A unique-looking ID suggestion for a new row. The reviewer can overwrite it. */
export function suggestId(tableKey: string): string {
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  return `${ID_PREFIX[tableKey] ?? 'APP'}-${stamp}`;
}

export const singular = (key: string) => SINGULAR[key] ?? 'row';

export const isCampaignCol = (c: ColumnSpec) => c.name === 'campaign_id' || c.name === 'first_campaign_id';
export const isOwnerCol = (c: ColumnSpec) => c.name === 'owner_id';
export const isNumeric = (c: ColumnSpec) => c.type === 'int' || c.type === 'num';
export const isMoney = (c: ColumnSpec) => c.name.endsWith('_inr');

/** The date a row carries (the date its effect starts), as YYYY-MM-DD, or null. */
export function carryDate(table: TableMeta, values: Record<string, unknown>): string | null {
  for (const c of table.columns) {
    if (c.type !== 'date' && c.type !== 'ts') continue;
    const v = values[c.name];
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  }
  return null;
}

/** A form-friendly string for a cell value. */
export const asText = (v: unknown) => (v == null ? '' : String(v));

/** "2025-04-12 11:29:49" → "2025-04-12 11:29" when the seconds are zero. */
export const tsText = (v: string) => (v.endsWith(':00') && v.length === 19 ? v.slice(0, 16) : v);

/** A typed IST date-time ("2025-03-09 12:00", "2025-03-09T12:00:05") as "YYYY-MM-DD HH:MM:SS", or null. */
export function tsKey(v: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec((v ?? '').trim());
  if (!m) return null;
  return `${m[1]} ${m[2] ?? '00'}:${m[3] ?? '00'}:${m[4] ?? '00'}`;
}

/** Epoch ms of an IST "YYYY-MM-DD HH:MM:SS" key. */
export const istMs = (key: string) => Date.parse(`${key.replace(' ', 'T')}+05:30`);

/** The IST calendar date (YYYY-MM-DD) of an epoch ms. */
export const istDate = (ms: number) => new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
