'use client';
import { useState, type SelectHTMLAttributes } from 'react';
import { Lightbulb, PenLine, Sparkles, Sprout } from 'lucide-react';
import { toast } from 'sonner';
import { mutate } from '@/lib/api';
import { DECISION, SEVERITY, type DecisionKey } from '@/lib/colors';
import { Button, Chip, cx, DecisionChip, Dialog } from '@/components/ui';
import { STATUSES, type TaskRow, type TaskStatus } from './model';

export function PriorityChip({ priority }: { priority: string }) {
  const s = SEVERITY[(priority in SEVERITY ? priority : 'medium') as keyof typeof SEVERITY];
  return (
    <Chip fg={s.fg} bg={s.bg} title={`${s.label} priority`}>
      {s.label}
    </Chip>
  );
}

/** Task decisions include fix and monitor, which the shared DecisionChip does not cover. */
const EXTRA_DECISION: Record<string, string> = { fix: 'Fix', monitor: 'Monitor' };
export function TaskDecisionChip({ decision }: { decision: string | null }) {
  if (!decision) return null;
  if (decision in DECISION) return <DecisionChip decision={decision as DecisionKey} />;
  return (
    <Chip>
      <span className="size-1.5 rounded-full bg-ink-3" aria-hidden />
      {EXTRA_DECISION[decision] ?? decision}
    </Chip>
  );
}

export function SourceMark({ source }: { source: string }) {
  if (source === 'copilot')
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-lac">
        <Sparkles size={12} aria-hidden />
        from copilot
      </span>
    );
  if (source === 'insight')
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-sagar">
        <Lightbulb size={12} aria-hidden />
        from insight
      </span>
    );
  if (source === 'seed')
    return (
      <span className="inline-flex items-center gap-1 text-[0.75rem] text-ink-3">
        <Sprout size={12} aria-hidden />
        seeded plan
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[0.75rem] text-ink-3">
      <PenLine size={12} aria-hidden />
      manual
    </span>
  );
}

/** Compact native select for dense rows and cards. */
export function MiniSelect({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...p}
      className={cx('h-7 rounded-[6px] border border-line-2 bg-surface pl-1.5 pr-6 text-[0.78rem] text-ink-2 hover:border-ink-3 focus:border-sagar focus:outline-none', className)}
    >
      {children}
    </select>
  );
}

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
      <p className="text-[0.92rem] text-ink">{task?.title}</p>
      <p className="mt-2 text-[0.85rem] text-ink-2">The task is removed for everyone. The activity log keeps a record that it was deleted.</p>
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
