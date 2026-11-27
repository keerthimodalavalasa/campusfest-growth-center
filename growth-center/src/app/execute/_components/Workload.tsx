'use client';
import { num } from '@/lib/format';
import type { TeamMember } from '@/lib/app-state';
import { cx } from '@/components/ui';
import { overdueDays, type TaskRow } from './model';

interface Load {
  id: string;
  name: string;
  role: string | null;
  open: number;
  overdue: number;
  high: number;
}

/** Per-owner open work: open tasks, how many are overdue, how many are high priority. Click an owner to filter the board. */
export function Workload({ tasks, team, today, selected, onSelect }: { tasks: TaskRow[]; team: TeamMember[]; today: string; selected: string; onSelect?: (ownerId: string) => void }) {
  const known = new Set(team.map((m) => m.ownerId));
  const openTasks = tasks.filter((t) => t.status !== 'done');
  const load = (id: string, name: string, role: string | null): Load => {
    const mine = openTasks.filter((t) => (t.owner_id && known.has(t.owner_id) ? t.owner_id : '__none') === id);
    return { id, name, role, open: mine.length, overdue: mine.filter((t) => overdueDays(t, today) > 0).length, high: mine.filter((t) => t.priority === 'high').length };
  };
  const rows: Load[] = team.map((m) => load(m.ownerId, m.ownerName, m.role));
  const un = load('__none', 'Unassigned', 'Tasks without an owner');
  if (un.open) rows.push(un);
  const max = Math.max(1, ...rows.map((r) => r.open));

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-1.5 rounded-[var(--radius-panel)] bg-paper-2 p-1.5">
      {rows.map((r) => {
        const on = selected === r.id;
        const body = (
          <>
            <div className="min-w-0">
              <div className="truncate text-[0.88rem] font-semibold text-ink">{r.name}</div>
              <div className="truncate text-[0.75rem] text-ink-3" title={r.role ?? undefined}>
                {r.role ?? 'No role set'}
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Stat label="Open" value={r.open} />
              <Stat label="Overdue" value={r.overdue} tone={r.overdue ? 'var(--lac)' : undefined} />
              <Stat label="High" value={r.high} tone={r.high ? 'var(--zari)' : undefined} />
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-paper-2" role="img" aria-label={`${r.open} open, ${r.overdue} overdue`} title="Open tasks, crimson part overdue, scaled to the busiest owner">
              <div className="absolute inset-y-0 left-0 rounded-full bg-ink-3" style={{ width: `${(r.open / max) * 100}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-lac" style={{ width: `${(r.overdue / max) * 100}%` }} />
            </div>
          </>
        );
        const base = 'flex min-w-0 flex-col gap-2 rounded-[10px] border px-3.5 py-3 text-left';
        // with no tasks there is nothing to filter, so the cards are plain figures rather than buttons
        if (!onSelect)
          return (
            <div key={r.id} className={cx(base, 'border-transparent bg-surface')}>
              {body}
            </div>
          );
        return (
          <button
            key={r.id}
            onClick={() => onSelect(on ? '' : r.id)}
            aria-pressed={on}
            title={on ? 'Show every owner' : `Show only ${r.name}'s tasks`}
            className={cx(base, 'transition-colors', on ? 'border-sagar bg-sagar-soft' : 'border-transparent bg-surface hover:border-line-2')}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="num type-title text-[1.15rem] leading-none" style={{ color: tone ?? (value ? 'var(--ink)' : 'var(--ink-3)') }}>
        {num(value)}
      </div>
      <div className="mt-0.5 text-[0.72rem] text-ink-3">{label}</div>
    </div>
  );
}
