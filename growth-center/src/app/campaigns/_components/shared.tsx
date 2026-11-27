'use client';
import { useId, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { CampaignMetrics, Snapshot } from '@/server/engine/snapshot';
import type { DecisionBoard, Recommendation } from '@/server/engine/decide';
import type { Signal, StageBottleneck } from '@/server/engine/diagnose';
import type { DailyPoint, WeeklyPoint } from '@/server/engine/timeseries';
import type { Campaign } from '@/server/engine/types';
import { Chip, cx } from '@/components/ui';

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
const STATUS_DOT: Record<string, string> = { planned: 'var(--sagar)', active: 'var(--bangle)', paused: 'var(--zari-bright)', stopped: 'var(--lac)', completed: 'var(--ink-3)' };

export const statusLabel = (s: string | null | undefined) => (s ? STATUS_LABEL[s] ?? s : '–');

export function StatusChip({ status }: { status: string }) {
  if (!STATUS_LABEL[status]) return <span className="text-ink-3">–</span>;
  return (
    <Chip>
      <span className="size-1.5 rounded-full" style={{ background: STATUS_DOT[status] }} aria-hidden />
      {STATUS_LABEL[status]}
    </Chip>
  );
}

/** Compact status for dense tables: coloured dot and the word. */
export function StatusText({ status }: { status: string }) {
  if (!STATUS_LABEL[status]) return <span className="text-ink-3">–</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <span className="size-1.5 rounded-full" style={{ background: STATUS_DOT[status] }} aria-hidden />
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

export const TASK_STATUS: Record<string, { label: string; fg: string; bg: string }> = {
  todo: { label: 'To do', fg: 'var(--ink-2)', bg: 'var(--paper-2)' },
  in_progress: { label: 'In progress', fg: 'var(--sagar)', bg: 'var(--sagar-soft)' },
  blocked: { label: 'Blocked', fg: 'var(--lac)', bg: 'var(--lac-soft)' },
  done: { label: 'Done', fg: 'var(--bangle)', bg: 'var(--bangle-soft)' },
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

/** Small focusable "i" button that reveals an explanation on hover or keyboard focus. */
export function InfoTip({ label, children, side = 'left', className }: { label: string; children: ReactNode; side?: 'left' | 'right'; className?: string }) {
  const id = useId();
  return (
    <span className={cx('group/tip relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        onClick={(e) => e.stopPropagation()}
        className="inline-grid size-[18px] place-items-center rounded-full text-ink-3 hover:bg-paper-2 hover:text-ink"
      >
        <Info size={13} strokeWidth={2} aria-hidden />
      </button>
      <span
        role="tooltip"
        id={id}
        aria-hidden
        className={cx(
          'pointer-events-none invisible absolute top-full z-30 mt-1 w-64 rounded-lg border border-line bg-surface px-3 py-2 text-left text-[0.78rem] leading-snug font-normal whitespace-normal text-ink-2 opacity-0 shadow-[0_6px_24px_-12px_rgba(27,36,48,0.35)] transition-opacity',
          'group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100',
          side === 'left' ? 'right-0' : 'left-0',
        )}
        style={{ fontStretch: '100%' }}
      >
        {children}
      </span>
    </span>
  );
}
