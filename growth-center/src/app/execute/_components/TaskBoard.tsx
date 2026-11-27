'use client';
import { useState, type DragEvent } from 'react';
import { FlagDuotone, Trash2Duotone } from 'runeicons-react';
import { campaignColor } from '@/lib/colors';
import { num } from '@/lib/format';
import { Button, cx, Ico } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { LANE, STATUSES, type TaskRow, type TaskStatus } from './model';
import { Avatar, DueChip, PriorityMark, SourceMark, StatusSelect, TaskDecisionChip } from './TaskBits';

/** Same order as the server (due date, undated last, then id), so an optimistic move lands where the refetch will put it. */
const byDue = (a: TaskRow, b: TaskRow) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || a.id - b.id;

/** Tiles shown per lane before "Show more", so one long lane does not set the page's length. */
const LANE_PAGE = 8;

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

/**
 * Four status lanes: hairline trays on the page ground holding limestone task tiles. Drag a tile to another lane,
 * or use the status menu on the tile (the keyboard path to the same move).
 */
export function TaskBoard({ tasks, today, showDone, hiddenDone, onShowDone, onMove, onOpen, onDelete }: BoardProps) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [limit, setLimit] = useState<Record<string, number>>({});

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
      <p className="sr-only">Drag a tile to another lane to change its status, or use the status menu on the tile.</p>
      <div className="grid items-start gap-3 @[34rem]:grid-cols-2 @[52rem]:grid-cols-4">
        {STATUSES.map((col) => {
          const items = tasks.filter((t) => t.status === col.value).sort(byDue);
          const collapsed = col.value === 'done' && !showDone;
          const lane = LANE[col.value];
          const cap = limit[col.value] ?? LANE_PAGE;
          const shown = items.slice(0, cap);
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
              className={cx(
                'flex min-w-0 flex-col rounded-tile-l p-2 transition-[box-shadow,background-color] duration-150',
                over === col.value ? 'bg-stone/60 shadow-[inset_0_0_0_2px_var(--ink)]' : 'shadow-[inset_0_0_0_1.5px_var(--stone-2)]',
              )}
            >
              <header className="flex items-center gap-2.5 px-2 pt-1.5 pb-3">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-icon" style={{ background: lane.bg }}>
                  <Ico icon={lane.icon} size={18} ia={lane.ia} ib={lane.ib} />
                </span>
                <h3 className="text-[15px] leading-none font-[700]">{col.label}</h3>
                <span className="num ml-auto text-[30px] leading-[0.85]">{num(collapsed ? hiddenDone : items.length)}</span>
              </header>
              {collapsed ? (
                <div className="flex min-h-24 flex-col items-start justify-center gap-2 rounded-tile-m border-[1.5px] border-dashed border-stone-3 px-3.5 py-3.5 text-[12.5px] font-[550] text-ink-2">
                  <span>{hiddenDone ? `${num(hiddenDone)} done ${hiddenDone === 1 ? 'task is' : 'tasks are'} hidden.` : 'Nothing done yet.'} Drop a tile here to mark it done.</span>
                  {hiddenDone ? (
                    <Button size="sm" variant="secondary" onClick={onShowDone}>
                      Show done tasks
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul className="flex min-h-24 flex-col gap-2">
                  {shown.map((t) => (
                    <li key={t.id}>
                      <TaskTile
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
                  {!items.length ? <li className="rounded-tile-m border-[1.5px] border-dashed border-stone-3 px-3 py-5 text-center text-[12.5px] font-[550] text-ink-2">No tasks here</li> : null}
                  {items.length > cap ? (
                    <li>
                      <Button size="sm" variant="ghost" className="w-full" onClick={() => setLimit((l) => ({ ...l, [col.value]: cap + 12 }))}>
                        Show {Math.min(12, items.length - cap)} more ({num(items.length - cap)} hidden)
                      </Button>
                    </li>
                  ) : null}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TaskTile({
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
  const done = t.status === 'done';
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cx(
        '@container field-stone relative cursor-grab rounded-tile-m px-2.5 pt-3 pb-2.5 transition-[filter,opacity] duration-150 focus-within:brightness-[0.97] hover:brightness-[0.97] active:cursor-grabbing',
        dragging && 'opacity-50',
      )}
    >
      <h4 className="px-0.5 text-[13.5px] leading-[1.3] font-[650]">
        <button
          type="button"
          onClick={() => onOpen(t)}
          className={cx('text-left after:absolute after:inset-0 after:rounded-tile-m after:content-[""] hover:underline', done && 'text-ink-2 line-through decoration-stone-3')}
        >
          {t.title}
        </button>
      </h4>
      {t.campaign_id ? (
        <div className="mt-1 flex min-w-0 items-center gap-1.5 px-0.5 text-[12px] font-[550] text-ink-2">
          <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(t.campaign_id) }} />
          <span className="truncate">{t.campaign_name ?? t.campaign_id}</span>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
        <DueChip task={t} today={today} />
        <PriorityMark priority={t.priority} />
        <TaskDecisionChip decision={t.decision} className="h-[22px]" />
      </div>

      {/* lifted above the title's full-tile button so the menu, marks and delete stay their own targets */}
      <div className="relative z-[1] mt-2.5 flex items-center gap-1.5 pt-2 shadow-[inset_0_1px_0_var(--stone-2)]">
        <span tabIndex={0} {...tipProps({ title: 'Owner', notes: [t.owner_name ?? 'Unassigned'] })} className="flex min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-full">
          <Avatar name={t.owner_name} />
          <span className="hidden truncate text-[12px] font-[600] text-ink-2 @[15.5rem]:inline">{t.owner_name?.split(' ')[0] ?? 'Unassigned'}</span>
          <span className="sr-only @[15.5rem]:hidden">Owner: {t.owner_name ?? 'Unassigned'}</span>
        </span>
        {t.initiative_id ? (
          <span tabIndex={0} {...tipProps({ title: '2027 bet', notes: [t.initiative_name ?? t.initiative_id] })} className="shrink-0 cursor-default rounded-full">
            <Ico icon={FlagDuotone} size={15} ia="var(--ink-2)" ib="var(--stone-3)" />
            <span className="sr-only">2027 bet: {t.initiative_name ?? t.initiative_id}</span>
          </span>
        ) : null}
        <SourceMark source={t.source} />
        <StatusSelect task={t} onMove={onMove} className="!h-7 w-[5.9rem] shrink-0 !pr-6 !pl-2 !text-[12px]" />
        <button
          type="button"
          onClick={() => onDelete(t)}
          aria-label={`Delete task “${t.title}”`}
          className="grid size-7 shrink-0 place-items-center rounded-full transition-[background-color,transform] duration-150 hover:bg-stone-2 active:scale-[0.95]"
        >
          <Ico icon={Trash2Duotone} size={15} ia="var(--ink-2)" ib="var(--stone-3)" />
        </button>
      </div>
    </article>
  );
}
