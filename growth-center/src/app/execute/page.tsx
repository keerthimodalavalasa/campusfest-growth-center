'use client';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { mutate, useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { dateLabel, num, todayIST } from '@/lib/format';
import { Button, EmptyState, ErrorNote, PageHeader, Panel, Skeleton, Tabs } from '@/components/ui';
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

  const lede = (
    <>
      <span className="num font-semibold text-ink">{num(open.length)}</span> open {open.length === 1 ? 'task' : 'tasks'},{' '}
      <span className="num font-semibold" style={{ color: overdue ? 'var(--lac)' : undefined }}>
        {num(overdue)}
      </span>{' '}
      overdue and <span className="num font-semibold text-ink">{num(blocked)}</span> blocked. Due dates count from today in IST ({dateLabel(today, true)}); the as-of date only changes the spend column.
    </>
  );

  return (
    <div className="@container space-y-6">
      <PageHeader
        title="Run the work"
        lede={lede}
        actions={
          <Button variant="secondary" icon={<Sparkles size={15} aria-hidden className="text-lac" />} onClick={askForTasks}>
            Ask the copilot for this week&apos;s tasks
          </Button>
        }
      />

      <section aria-labelledby="workload-h">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="workload-h" className="type-title text-[1.02rem]">
            Team workload
          </h2>
          <span className="text-[0.8rem] text-ink-3">{all.length ? 'Open tasks per owner. Select an owner to filter the board.' : 'Open tasks per owner. Nobody has any yet.'}</span>
        </div>
        <Workload tasks={all} team={meta.team} today={today} selected={filters.owner} onSelect={all.length ? (owner) => setFilters((f) => ({ ...f, owner })) : undefined} />
      </section>

      <div className="grid gap-5 @[72rem]:grid-cols-[minmax(0,1fr)_21rem]">
        <section aria-labelledby="tasks-h" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="tasks-h" className="type-title text-[1.02rem]">
              Tasks
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs<View>
                value={view}
                onChange={setView}
                options={[
                  { value: 'board', label: 'Board' },
                  { value: 'table', label: 'Table' },
                ]}
              />
              <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={newTask}>
                New task
              </Button>
            </div>
          </div>

          {all.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)]">
                <MiniSelect aria-label="Filter by owner" value={filters.owner} onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))} className="h-8 text-[0.82rem]">
                  <option value="">All owners</option>
                  {meta.team.map((m) => (
                    <option key={m.ownerId} value={m.ownerId}>
                      {m.ownerName}
                    </option>
                  ))}
                  <option value={NONE}>Unassigned</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by campaign" value={filters.campaign} onChange={(e) => setFilters((f) => ({ ...f, campaign: e.target.value }))} className="h-8 text-[0.82rem]">
                  <option value="">All campaigns</option>
                  {meta.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value={NONE}>No campaign</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by 2027 bet" value={filters.initiative} onChange={(e) => setFilters((f) => ({ ...f, initiative: e.target.value }))} className="h-8 max-w-[14rem] text-[0.82rem]">
                  <option value="">All 2027 bets</option>
                  {initiatives.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                  <option value={NONE}>No 2027 bet</option>
                </MiniSelect>
                <MiniSelect aria-label="Filter by source" value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} className="h-8 text-[0.82rem]">
                  <option value="">All sources</option>
                  {SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </MiniSelect>
                <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-2 text-[0.82rem] text-ink-2">
                  <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="size-4 accent-[var(--ink)]" />
                  Show done
                </label>
                {anyFilter ? (
                  <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                    Clear filters
                  </Button>
                ) : null}
                <span className="num ml-auto text-[0.8rem] text-ink-3">
                  {num(visible.length)} of {num(all.length)} shown
                </span>
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
                <TaskTable tasks={visible} today={today} onMove={move} onOpen={editTask} onDelete={setDeleting} />
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
                  <Button variant="primary" icon={<Plus size={15} aria-hidden />} onClick={newTask}>
                    Create the first task
                  </Button>
                  <Button variant="secondary" icon={<Sparkles size={15} aria-hidden className="text-lac" />} onClick={askForTasks}>
                    Ask the copilot to draft tasks
                  </Button>
                </div>
              }
            >
              Turn a call from Decide or a signal from Diagnose into a task with an owner and a due date, or let the copilot propose this week&apos;s work for you to approve.
            </EmptyState>
          )}
        </section>

        <Panel title="Activity" aside={changesQ.data ? `${num(changesQ.data.changes.length)} most recent changes` : null} className="min-w-0 self-start @[72rem]:sticky @[72rem]:top-24">
          {changesQ.error && !changesQ.data ? (
            <ErrorNote onRetry={changesQ.refresh}>Could not load the change log: {changesQ.error}</ErrorNote>
          ) : changesQ.data ? (
            <ActivityFeed changes={changesQ.data.changes} tasks={tasksQ.data.tasks} initiatives={initQ.data?.initiatives ?? []} compact={!all.length} />
          ) : (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Campaigns" aside={`${num(meta.campaigns.length)} campaigns, ${num(meta.campaigns.filter((c) => c.origin === 'app').length)} added in app`}>
        {campsQ.error ? (
          <div className="mb-3">
            <ErrorNote onRetry={campsQ.refresh}>Could not load campaign spend: {campsQ.error}</ErrorNote>
          </div>
        ) : null}
        <CampaignManager campaigns={meta.campaigns} team={meta.team} asOf={asOf} spend={spend} changes={changesQ.data?.changes ?? null} historyStart={meta.event.historyStart ?? null} />
      </Panel>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} initiatives={initiatives} />
      <DeleteTaskDialog task={deleting} onClose={() => setDeleting(null)} onDeleted={(id) => setRemoved((r) => new Set([...r, id]))} />
    </div>
  );
}

function ExecuteSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-96" />
      <Skeleton className="h-28" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
