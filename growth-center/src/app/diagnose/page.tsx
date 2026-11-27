'use client';
import { useState, type ReactNode } from 'react';
import type { Diagnosis } from '@/server/engine/diagnose';
import type { Snapshot } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { dateLabel, num, pct } from '@/lib/format';
import { Button, cx, EmptyState, ErrorNote, PageHeader, Panel, Skeleton, Table, Td, Th } from '@/components/ui';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { BottleneckHeatmap } from './_components/BottleneckHeatmap';
import { BottleneckList, SignalGroups } from './_components/Findings';
import { ShowUpDrivers } from './_components/ShowUpDrivers';
import { WeekDrivers } from './_components/WeekDrivers';
import { NEUTRAL_PTS, shownGap, tidy, windowLabel } from './_components/text';

const PHASE: Record<Snapshot['phase'], string> = {
  'pre-launch': 'before launch',
  campaign: 'campaign running',
  event: 'event days',
  'post-event': 'after the event',
};

/** Engine names for the people stages in `biggestDrop`, mapped to funnel rows. */
const DROP_STAGE: Record<string, string> = {
  Identified: 'Identified external people',
  Registered: 'Registered',
  Confirmed: 'Confirmed',
  'Attended (registered)': 'Verified visitors',
};

export default function DiagnosePage() {
  const { askCopilot, meta, setAsOf } = useApp();
  const q = useApi<Diagnosis>(useAsOfUrl('/api/diagnose'));
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  if (q.error) return <ErrorNote onRetry={q.refresh}>Could not load the diagnosis: {q.error}</ErrorNote>;
  if (!q.data) return <DiagnoseSkeleton />;
  const d = q.data;
  const post = d.phase === 'event' || d.phase === 'post-event';
  const showRateAssumption = typeof meta?.settings.showRateAssumption === 'number' ? meta.settings.showRateAssumption : null;
  const eventDate = meta ? new Date(meta.event.startsAt + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Where we lose people"
        lede={
          <>
            As of <span className="font-semibold text-ink">{dateLabel(d.asOf, true)}</span>, {PHASE[d.phase]}. Each campaign&apos;s stage conversion against the portfolio, what moved registrations this week{post ? ', and what goes with showing up' : ''}. Findings are associations in the data, not proven causes.
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => askCopilot(`Diagnose the funnel as of ${d.asOf}: where we lose the most people, which campaign bottleneck matters most in visitors, and what changed week over week. Keep what the data shows separate from hypotheses about causes.`)}>
            Ask the copilot for a diagnosis
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Panel title="Biggest drop in the people funnel" aside={`as of ${dateLabel(d.asOf, true)}`}>
          <BiggestDrop d={d} />
          <FunnelTable d={d} post={post} showRateAssumption={showRateAssumption} />
        </Panel>
        <Panel title="Stage gaps by campaign" aside={d.allStageGaps.length ? `${d.allStageGaps.filter((g) => Math.abs(shownGap(g.gapPts)) >= NEUTRAL_PTS && g.gapPts < 0).length} cells 1+ pts worse` : undefined}>
          <p className="mb-3 text-[0.82rem] text-ink-3">Campaign conversion at each stage minus the portfolio rate for the same stage.</p>
          <BottleneckHeatmap gaps={d.allStageGaps} post={post} />
          <p className="mt-3 text-[0.78rem] text-ink-3">
            Identified to registered uses only people identified 14 or more days ago, so recent leads are not counted as losses.{' '}
            {post ? `Visitors lost are people lost at the stage carried through the portfolio rates of later stages.${d.phase === 'event' ? ' The event is still running, so confirmed to attended covers only the days so far.' : ''}` : `Expected visitors lost carry people lost through the later portfolio rates and the ${showRateAssumption != null ? pct(showRateAssumption) : 'planning'} show-rate assumption.`}
          </p>
        </Panel>
      </div>

      {/* Signals run long; on wide screens (xl) they take the right column and data quality fills the left under the bottlenecks. */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2 xl:grid-rows-[auto_1fr]">
        <Panel title="Bottlenecks ranked by visitors lost" aside={`${d.bottlenecks.length} campaigns below portfolio`} className="xl:col-start-1 xl:row-start-1">
          <p className="mb-3 text-[0.82rem] text-ink-3">Each campaign&apos;s worst stage against the portfolio rate. {post ? '' : 'Before the event these are expected visitors, an assumption-based estimate.'}</p>
          <BottleneckList items={d.bottlenecks} asOf={d.asOf} post={post} onTask={setDraft} onAsk={askCopilot} />
        </Panel>
        <Panel title="Signals" aside={`${d.signals.length} fired`} className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <SignalGroups signals={d.signals} asOf={d.asOf} onTask={setDraft} onAsk={askCopilot} />
        </Panel>
        <Panel title="Data quality" pad={false} className="p-5 xl:col-start-1 xl:row-start-2">
          <p className="mb-2 text-[0.82rem] text-ink-3">What was cleaned or excluded before any number on this page was computed.</p>
          <DataQuality rows={d.dataQuality} />
        </Panel>
      </div>

      <Panel
        title="Week-over-week registrations by campaign"
        aside={
          <Button size="sm" variant="ghost" onClick={() => askCopilot(`Registrations went from ${d.drivers.totalPrev7} to ${d.drivers.totalLast7} in the 7 days to ${d.asOf}. Which campaigns drove the change, and is it volume or conversion? Separate evidence from hypotheses.`)}>
              Ask why
          </Button>
        }
      >
        <p className="num -mt-1 mb-3 text-[0.82rem] text-ink-3">{windowLabel(d.drivers.window)}, registrations of external people by campaign.</p>
        <WeekDrivers drivers={d.drivers} post={post} />
      </Panel>

      <Panel title="What goes with showing up">
        {post ? <p className="-mt-1 mb-3 text-[0.82rem] text-ink-3">Show rate of registered external people, by group, with final status at the as-of date.{d.phase === 'event' ? ' The event is still running, so these rates cover only the days so far.' : ''}</p> : null}
        {d.showUpDrivers.length ? (
          <>
            <ShowUpDrivers rows={d.showUpDrivers} />
            <p className="mt-4 text-[0.78rem] text-ink-3">These are associations. People who download the programme or ask a question may already be more committed, so the behaviour may signal intent rather than cause attendance. Status groups are definitional: only confirmed people were admitted.</p>
          </>
        ) : (
          <EmptyState
            title="Attendance data does not exist yet at this date"
            action={
              meta && meta.latestDate > d.asOf ? (
                <Button size="sm" variant="secondary" onClick={() => setAsOf(meta.latestDate)}>
                  View as of {dateLabel(meta.latestDate, true)}
                </Button>
              ) : null
            }
          >
            Show-up drivers compare who attended by status, lead time and engagement, so they appear once verified check-ins exist{eventDate ? `, from the event on ${dateLabel(eventDate, true)}` : ''}. Until then, plans use the {showRateAssumption != null ? pct(showRateAssumption) : ''} show-rate assumption for confirmed registrants.
          </EmptyState>
        )}
      </Panel>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function BiggestDrop({ d }: { d: Diagnosis }) {
  const b = d.biggestDrop;
  // At launch the engine still returns a step with nobody in it (lost 0, rate null).
  if (!b || b.lost <= 0) return <p className="mb-4 rounded-[var(--radius-control)] bg-paper-2 px-4 py-3 text-[0.9rem] text-ink-2">No one has dropped out of the people funnel at this date, so there is no drop to report yet. Move the as-of date later once people are identified and registering.</p>;
  const fromRow = d.funnel.find((f) => f.stage === DROP_STAGE[b.from]);
  const fromCount = fromRow?.count ?? (b.rate != null && b.rate < 1 ? b.lost / (1 - b.rate) : null);
  const toCount = fromCount != null ? fromCount - b.lost : null;
  return (
    <div className="mb-4 rounded-[var(--radius-control)] border-l-[3px] border-lac bg-lac-soft/60 px-4 py-3">
      <p className="text-[0.95rem] leading-snug text-ink">
        <span className="font-semibold">
          {b.from} to {b.to.charAt(0).toLowerCase() + b.to.slice(1)}
        </span>{' '}
        loses the most people:{' '}
        <span className="num font-semibold">
          {num(fromCount)} → {num(toCount)}
        </span>
        , so <span className="num type-title text-[1.05rem] text-lac">{num(b.lost)}</span> people did not move on. That is a <span className="num font-semibold">{pct(b.rate)}</span> conversion and a <span className="num font-semibold">{pct(b.rate != null ? 1 - b.rate : null)}</span> loss at this step.
      </p>
      {b.from === 'Identified' && (d.phase === 'campaign' || d.phase === 'pre-launch') ? <p className="mt-1.5 text-[0.8rem] text-ink-2">Part of this is timing: people identified in the last two weeks may still register. The stage gaps use only the cohort identified 14 or more days ago.</p> : null}
      {b.from === 'Confirmed' && d.phase === 'event' ? <p className="mt-1.5 text-[0.8rem] text-ink-2">The event is still running at this date, so attendance covers only the days so far and this drop is likely to shrink.</p> : null}
    </div>
  );
}

function FunnelTable({ d, post, showRateAssumption }: { d: Diagnosis; post: boolean; showRateAssumption: number | null }) {
  const dropTo = d.biggestDrop && d.biggestDrop.lost > 0 ? DROP_STAGE[d.biggestDrop.to] : null;
  const confirmed = d.funnel.find((f) => f.stage === 'Confirmed')?.count ?? null;
  return (
    <Table>
      <thead>
        <tr>
          <Th className="text-left">Stage</Th>
          <Th align="right">Count</Th>
          <Th align="right">From previous</Th>
        </tr>
      </thead>
      <tbody>
        {d.funnel.map((f) => {
          const isVisitors = f.stage === 'Verified visitors';
          const notYet = isVisitors && !post;
          const isDrop = f.stage === dropTo;
          // Before the event: confirmed so far × the planning show rate, labelled as an assumption.
          const expected = notYet && confirmed != null && confirmed > 0 && showRateAssumption != null ? confirmed * showRateAssumption : null;
          // After it: the rate is registered visitors over confirmed, while the count also holds walk-ins.
          const registeredVisitors = isVisitors && post && f.rateFromPrev != null && confirmed != null ? Math.round(f.rateFromPrev * confirmed) : null;
          return (
            <FunnelRow key={f.stage} switchBefore={f.stage === 'Identified external people'}>
              <tr className={cx(isDrop && 'bg-lac-soft/50')}>
                <Td className={cx('py-1.5', isDrop && 'shadow-[inset_3px_0_0_var(--lac)]')}>
                  <div className="text-[0.86rem] font-medium">{f.stage}</div>
                  {f.note && f.note !== 'CTR' ? <div className="text-[0.74rem] leading-snug text-ink-3">{f.note}</div> : null}
                  {expected != null ? (
                    <div className="num text-[0.74rem] leading-snug text-ink-2">
                      Expected about {num(expected)}: {num(confirmed)} confirmed so far × {pct(showRateAssumption)} show-rate assumption.
                    </div>
                  ) : null}
                  {registeredVisitors != null ? (
                    <div className="num text-[0.74rem] leading-snug text-ink-3">
                      The rate is the {num(registeredVisitors)} registered visitors over {num(confirmed)} confirmed.
                    </div>
                  ) : null}
                </Td>
                <Td align="right" className="whitespace-nowrap py-1.5 align-top">
                  {notYet ? (
                    <>
                      <span className="text-ink-3">Not yet</span>
                      {expected != null ? <div className="text-[0.74rem] font-normal text-ink-2">~{num(expected)} expected</div> : null}
                    </>
                  ) : (
                    num(f.count)
                  )}
                </Td>
                <Td align="right" className={cx('py-1.5 align-top', isDrop && 'font-semibold text-lac')}>
                  {f.rateFromPrev != null ? pct(f.rateFromPrev) : <span className="text-ink-3">–</span>}
                  {f.note === 'CTR' ? <div className="text-[0.74rem] font-normal text-ink-3">CTR</div> : null}
                </Td>
              </tr>
            </FunnelRow>
          );
        })}
      </tbody>
    </Table>
  );
}

function FunnelRow({ switchBefore, children }: { switchBefore: boolean; children: ReactNode }) {
  return (
    <>
      {switchBefore ? (
        <tr>
          <td colSpan={3} className="border-b border-line bg-paper-2 px-2.5 py-1 text-[0.74rem] text-ink-2">
            Identity switch: rows above are anonymous events and sessions, rows below are distinct people.
          </td>
        </tr>
      ) : null}
      {children}
    </>
  );
}

function DataQuality({ rows }: { rows: Diagnosis['dataQuality'] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="text-left">Item</Th>
          <Th align="right">Value</Th>
          <Th className="text-left">Note</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.item} className="align-top hover:bg-paper">
            <Td className="text-[0.86rem] font-medium">{r.item}</Td>
            <Td align="right" className="whitespace-nowrap font-semibold">
              {typeof r.value === 'number' ? num(r.value) : tidy(r.value)}
            </Td>
            <Td className="text-[0.8rem] leading-snug text-ink-2">{r.note}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function DiagnoseSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-[28rem] max-w-full" />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
