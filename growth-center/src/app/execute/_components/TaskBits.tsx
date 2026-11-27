'use client';
import { useState, type SelectHTMLAttributes } from 'react';
import { CalendarDuotone, ChartBarDuotone, ClockAlertDuotone, MapDuotone, PencilDuotone, SparklesDuotone } from 'runeicons-react';
import { toast } from 'sonner';
import { mutate } from '@/lib/api';
import { DECISION, type DecisionKey } from '@/lib/colors';
import { dateLabel, num } from '@/lib/format';
import { Button, Chip, cx, Dialog, Ico, Pips, StatusPill, type IconComponent } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { initials, overdueDays, STATUSES, type TaskRow, type TaskStatus } from './model';

const PRIORITY: Record<string, { label: string; level: number }> = { high: { label: 'High', level: 3 }, medium: { label: 'Medium', level: 2 }, low: { label: 'Low', level: 1 } };

/** Priority as fill weight: three rising pips and the word. */
export function PriorityMark({ priority, className }: { priority: string; className?: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.medium;
  return (
    <span className={cx('inline-flex items-center gap-1 text-[12px] font-[650] whitespace-nowrap text-ink', className)} title={`${p.label} priority`}>
      <Pips level={p.level} />
      {p.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/** Task decisions include fix and monitor, which the status pill does not cover. */
const EXTRA_DECISION: Record<string, string> = { fix: 'Fix', monitor: 'Monitor' };
export function TaskDecisionChip({ decision, className }: { decision: string | null; className?: string }) {
  if (!decision) return null;
  if (decision in DECISION) return <StatusPill decision={decision as DecisionKey} className={className} />;
  return <Chip className={cx('h-6', className)}>{EXTRA_DECISION[decision] ?? decision}</Chip>;
}

/** Owner initials in an ink disc; an empty dashed disc when nobody owns the task. */
export function Avatar({ name, size = 22, inverse }: { name: string | null | undefined; size?: number; /** on an ink ground */ inverse?: boolean }) {
  if (!name)
    return <span aria-hidden className={cx('inline-block shrink-0 rounded-full border-[1.5px] border-dashed', inverse ? 'border-silver-2' : 'border-stone-3')} style={{ width: size, height: size }} />;
  return (
    <span aria-hidden className={cx('inline-grid shrink-0 place-items-center rounded-full leading-none font-[700]', inverse ? 'bg-white text-ink' : 'bg-ink text-white')} style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {initials(name)}
    </span>
  );
}

/** Due date as a chip: solid ink once it is late (severity is fill weight), limestone before. */
export function DueChip({ task, today }: { task: TaskRow; today: string }) {
  const late = overdueDays(task, today);
  if (!task.due_date) return <span className="inline-flex h-[22px] items-center rounded-full px-2 text-[11.5px] font-[600] text-ink-2 shadow-[inset_0_0_0_1.5px_var(--stone-3)]">No due date</span>;
  if (late)
    return (
      <span className="tab inline-flex h-[22px] items-center gap-1 rounded-full bg-ink pr-2 pl-1.5 text-[11.5px] font-[700] whitespace-nowrap text-white">
        <Ico icon={ClockAlertDuotone} size={13} ia="#fff" ib="rgba(255,255,255,0.55)" />
        {num(late)} {late === 1 ? 'day' : 'days'} late
      </span>
    );
  const sameYear = task.due_date.slice(0, 4) === today.slice(0, 4);
  return (
    <span className="tab inline-flex h-[22px] items-center gap-1 rounded-full bg-stone-2 pr-2 pl-1.5 text-[11.5px] font-[650] whitespace-nowrap text-ink">
      <Ico icon={CalendarDuotone} size={13} ia="var(--ink)" ib="var(--stone-3)" />
      {task.due_date === today ? 'Due today' : `Due ${dateLabel(task.due_date, !sameYear)}`}
    </span>
  );
}

const SOURCE: Record<string, { label: string; icon: IconComponent; ia: string; ib: string }> = {
  copilot: { label: 'From the copilot', icon: SparklesDuotone, ia: 'var(--lac)', ib: 'var(--lac-pale)' },
  insight: { label: 'From an insight', icon: ChartBarDuotone, ia: 'var(--nizami)', ib: 'var(--nizami-2)' },
  seed: { label: 'Seeded plan', icon: MapDuotone, ia: 'var(--ink-2)', ib: 'var(--stone-3)' },
  manual: { label: 'Added by hand', icon: PencilDuotone, ia: 'var(--ink-2)', ib: 'var(--stone-3)' },
};

/** Where a task came from: a glyph with its words in a tooltip (`label` prints them too). */
export function SourceMark({ source, label }: { source: string; label?: boolean }) {
  const s = SOURCE[source] ?? SOURCE.manual;
  return (
    <span tabIndex={label ? undefined : 0} {...(label ? null : tipProps({ title: s.label }))} className="inline-flex shrink-0 cursor-default items-center gap-1 rounded-full text-[12px] font-[550] text-ink-2">
      <Ico icon={s.icon} size={15} ia={s.ia} ib={s.ib} />
      {label ? s.label : <span className="sr-only">{s.label}</span>}
    </span>
  );
}

/** Compact native select for dense rows and tiles. */
export function MiniSelect({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cx(
        'h-8 cursor-pointer rounded-full border-[1.5px] border-stone-3 bg-ground pr-7 pl-3 text-[12.5px] font-[600] text-ink transition-colors duration-150 hover:border-ink-2/60 focus:border-ink focus:outline-none',
        className,
      )}
    >
      {children}
    </select>
  );
}

/** The keyboard fallback for drag and drop: the same move, from a menu. */
export function StatusSelect({ task, onMove, className }: { task: TaskRow; onMove: (t: TaskRow, s: TaskStatus) => void; className?: string }) {
  return (
    <MiniSelect aria-label={`Status of “${task.title}”`} value={task.status} onChange={(e) => onMove(task, e.target.value as TaskStatus)} className={className}>
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </MiniSelect>
  );
}

/** Confirmation before a task is deleted. */
export function DeleteTaskDialog({ task, onClose, onDeleted }: { task: TaskRow | null; onClose: () => void; onDeleted?: (id: number) => void }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await mutate(`/api/tasks/${task.id}`, 'DELETE');
      onDeleted?.(task.id);
      toast.success('Task deleted', { description: task.title });
      onClose();
    } catch (e) {
      toast.error(`Could not delete the task: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={!!task} onClose={onClose} title="Delete this task?" width={440}>
      <p className="text-[14px] font-[650] text-ink">{task?.title}</p>
      <p className="mt-2 text-[13.5px] text-ink-2">The task is removed for everyone. The activity log keeps a record that it was deleted.</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep task
        </Button>
        <Button variant="danger" onClick={run} disabled={busy}>
          {busy ? 'Deleting…' : 'Delete task'}
        </Button>
      </div>
    </Dialog>
  );
}
