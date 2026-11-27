'use client';
import type { CSSProperties } from 'react';
import { UsersDuotone } from 'runeicons-react';
import { num } from '@/lib/format';
import type { TeamMember } from '@/lib/app-state';
import { cx, Tile, TileHead } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { overdueDays, type TaskRow } from './model';
import { Avatar } from './TaskBits';

interface Load {
  id: string;
  name: string;
  role: string | null;
  open: number;
  overdue: number;
  high: number;
}

/**
 * Open work per owner as bars on one scale (the busiest owner is the full width): the solid ink part is overdue,
 * the limestone part is on time. Each row is a button that filters the board to that owner.
 */
export function Workload({ tasks, team, today, selected, onSelect, delay = 0, className }: { tasks: TaskRow[]; team: TeamMember[]; today: string; selected: string; onSelect?: (ownerId: string) => void; delay?: number; className?: string }) {
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
    <Tile field="stone" size="s" delay={delay} className={cx('flex flex-col', className)} aria-label="Team workload">
      <TileHead
        icon={UsersDuotone}
        aside={
          <span className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="block h-2.5 w-3.5 rounded-full bg-ink" />
              Overdue
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden className="block h-2.5 w-3.5 rounded-full bg-stone-3" />
              On time
            </span>
          </span>
        }
      >
        Team workload
      </TileHead>
      <ul className="mt-2.5 grid gap-px" aria-label={onSelect ? 'Open tasks per owner; select an owner to filter the board' : 'Open tasks per owner'}>
        {rows.map((r, i) => {
          const on = selected === r.id;
          const body = (
            <>
              <Avatar name={r.id === '__none' ? null : r.name} inverse={on} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-[1.2] font-[650]">{r.name}</span>
                <span className={cx('block truncate text-[11.5px] leading-[1.25] font-[550]', on ? 'text-silver' : 'text-ink-2')}>{r.role ?? 'No role set'}</span>
              </span>
              <span className={cx('relative h-2.5 rounded-full', on ? 'bg-bidri-3' : 'bg-stone-2')} aria-hidden>
                <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-full bg-stone-3" style={{ width: `${(r.open / max) * 100}%`, '--d': `${delay + 120 + i * 40}ms` } as CSSProperties} />
                {r.overdue ? <i className={cx('anim-grow-x absolute inset-y-0 left-0 block rounded-full', on ? 'bg-white' : 'bg-ink')} style={{ width: `${(r.overdue / max) * 100}%`, '--d': `${delay + 160 + i * 40}ms` } as CSSProperties} /> : null}
              </span>
              <span className="tab text-right text-[12px] leading-[1.2] font-[600] whitespace-nowrap">
                <b className="text-[14px] font-[750]">{num(r.open)}</b> open
                <span className={cx('block text-[11.5px] font-[550]', on ? 'text-silver' : 'text-ink-2')}>{r.overdue ? `${num(r.overdue)} late` : 'none late'}</span>
              </span>
            </>
          );
          const cls = 'grid w-full grid-cols-[22px_minmax(0,9rem)_minmax(0,1fr)_4.25rem] items-center gap-x-2.5 rounded-[12px] px-2 py-[5px] text-left max-[420px]:grid-cols-[22px_minmax(0,6.5rem)_minmax(0,1fr)_4rem]';
          const tip = tipProps({
            title: r.name,
            rows: [
              { label: 'Open', value: num(r.open) },
              { color: 'var(--ink)', label: 'Overdue', value: num(r.overdue), swatch: 'square' },
              { label: 'High priority', value: num(r.high) },
            ],
          });
          return (
            <li key={r.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(on ? '' : r.id)}
                  aria-pressed={on}
                  aria-label={`${r.name}: ${r.open} open, ${r.overdue} overdue. ${on ? 'Show every owner' : `Show only ${r.name}'s tasks`}`}
                  {...tip}
                  className={cx(cls, 'transition-colors duration-150', on ? 'bg-ink text-white' : 'hover:bg-stone-2')}
                >
                  {body}
                </button>
              ) : (
                // with no tasks there is nothing to filter, so the rows are plain figures rather than buttons
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}
