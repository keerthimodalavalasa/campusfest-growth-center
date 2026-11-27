'use client';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { CalendarDuotone, ClipboardListDuotone, ClockAlertDuotone, HistoryDuotone, KanbanDuotone, MessageSquareTextDuotone, PlusDuotone } from 'runeicons-react';
import { toast } from 'sonner';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { mutate, useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { addDays, dateLabel, num, todayIST } from '@/lib/format';
import { Button, EmptyState, ErrorNote, Ico, PageHeader, Segmented, Skeleton, Tile, TileHead } from '@/components/ui';
import { GroupHead, MetricTile } from '@/components/tiles';
import { CountUp, MiniBars, Ring } from '@/components/viz';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { overdueDays, SOURCES, STATUS_LABEL, type ChangeRow, type InitiativeLite, type TaskRow, type TaskStatus } from './_components/model';
import { DeleteTaskDialog, MiniSelect } from './_components/TaskBits';
import { TaskBoard } from './_components/TaskBoard';
import { TaskTable } from './_components/TaskTable';
import { Workload } from './_components/Workload';
import { CampaignManager } from './_components/CampaignManager';
import { ActivityFeed } from './_components/ActivityFeed';

type View = 'board' | 'table';
interface Filters {
  owner: string;
  campaign: string;
  initiative: string;
  source: string;
}
const NO_FILTERS: Filters = { owner: '', campaign: '', initiative: '', source: '' };
const NONE = '__none';

/** Filter value matches: '' = any, '__none' = not set, otherwise the exact id. */
const noSubscribe = () => () => {};

const matches = (f: string, v: string | null) => !f || (f === NONE ? !v : v === f);

export default function ExecutePage() {
  const { meta, asOf, askCopilot } = useApp();
  const tasksQ = useApi<{ tasks: TaskRow[] }>('/api/tasks');
  const initQ = useApi<{ initiatives: InitiativeLite[] }>('/api/initiatives');
  const changesQ = useApi<{ changes: ChangeRow[] }>('/api/changes');
  const campsQ = useApi<{ campaigns: CampaignMetrics[] }>(useAsOfUrl('/api/campaigns'));

  const [view, setView] = useState<View>('board');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [deleting, setDeleting] = useState<TaskRow | null>(null);
  // today's date comes from the client only: reading the clock during the server prerender is not allowed in this Next version
  const today = useSyncExternalStore(noSubscribe, todayIST, () => null);

  /* ---------------------------------------------------------- optimistic moves */
  const [overrides, setOverrides] = useState<Record<number, { status: TaskStatus; seq: number; settled: boolean }>>({});
  const seq = useRef(0);
  // deleted tasks disappear at once, before the refetch confirms it
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());

  // when fresh server data arrives, it becomes the source of truth again for confirmed moves and deletes
  const [seenData, setSeenData] = useState(tasksQ.data);
  if (seenData !== tasksQ.data) {
    setSeenData(tasksQ.data);
    const ids = new Set((tasksQ.data?.tasks ?? []).map((t) => t.id));
    setOverrides((o) => {
      const keep = Object.fromEntries(Object.entries(o).filter(([, v]) => !v.settled));
      return Object.keys(keep).length === Object.keys(o).length ? o : keep;
    });
    setRemoved((r) => (r.size && [...r].some((id) => !ids.has(id)) ? new Set([...r].filter((id) => ids.has(id))) : r));
  }

  const move = useCallback(async (t: TaskRow, status: TaskStatus) => {
    if (t.status === status) return;
    const my = ++seq.current;
    setOverrides((o) => ({ ...o, [t.id]: { status, seq: my, settled: false } }));
    try {
      await mutate(`/api/tasks/${t.id}`, 'PATCH', { status });
      setOverrides((o) => (o[t.id]?.seq === my ? { ...o, [t.id]: { ...o[t.id], settled: true } } : o));
      toast.success(`Moved to ${STATUS_LABEL[status]}`, { description: t.title });
    } catch (e) {
      setOverrides((o) => {
        if (o[t.id]?.seq !== my) return o;
        const n = { ...o };
        delete n[t.id];
        return n;
      });
      toast.error(`Could not move “${t.title}”: ${(e as Error).message}. It stays where it was; try again.`);
    }
  }, []);

  const all = useMemo(() => (tasksQ.data?.tasks ?? []).filter((t) => !removed.has(t.id)).map((t) => (overrides[t.id] ? { ...t, status: overrides[t.id].status } : t)), [tasksQ.data, overrides, removed]);
  const filtered = useMemo(() => all.filter((t) => matches(filters.owner, t.owner_id) && matches(filters.campaign, t.campaign_id) && matches(filters.initiative, t.initiative_id) && (!filters.source || t.source === filters.source)), [all, filters]);
  const visible = showDone ? filtered : filtered.filter((t) => t.status !== 'done');
  const hiddenDone = showDone ? 0 : filtered.length - visible.length;

  const initiatives = useMemo(() => (initQ.data?.initiatives ?? []).map((i) => ({ id: i.id, name: i.name })), [initQ.data]);
  const spend = useMemo(() => (campsQ.data ? new Map(campsQ.data.campaigns.map((c) => [c.campaignId, c.spend])) : null), [campsQ.data]);

  const open = all.filter((t) => t.status !== 'done');
  const overdue = today ? open.filter((t) => overdueDays(t, today) > 0).length : 0;
  const blocked = open.filter((t) => t.status === 'blocked').length;
  const anyFilter = Object.values(filters).some(Boolean);

  const newTask = () =>
    setDraft({
      owner_id: filters.owner && filters.owner !== NONE ? filters.owner : null,
      campaign_id: filters.campaign && filters.campaign !== NONE ? filters.campaign : null,
      initiative_id: filters.initiative && filters.initiative !== NONE ? filters.initiative : null,
      source: 'manual',
    });
  const editTask = (t: TaskRow) =>
    setDraft({ id: t.id, title: t.title, description: t.description, campaign_id: t.campaign_id, initiative_id: t.initiative_id, owner_id: t.owner_id, due_date: t.due_date, status: t.status, priority: t.priority, decision: t.decision, evidence: t.evidence, source: t.source });
  const askForTasks = () =>
    askCopilot(`Draft the three to five most important tasks for this week from the current decisions and signals${asOf ? ` as of ${asOf}` : ''}. For each, give an owner, a due date, a priority and the evidence, and propose them as tasks I can approve.`);

  if (tasksQ.error && !tasksQ.data) return <ErrorNote onRetry={tasksQ.refresh}>Could not load tasks: {tasksQ.error}</ErrorNote>;
  if (!tasksQ.data || !meta || !today) return <ExecuteSkeleton />;

  // header-row figures
  const done = all.length - open.length;
  const inProgress = open.filter((t) => t.status === 'in_progress').length;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const dueByDay = days.map((d) => open.filter((t) => t.due_date === d).length);
  const dueSoon = dueByDay.reduce((s, n) => s + n, 0);
  const oldestLate = Math.max(0, ...open.map((t) => overdueDays(t, today)));

  const newTaskButton = (
    <Button variant="primary" icon={<Ico icon={PlusDuotone} size={16} ia="#fff" ib="rgba(255,255,255,0.5)" />} onClick={newTask}>
      New task
    </Button>
  );
  const askButton = (
    <Button variant="secondary" icon={<Ico icon={MessageSquareTextDuotone} size={18} ia="var(--lac)" ib="var(--lac-pale)" />} onClick={askForTasks}>
      Draft this week&apos;s tasks
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Run the work"
        lede={
          <>
            Due dates count from today, <b className="font-[650] text-ink">{dateLabel(today, true)}</b> in IST. The as-of date only changes spend.
          </>
        }
        actions={
          <>
            {askButton}
            {newTaskButton}
          </>
        }
      />

      {/* header row: limestone only (tasks are not a metric family), each with its micro-visual */}
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricTile
          icon={ClipboardListDuotone}
          ia="var(--ink)"
          ib="var(--stone-3)"
          title="Open tasks"
          label="Open tasks"
          delay={0}
          className="min-h-[180px]"
          viz={<Ring value={all.length ? done / all.length : 0} track="var(--stone-2)" arc="var(--ink)" ink="var(--ink)" label={`${all.length ? Math.round((done / all.length) * 100) : 0}% of all tasks done`} />}
          value={<CountUp value={open.length} format={num} />}
          sub={`of ${num(all.length)} tasks, ${num(done)} done`}
          foot={
            <span className="tab whitespace-nowrap">
              {num(inProgress)} in progress, {num(blocked)} blocked
            </span>
          }
        />
        <MetricTile
          icon={CalendarDuotone}
          ia="var(--ink)"
          ib="var(--stone-3)"
          title="Due in the next 14 days"
          label="Open tasks due in the next 14 days"
          delay={40}
          className="min-h-[180px]"
          wideViz
          vizClass="!h-[40px] !w-[92px] max-[720px]:!h-[40px] max-[720px]:!w-[92px]"
          viz={
            // a baseline, so days with nothing due still read as days
            <div className="border-b-[1.5px] border-stone-3">
              <MiniBars values={dueByDay} color="var(--ink)" width={92} height={38} gap={2} label={`Open tasks due each day for 14 days from ${dateLabel(today)}`} />
            </div>
          }
          value={<CountUp value={dueSoon} format={num} />}
          sub={`${dateLabel(today)} to ${dateLabel(days[13])}`}
          foot={
            overdue ? (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Ico icon={ClockAlertDuotone} size={16} ia="var(--ink)" ib="var(--stone-3)" />
                <span className="tab">
                  {num(overdue)} overdue, oldest {num(oldestLate)} {oldestLate === 1 ? 'day' : 'days'}
                </span>
              </span>
            ) : (
              <span className="text-ink-2">Nothing overdue</span>
            )
          }
        />
        <Workload
          tasks={all}
          team={meta.team}
          today={today}
          selected={filters.owner}
          onSelect={all.length ? (owner) => setFilters((f) => ({ ...f, owner })) : undefined}
          delay={80}
          className="col-span-2 max-[560px]:col-span-1"
        />
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-3 max-[1200px]:grid-cols-1">
        <section aria-labelledby="tasks-h" className="min-w-0">
          <GroupHead icon={KanbanDuotone} title={<span id="tasks-h">Tasks</span>} delay={120} aside={all.length ? <span className="tab">{num(visible.length)} of {num(all.length)} shown</span> : null}>
            <Segmented<View>
              label="Show tasks as"
              value={view}
              onChange={setView}
              className="bg-stone"
              options={[
                { value: 'board', label: 'Board' },
                { value: 'table', label: 'Table' },
              ]}
            />
          </GroupHead>

          {all.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
                <MiniSelect aria-label="Filter by owner" value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}>
                  <option value="">All owners</option>
                  {meta.team.map((m) => (
                    <option key={m.ownerId} value={m.ownerId}>
                      {m.ownerName}
                    </option>
                  ))}
                  <option value={NONE}>Unassigned</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by campaign" value={filters.campaign} onChange={(e) => setFilters((f) => ({ ...f, campaign: e.target.value }))}>
                  <option value="">All campaigns</option>
                  {meta.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={NONE}>No campaign</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by 2027 bet" value={filters.initiative} onChange={(e) => setFilters((f) => ({ ...f, initiative: e.target.value }))} className="max-w-[14rem]">
                  <option value="">All 2027 bets</option>
                  {initiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                  <option value={NONE}>No 2027 bet</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by source" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
                  <option value="">All sources</option>
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </MiniSelect>
                <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-2 text-[12.5px] font-[600] text-ink-2">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--ink)]" />
                  Show done
                </label>
                {anyFilter ? (
                  <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
              {tasksQ.error ? (
                <div className="mb-3">
                  <ErrorNote onRetry={tasksQ.refresh}>Could not refresh tasks: {tasksQ.error}</ErrorNote>
                </div>
              ) : null}
              {initQ.error ? (
                <div className="mb-3">
                  <ErrorNote onRetry={initQ.refresh}>Could not load the 2027 bets, so the bet filter and the task form list none: {initQ.error}</ErrorNote>
                </div>
              ) : null}
              {!filtered.length ? (
                <EmptyState
                  title="No tasks match these filters"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setFilters(NO_FILTERS)}>
                      Clear filters
                    </Button>
                  }
                >
                  {num(all.length)} tasks exist in total.
                </EmptyState>
              ) : view === 'board' ? (
                <TaskBoard tasks={filtered} today={today} showDone={showDone} hiddenDone={hiddenDone} onShowDone={() => setShowDone(true)} onMove={move} onOpen={editTask} onDelete={setDeleting} />
              ) : visible.length ? (
                <Tile field="stone" className="anim-settle">
                  <TaskTable tasks={visible} today={today} onMove={move} onOpen={editTask} onDelete={setDeleting} />
                </Tile>
              ) : (
                <EmptyState
                  title="Every matching task is done"
                  action={
                    <Button size="sm" variant="secondary" onClick={() => setShowDone(true)}>
                      Show done tasks
                    </Button>
                  }
                />
              )}
            </>
          ) : (
            <EmptyState
              title="No tasks yet"
              action={
                <div className="mt-1 flex flex-wrap gap-2">
                  {newTaskButton}
                  {askButton}
                </div>
              }
            >
              Turn a call from Decide or a signal from Diagnose into a task with an owner and a due date, or let the copilot propose this week&apos;s work for you to approve.
            </EmptyState>
          )}
        </section>

        <Tile field="stone" delay={160} className="min-w-0 self-start min-[1200px]:sticky min-[1200px]:top-24" aria-label="Activity">
          <TileHead icon={HistoryDuotone} aside={changesQ.data ? `${num(changesQ.data.changes.length)} recent changes` : null}>
            Activity
          </TileHead>
          {changesQ.error && !changesQ.data ? (
            <div className="mt-3">
              <ErrorNote onRetry={changesQ.refresh}>Could not load the change log: {changesQ.error}</ErrorNote>
            </div>
          ) : changesQ.data ? (
            <ActivityFeed changes={changesQ.data.changes} tasks={tasksQ.data.tasks} initiatives={initQ.data?.initiatives ?? []} compact={!all.length} />
          ) : (
            <div className="mt-3 space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </Tile>
      </div>

      <div className="mt-3">
        <CampaignManager
          delay={200}
          campaigns={meta.campaigns}
          team={meta.team}
          asOf={asOf}
          spend={spend}
          changes={changesQ.data?.changes ?? null}
          historyStart={meta.event.historyStart ?? null}
          spendError={campsQ.error}
          onRetrySpend={campsQ.refresh}
        />
      </div>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} initiatives={initiatives} />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => setRemoved((r) => new Set([...r, id]))} />
    </div>
  );
}

function ExecuteSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
      <Skeleton className="mb-2 h-12 w-96 max-w-full bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        <Skeleton className="h-[220px] rounded-tile-s bg-stone" />
        <Skeleton className="h-[220px] rounded-tile-s bg-stone" />
        <Skeleton className="col-span-2 h-[220px] rounded-tile-s bg-stone max-[560px]:col-span-1" />
      </div>
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72 rounded-tile-l bg-stone" />
        ))}
      </div>
    </div>
  );
}
