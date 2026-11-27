'use client';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { DECISION } from '@/lib/colors';
import { dateLabel, pct } from '@/lib/format';
import { Button, EmptyState, ErrorNote, PageHeader, Skeleton } from '@/components/ui';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { AssumptionsPanel, type SettingRow } from './_components/AssumptionsPanel';
import { BudgetSimulator } from './_components/BudgetSimulator';
import { DecisionBoard } from './_components/DecisionBoard';
import { RulesPanel } from './_components/RulesPanel';
import { COLUMNS, isPost, perUnit, tidy, type DecideResponse } from './_components/types';

export default function DecidePage() {
  const { askCopilot } = useApp();
  const q = useApi<DecideResponse>(useAsOfUrl('/api/decide'));
  // fetched alongside the board rather than after it, so the assumptions panel is not a second wait
  const settingsQ = useApi<{ settings: SettingRow[] }>('/api/settings');
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  if (q.error && !q.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Scale, keep, change or stop" />
        <ErrorNote onRetry={q.refresh}>Could not load the decision board: {q.error}</ErrorNote>
      </div>
    );
  }
  if (!q.data) return <DecideSkeleton />;
  const d = q.data;
  const post = isPost(d.phase);
  const median = d.recommendations.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const counts = COLUMNS.map((c) => ({ c, n: d.recommendations.filter((r) => r.decision === c).length }));

  const lede =
    d.phase === 'pre-launch' ? (
      <>The campaign had not started on {dateLabel(d.asOf, true)}, so there is nothing to decide yet.</>
    ) : (
      <>
        Rule-based calls on {post ? 'actual verified attendance' : `expected visitors (confirmed × ${pct(d.settings.showRateAssumption)} show-rate assumption)`} as of {dateLabel(d.asOf, true)}:{' '}
        {counts.map(({ c, n }, i) => (
          <span key={c}>
            <span className="num font-semibold" style={{ color: DECISION[c].fg }}>
              {n}
            </span>{' '}
            {DECISION[c].label.toLowerCase()}
            {i < counts.length - 1 ? ', ' : '.'}
          </span>
        ))}{' '}
        Every call shows the checks behind it.
      </>
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Scale, keep, change or stop"
        lede={lede}
        actions={
          <Button variant="secondary" onClick={() => askCopilot(`Challenge the scale, keep, change and stop calls as of ${d.asOf}. Which call is least robust to the assumptions (show-rate, thresholds, attribution), and what evidence would change it?`)}>
            Ask the copilot to challenge the calls
          </Button>
        }
      />
      {q.error ? <ErrorNote onRetry={q.refresh}>Could not refresh the board: {q.error}. Showing the last loaded data.</ErrorNote> : null}

      {d.recommendations.length ? (
        <>
          <RulesPanel data={d} />
          <DecisionBoard data={d} onCreateTask={setDraft} />
        </>
      ) : (
        <EmptyState title="No campaign has activity at this date">Move the date on the tape forward to a day after launch to see the calls and the simulator.</EmptyState>
      )}

      {d.recommendations.length ? <BudgetSimulator data={d} onCreateTask={setDraft} /> : null}
      <AssumptionsPanel q={settingsQ} median={median} perUnit={perUnit(d.phase)} asOf={d.asOf} />

      <footer className="border-t border-line pt-4">
        <h2 className="text-[0.85rem] font-semibold text-ink-2">Notes on these calls</h2>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.82rem] text-ink-3 marker:text-line-2">
          {d.notes.map((n) => (
            <li key={n}>{tidy(n)}</li>
          ))}
        </ul>
      </footer>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function DecideSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-96 max-w-full" />
      <Skeleton className="h-64" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
