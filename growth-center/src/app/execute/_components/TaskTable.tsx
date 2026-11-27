'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDownDuotone, ChevronUpDuotone, FlagDuotone, Trash2Duotone } from 'runeicons-react';
import { CampaignDot } from '@/components/charts';
import { cx, Ico, Table, Td, Th } from '@/components/ui';
import { PRIORITY_RANK, type TaskRow, type TaskStatus } from './model';
import { Avatar, DueChip, PriorityMark, SourceMark, StatusSelect, TaskDecisionChip } from './TaskBits';

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
    <Table className="relative">
      <thead>
        <tr>
          <Th className="min-w-[15rem]">Task</Th>
          <Th>Status</Th>
          <SortTh label="Due date" active={sort.key === 'due'} dir={sort.dir} onClick={() => toggle('due')} hint={sort.dir === 'asc' ? 'earliest first' : 'latest first'} />
          <SortTh label="Priority" active={sort.key === 'priority'} dir={sort.dir} onClick={() => toggle('priority')} hint={sort.dir === 'asc' ? 'highest first' : 'lowest first'} />
          <Th>Owner</Th>
          <Th>Campaign and 2027 bet</Th>
          <Th>Decision</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((t) => (
          <tr key={t.id} className="transition-colors duration-150 hover:bg-stone-2/60">
            <Td>
              <button type="button" onClick={() => onOpen(t)} className={cx('text-left text-[13.5px] font-[650] text-ink hover:underline', t.status === 'done' && 'text-ink-2 line-through decoration-stone-3')}>
                {t.title}
              </button>
              <div className="mt-1">
                <SourceMark source={t.source} label />
              </div>
            </Td>
            <Td>
              <StatusSelect task={t} onMove={onMove} />
            </Td>
            <Td className="whitespace-nowrap">
              <DueChip task={t} today={today} />
            </Td>
            <Td>
              <PriorityMark priority={t.priority} />
            </Td>
            <Td className="whitespace-nowrap">
              <span className="inline-flex items-center gap-2 font-[550] text-ink-2">
                <Avatar name={t.owner_name} />
                {t.owner_name ?? 'Unassigned'}
              </span>
            </Td>
            <Td className="max-w-[13rem]">
              <div className="truncate font-[550]">{t.campaign_id ? <CampaignDot id={t.campaign_id}>{t.campaign_name ?? t.campaign_id}</CampaignDot> : <span className="text-ink-2">No campaign</span>}</div>
              {t.initiative_id ? (
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-2" title={`2027 bet: ${t.initiative_name ?? t.initiative_id}`}>
                  <Ico icon={FlagDuotone} size={13} ia="var(--ink-2)" ib="var(--stone-3)" />
                  <span className="sr-only">2027 bet: </span>
                  <span className="truncate">{t.initiative_name ?? t.initiative_id}</span>
                </div>
              ) : null}
            </Td>
            <Td>{t.decision ? <TaskDecisionChip decision={t.decision} /> : <span className="text-ink-2">None</span>}</Td>
            <Td align="right">
              <button
                type="button"
                onClick={() => onDelete(t)}
                aria-label={`Delete task “${t.title}”`}
                className="grid size-8 place-items-center rounded-full transition-[background-color,transform] duration-150 hover:bg-stone-2 active:scale-[0.95]"
              >
                <Ico icon={Trash2Duotone} size={16} ia="var(--ink-2)" ib="var(--stone-3)" />
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function SortTh({ label, active, dir, onClick, hint }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; hint: string }): ReactNode {
  return (
    <th aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="border-b-[1.5px] border-stone-3 px-2.5 py-2 text-left text-[12.5px] font-[600] whitespace-nowrap text-ink-2">
      <button type="button" onClick={onClick} className={cx('-mx-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors duration-150 hover:bg-stone-2 hover:text-ink', active && 'text-ink')} title={active ? `Sorted ${hint}` : `Sort by ${label.toLowerCase()}`}>
        {label}
        {active ? <Ico icon={dir === 'asc' ? ChevronUpDuotone : ChevronDownDuotone} size={14} ia="currentColor" ib="currentColor" /> : <span className="inline-block w-[14px]" aria-hidden />}
      </button>
    </th>
  );
}
