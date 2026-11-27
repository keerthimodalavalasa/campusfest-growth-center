'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Flag, Trash2 } from 'lucide-react';
import { dateLabel, num } from '@/lib/format';
import { CampaignDot } from '@/components/charts';
import { cx, Table, Td, Th } from '@/components/ui';
import { overdueDays, PRIORITY_RANK, type TaskRow, type TaskStatus } from './model';
import { PriorityChip, SourceMark, StatusSelect, TaskDecisionChip } from './TaskBits';

type SortKey = 'due' | 'priority';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };

const STATUS_RANK: Record<string, number> = { blocked: 0, in_progress: 1, todo: 2, done: 3 };

export function TaskTable({ tasks, today, onMove, onOpen, onDelete }: { tasks: TaskRow[]; today: string; onMove: (t: TaskRow, s: TaskStatus) => void; onOpen: (t: TaskRow) => void; onDelete: (t: TaskRow) => void }) {
  const [sort, setSort] = useState<Sort>({ key: 'due', dir: 'asc' });

  const rows = useMemo(() => {
    const due = (t: TaskRow) => (t.due_date ? Date.parse(`${t.due_date}T00:00:00Z`) : null);
    const out = [...tasks];
    out.sort((a, b) => {
      let c = 0;
      if (sort.key === 'due') {
        const da = due(a);
        const db = due(b);
        // tasks without a due date always sort last, whatever the direction
        if (da == null || db == null) return da == null && db == null ? a.id - b.id : da == null ? 1 : -1;
        c = da - db;
        if (c === 0) c = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
      } else {
        c = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
        if (c === 0) c = (due(a) ?? Infinity) - (due(b) ?? Infinity);
      }
      if (c === 0) c = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.id - b.id;
      return sort.dir === 'asc' ? c : -c;
    });
    return out;
  }, [tasks, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    // `relative` keeps the visually hidden header text inside the scroll container (otherwise it widens the page)
    <Table className="relative rounded-[var(--radius-panel)] border border-line bg-surface">
      <thead>
        <tr>
          <Th className="min-w-[15rem] text-left">Task</Th>
          <Th className="text-left">Status</Th>
          <SortTh label="Due date" active={sort.key === 'due'} dir={sort.dir} onClick={() => toggle('due')} hint={sort.dir === 'asc' ? 'earliest first' : 'latest first'} />
          <SortTh label="Priority" active={sort.key === 'priority'} dir={sort.dir} onClick={() => toggle('priority')} hint={sort.dir === 'asc' ? 'highest first' : 'lowest first'} />
          <Th className="text-left">Owner</Th>
          <Th className="text-left">Campaign and 2027 bet</Th>
          <Th className="text-left">Decision</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => {
          const late = overdueDays(t, today);
          return (
            <tr key={t.id} className="hover:bg-paper">
              <Td>
                <button onClick={() => onOpen(t)} className={cx('text-left font-medium text-ink hover:underline', t.status === 'done' && 'text-ink-2 line-through decoration-ink-3')}>
                  {t.title}
                </button>
                <div className="mt-0.5">
                  <SourceMark source={t.source} />
                </div>
              </Td>
              <Td>
                <StatusSelect task={t} onMove={onMove} />
              </Td>
              <Td className="whitespace-nowrap">
                <span className="num">{t.due_date ? dateLabel(t.due_date, t.due_date.slice(0, 4) !== today.slice(0, 4)) : 'No due date'}</span>
                {late ? (
                  <div className="num text-[0.78rem] font-semibold text-lac">
                    Overdue by {num(late)} {late === 1 ? 'day' : 'days'}
                  </div>
                ) : null}
              </Td>
              <Td>
                <PriorityChip priority={t.priority} />
              </Td>
              <Td className="whitespace-nowrap text-ink-2">{t.owner_name ?? 'Unassigned'}</Td>
              <Td className="max-w-[13rem]">
                <div className="truncate">{t.campaign_id ? <CampaignDot id={t.campaign_id}>{t.campaign_name ?? t.campaign_id}</CampaignDot> : <span className="text-ink-3">No campaign</span>}</div>
                {t.initiative_id ? (
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.8rem] text-ink-2" title={`2027 bet: ${t.initiative_name ?? t.initiative_id}`}>
                    <Flag size={12} className="shrink-0 text-ink-3" aria-label="2027 bet" />
                    <span className="truncate">{t.initiative_name ?? t.initiative_id}</span>
                  </div>
                ) : null}
              </Td>
              <Td>
                {t.decision ? <TaskDecisionChip decision={t.decision} /> : <span className="text-ink-3">None</span>}
              </Td>
              <Td align="right" className="font-sans">
                <button onClick={() => onDelete(t)} aria-label={`Delete task “${t.title}”`} className="rounded-md p-1.5 text-ink-3 hover:bg-lac-soft hover:text-lac">
                  <Trash2 size={14} aria-hidden />
                </button>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function SortTh({ label, active, dir, onClick, hint }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; hint: string }): ReactNode {
  const Icon = dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="type-condensed whitespace-nowrap border-b border-line-2 px-2.5 py-2 text-left text-[0.8rem] font-semibold text-ink-2">
      <button onClick={onClick} className={cx('inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-paper-2 hover:text-ink', active && 'text-ink')} title={active ? `Sorted ${hint}` : `Sort by ${label.toLowerCase()}`}>
        {label}
        {active ? <Icon size={13} aria-hidden /> : <span className="inline-block w-[13px]" aria-hidden />}
      </button>
    </th>
  );
}
