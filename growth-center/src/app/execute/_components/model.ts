import { CircleCheckDuotone, CircleDotDuotone, HandDuotone, PlayDuotone } from 'runeicons-react';
import type { IconComponent } from '@/components/ui';
import { daysBetween } from '@/lib/format';

/** Row shape of GET /api/tasks (src/server/mutations.ts listTasks: tasks.* plus joined names). */
export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  campaign_id: string | null;
  initiative_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  decision: string | null;
  source: string;
  evidence: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string | null;
  campaign_name: string | null;
  initiative_name: string | null;
}

/** Row shape of GET /api/changes (change_log). */
export interface ChangeRow {
  id: number;
  at: string;
  actor: string;
  entity: string;
  entity_id: string | null;
  action: string;
  detail: unknown;
}

export interface InitiativeLite {
  id: string;
  name: string;
  rank?: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

/**
 * Lane heads: a glyph block per task status. Same fills as the task chips on the campaign detail page
 * (to do stone, in progress a deeper stone, blocked solid, done ink), so a status reads the same everywhere.
 */
export const LANE: Record<TaskStatus, { icon: IconComponent; bg: string; ia: string; ib: string }> = {
  todo: { icon: CircleDotDuotone, bg: 'var(--stone-2)', ia: 'var(--ink)', ib: 'var(--ink-2)' },
  in_progress: { icon: PlayDuotone, bg: 'var(--stone-3)', ia: 'var(--ink)', ib: 'var(--ink-2)' },
  blocked: { icon: HandDuotone, bg: 'var(--st-stop)', ia: '#fff', ib: '#fff' },
  // the glyph's check is drawn white, so its disc takes a lighter bidri step to stay visible on ink
  done: { icon: CircleCheckDuotone, bg: 'var(--ink)', ia: 'var(--bidri-3)', ib: '#fff' },
};

/** "Meera Iyer" -> "MI", "Keerthi M" -> "KM". */
export const initials = (name: string | null | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
export const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const SOURCES: { value: string; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'copilot', label: 'From copilot' },
  { value: 'insight', label: 'From insight' },
  { value: 'seed', label: 'Seeded plan' },
];

export const CAMPAIGN_STATUSES = ['planned', 'active', 'paused', 'stopped', 'completed'] as const;
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = { planned: 'Planned', active: 'Active', paused: 'Paused', stopped: 'Stopped', completed: 'Completed' };

/** Days a task is overdue relative to today (IST), or 0 when it is not overdue. */
export function overdueDays(t: Pick<TaskRow, 'due_date' | 'status'>, today: string): number {
  if (!t.due_date || t.status === 'done') return 0;
  const d = daysBetween(t.due_date, today);
  return d > 0 ? d : 0;
}

/** Parse a money input like "2,74,000" or "₹ 50000". Returns undefined when it is not a number. */
export function parseInr(s: string): number | null | undefined {
  const clean = s.replace(/[₹,\s]/g, '');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const IN = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** Indian digit grouping without the currency sign, for inputs that already show ₹. */
export const groupIN = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '' : IN.format(n));
