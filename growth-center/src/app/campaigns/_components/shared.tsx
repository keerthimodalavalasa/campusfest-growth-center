'use client';
import type { ReactNode } from 'react';
import { InfoDuotone } from 'runeicons-react';
import type { CampaignMetrics, Snapshot } from '@/server/engine/snapshot';
import type { DecisionBoard, Recommendation } from '@/server/engine/decide';
import type { Signal, StageBottleneck } from '@/server/engine/diagnose';
import type { DailyPoint, WeeklyPoint } from '@/server/engine/timeseries';
import type { Campaign } from '@/server/engine/types';
import { Chip, cx, Ico } from '@/components/ui';
import { tipProps } from '@/components/tooltip';

/* ------------------------------------------------------------------ API shapes */

/** GET /api/campaigns */
export interface CampaignsResponse {
  asOf: string;
  phase: Snapshot['phase'];
  campaigns: CampaignMetrics[];
  totals: CampaignMetrics;
  decisions: DecisionBoard;
}

/** A row from listTasks (tasks joined with team, campaigns and initiatives). */
export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  campaign_id: string | null;
  initiative_id: string | null;
  owner_id: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  decision: string | null;
  source: string;
  evidence: string | null;
  owner_name: string | null;
  campaign_name: string | null;
  initiative_name: string | null;
}

/** GET /api/campaigns/{id} */
export interface CampaignDetailResponse {
  asOf: string;
  phase: Snapshot['phase'];
  campaign: Campaign | null;
  metrics: CampaignMetrics | null;
  totals: CampaignMetrics;
  decision: Recommendation | null;
  stageGaps: StageBottleneck[];
  signals: Signal[];
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  tasks: TaskRow[];
}

export const UNATTRIBUTED = 'UNATTRIBUTED';

export const isPostEvent = (phase: Snapshot['phase']) => phase === 'event' || phase === 'post-event';

/* ------------------------------------------------------------------ labels */

export const CAMPAIGN_STATUSES = ['planned', 'active', 'paused', 'stopped', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

const STATUS_LABEL: Record<string, string> = { planned: 'Planned', active: 'Active', paused: 'Paused', stopped: 'Stopped', completed: 'Completed' };

export const statusLabel = (s: string | null | undefined) => (s ? STATUS_LABEL[s] ?? s : '–');

/**
 * Lifecycle mark: shape and weight, never a hue (hues belong to families, campaigns and the four calls).
 * Active is a solid ink dot, planned a ring, paused half-filled, stopped a square, completed a faint dot.
 */
function StatusMark({ status }: { status: string }) {
  const base = 'inline-block size-2 shrink-0';
  if (status === 'active') return <i aria-hidden className={cx(base, 'rounded-full bg-ink')} />;
  if (status === 'planned') return <i aria-hidden className={cx(base, 'rounded-full shadow-[inset_0_0_0_1.5px_var(--ink-2)]')} />;
  if (status === 'paused') return <i aria-hidden className={cx(base, 'rounded-full shadow-[inset_0_0_0_1.5px_var(--ink-2)]')} style={{ background: 'linear-gradient(90deg, var(--ink-2) 50%, transparent 50%)' }} />;
  if (status === 'stopped') return <i aria-hidden className={cx(base, 'rounded-[2px] bg-ink-2')} />;
  return <i aria-hidden className={cx(base, 'rounded-full bg-stone-3')} />;
}

export function StatusChip({ status }: { status: string }) {
  if (!STATUS_LABEL[status]) return <span className="text-ink-2">–</span>;
  return (
    <Chip bg="var(--ground)" className="shadow-[inset_0_0_0_1.5px_var(--stone-3)]">
      <StatusMark status={status} />
      {STATUS_LABEL[status]}
    </Chip>
  );
}

/** Compact status for dense tables and cards: the mark and the word. */
export function StatusText({ status }: { status: string }) {
  if (!STATUS_LABEL[status]) return <span className="text-ink-2">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <StatusMark status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** "paid_social" -> "Paid social" */
export const channelLabel = (c: string | null | undefined) => {
  if (!c) return '–';
  const s = c.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Task states as weight on limestone: blocked is the only one that borrows the stop colour, and it carries a glyph. */
export const TASK_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  todo: { label: 'To do', fg: 'var(--ink-2)', bg: 'var(--stone-2)' },
  in_progress: { label: 'In progress', fg: 'var(--ink)', bg: 'var(--stone-3)' },
  blocked: { label: 'Blocked', fg: '#fff', bg: 'var(--st-stop)' },
  done: { label: 'Done', fg: '#fff', bg: 'var(--ink)' },
};

/** Percentage-point gap with one decimal: "+2.3 pts" / "−9.0 pts". */
export const pts = (x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return '–';
  const r = Math.round(x * 10) / 10;
  if (r === 0) return '0.0 pts';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toFixed(1)} pts`;
};

/** Ratio as "2.82×". */
export const times = (x: number | null | undefined) => (x == null || !Number.isFinite(x) ? '–' : `${x.toFixed(2)}×`);

/**
 * A task title from a suggested action: its first sentence, cut at the first top-level comma when long.
 * "Stop or restructure: pause new spend on X, keep only ..." -> "Stop or restructure: pause new spend on X"
 */
export function titleFromAction(action: string, max = 90) {
  const first = action.split(/(?<=\.)\s/)[0].replace(/\.$/, '').trim();
  if (first.length <= max) return first;
  let depth = 0;
  for (let i = 0; i < first.length; i++) {
    const ch = first[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0 && i > 20) return first.slice(0, i);
  }
  return first;
}

/**
 * ResponsiveContainer resize debounce (ms, trailing edge). Full-page screenshots and some browser tools
 * resize the window for an instant; without this the chart re-renders at that throwaway size.
 */
export const CHART_RESIZE_DEBOUNCE = 250;

/**
 * Evenly spaced axis ticks with a tidy step (1, 2, 2.5 or 5 x 10^n) covering [min, max]; min is 0 unless negative.
 * `integer` keeps every step a whole number, for counts and rupees, so small ranges never print "0, 0, 1, 1".
 */
export function niceTicks(min: number, max: number, count = 4, integer = false) {
  const lo = Math.min(0, min);
  const hi = Math.max(max, lo + 1);
  const raw = (hi - lo) / count;
  const p = 10 ** Math.floor(Math.log10(raw));
  let step = ([1, 2, 2.5, 5, 10].find((m) => m * p >= raw) ?? 10) * p;
  if (integer) step = Math.max(1, Math.ceil(step - 1e-9));
  const start = Math.floor(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v < hi + step - 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/** IST calendar date (YYYY-MM-DD) for an epoch-ms timestamp. */
export const istDate = (ms: number | null | undefined) => (ms == null ? null : new Date(ms + 5.5 * 3600 * 1000).toISOString().slice(0, 10));

/* ------------------------------------------------------------------ info tooltip */

/** Small focusable "i" button that shows an explanation in the shared dark tooltip on hover or keyboard focus. */
export function InfoTip({ label, children, className }: { label: string; children: ReactNode; side?: 'left' | 'right'; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${typeof children === 'string' ? children : ''}`}
      onClick={(e) => e.stopPropagation()}
      {...tipProps({ title: label, notes: [children] })}
      className={cx('inline-grid size-[18px] shrink-0 place-items-center rounded-full align-middle text-ink-2 transition-colors duration-150 hover:bg-stone-2 hover:text-ink', className)}
    >
      <Ico icon={InfoDuotone} size={14} ia="currentColor" ib="var(--stone-3)" />
    </button>
  );
}
