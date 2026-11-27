'use client';
import { useState, type DragEvent } from 'react';
import { CalendarDays, Flag, Trash2, UserRound } from 'lucide-react';
import { dateLabel, num } from '@/lib/format';
import { CampaignDot } from '@/components/charts';
import { Button, cx } from '@/components/ui';
import { overdueDays, STATUSES, type TaskRow, type TaskStatus } from './model';
import { PriorityChip, SourceMark, StatusSelect, TaskDecisionChip } from './TaskBits';

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'var(--ink-3)',
  in_progress: 'var(--sagar)',
  blocked: 'var(--lac)',
  done: 'var(--bangle)',
};

/** Same order as the server (due date, undated last, then id), so an optimistic move lands where the refetch will put it. */
const byDue = (a: TaskRow, b: TaskRow) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.id - b.id;

interface BoardProps {
  tasks: TaskRow[];
  today: string;
  showDone: boolean;
  hiddenDone: number;
  onShowDone: () => void;
  onMove: (t: TaskRow, s: TaskStatus) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}

export function TaskBoard({ tasks, today, showDone, hiddenDone, onShowDone, onMove, onOpen, onDelete }: BoardProps) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  const drop = (e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/plain') || dragId);
    const t = tasks.find((x) => x.id === id);
    setOver(null);
    setDragId(null);
    if (t && t.status !== status) onMove(t, status);
  };

  return (
    <div className="@container">
      <p className="sr-only">Drag a card to another column to change its status, or use the status menu on the card.</p>
      <div className="grid gap-3 @2xl:grid-cols-2 @4xl:grid-cols-4">
        {STATUSES.map((col) => {
          const items = tasks.filter((t) => t.status === col.value).sort(byDue);
          const collapsed = col.value === 'done' && !showDone;
          return (
            <section
              key={col.value}
              aria-label={`${col.label}, ${items.length} ${items.length === 1 ? 'task' : 'tasks'}`}
              onDragOver={(e) => {
                if (dragId == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (over !== col.value) setOver(col.value);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === col.value ? null : o));
              }}
              onDrop={(e) => drop(e, col.value)}
              className={cx('flex min-w-0 flex-col rounded-[var(--radius-panel)] bg-paper-2 p-2 transition-shadow', over === col.value && 'shadow-[inset_0_0_0_2px_var(--sagar)]')}
            >
              <header className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                <span className="inline-block size-2.5 rounded-full" style={{ background: STATUS_COLOR[col.value] }} aria-hidden />
                <h3 className="type-title text-[0.92rem]">{col.label}</h3>
                <span className="num text-[0.82rem] text-ink-3">{num(collapsed ? hiddenDone : items.length)}</span>
              </header>
              {collapsed ? (
                <div className="flex min-h-24 flex-col items-start justify-center gap-2 rounded-[10px] border border-dashed border-line-2 px-3 py-3 text-[0.82rem] text-ink-2">
                  <span>{hiddenDone ? `${num(hiddenDone)} done ${hiddenDone === 1 ? 'task is' : 'tasks are'} hidden.` : 'Nothing done yet.'} Drop a card here to mark it done.</span>
                  {hiddenDone ? (
                    <Button size="sm" variant="ghost" onClick={onShowDone} className="-ml-1">
                      Show done tasks
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="flex min-h-24 flex-col gap-2">
                  {items.map((t) => (
                    <li key={t.id}>
                      <TaskCard
                        task={t}
                        today={today}
                        dragging={dragId === t.id}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(t.id));
                          e.dataTransfer.effectAllowed = 'move';
                          setDragId(t.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOver(null);
                        }}
                        onMove={onMove}
                        onOpen={onOpen}
                        onDelete={onDelete}
                      />
                    </li>
                  ))}
                  {!items.length ? <li className="rounded-[10px] border border-dashed border-line-2 px-3 py-5 text-center text-[0.8rem] text-ink-3">No tasks here</li> : null}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task: t,
  today,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
  onDelete,
}: {
  task: TaskRow;
  today: string;
  dragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onMove: (t: TaskRow, s: TaskStatus) => void;
  onOpen: (t: TaskRow) => void;
  onDelete: (t: TaskRow) => void;
}) {
  const late = overdueDays(t, today);
  const sameYear = t.due_date?.slice(0, 4) === today.slice(0, 4);
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cx(
        'relative cursor-grab rounded-[10px] border bg-surface p-3 shadow-[0_1px_0_var(--line)] transition-colors hover:border-line-2 active:cursor-grabbing',
        late ? 'border-lac/35' : 'border-line',
        dragging && 'opacity-50',
        t.status === 'done' && 'opacity-80',
      )}
    >
      <h4 className="text-[0.88rem] font-semibold leading-snug text-ink">
        <button onClick={() => onOpen(t)} className={cx('text-left hover:underline after:absolute after:inset-0 after:rounded-[10px] after:content-[""]', t.status === 'done' && 'text-ink-2 line-through decoration-ink-3')}>
          {t.title}
        </button>
      </h4>

      <div className="mt-2 space-y-1 text-[0.8rem] text-ink-2">
        {t.campaign_id ? (
          <div className="truncate">
            <CampaignDot id={t.campaign_id}>{t.campaign_name ?? t.campaign_id}</CampaignDot>
          </div>
        ) : null}
        {t.initiative_id ? (
          <div className="flex min-w-0 items-center gap-1.5" title={`2027 bet: ${t.initiative_name ?? t.initiative_id}`}>
            <Flag size={12} className="shrink-0 text-ink-3" aria-hidden />
            <span className="truncate">{t.initiative_name ?? t.initiative_id}</span>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound size={12} className="shrink-0 text-ink-3" aria-hidden />
            <span className="truncate">{t.owner_name ?? 'Unassigned'}</span>
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <CalendarDays size={12} className="shrink-0 text-ink-3" aria-hidden />
            <span className="num">{t.due_date ? `Due ${dateLabel(t.due_date, !sameYear)}` : 'No due date'}</span>
          </span>
        </div>
        {late ? (
          <div className="num text-[0.8rem] font-semibold text-lac">
            Overdue by {num(late)} {late === 1 ? 'day' : 'days'}
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <PriorityChip priority={t.priority} />
        <TaskDecisionChip decision={t.decision} />
        <SourceMark source={t.source} />
      </div>

      <div className="relative z-10 mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
        <StatusSelect task={t} onMove={onMove} />
        <button onClick={() => onDelete(t)} aria-label={`Delete task “${t.title}”`} className="rounded-md p-1.5 text-ink-3 hover:bg-lac-soft hover:text-lac">
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    </article>
  );
}
