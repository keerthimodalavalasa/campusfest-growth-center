'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Recommendation } from '@/server/engine/decide';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { campaignColor, DECISION } from '@/lib/colors';
import { dateLabel, inr, num, pct } from '@/lib/format';
import { Button, Chip, EmptyState, ErrorNote, Figure, Panel, SeverityChip, Skeleton } from '@/components/ui';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { DecisionBox, type CostFactors } from './DecisionBox';
import { ManagePanel } from './ManagePanel';
import { StageFunnel } from './StageFunnel';
import { WeeklyCharts } from './WeeklyCharts';
import { channelLabel, istDate, isPostEvent, StatusChip, TASK_STATUS, titleFromAction, UNATTRIBUTED, type CampaignDetailResponse, type TaskRow } from './shared';

export function CampaignDetailPage() {
  // useParams reads request-time URL data, so it sits behind a Suspense boundary (cacheComponents is on)
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CampaignDetail />
    </Suspense>
  );
}

const TASK_DECISION: Record<Recommendation['decision'], string> = { scale: 'scale', change: 'change', stop: 'stop', keep: 'monitor' };

function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const id = safeDecode(String(params.id ?? ''));
  const { meta, askCopilot, ownerName } = useApp();
  const q = useApi<CampaignDetailResponse>(useAsOfUrl(`/api/campaigns/${encodeURIComponent(id)}`));
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  const back = (
    <Link href="/campaigns" className="text-[0.86rem] font-medium text-sagar hover:underline">
      All campaigns
    </Link>
  );

  if (q.error && !q.data) {
    if (/not found/i.test(q.error))
      return (
        <div className="space-y-4">
          {back}
          <h1 className="type-display text-[1.9rem] text-ink">Campaign not found</h1>
          <EmptyState
            title={`There is no campaign with the ID “${id}”`}
            action={
              <Link href="/campaigns" className="font-semibold text-sagar hover:underline">
                Go to all campaigns
              </Link>
            }
          >
            It may have been mistyped, or the data was reset to the original workbook. Pick a campaign from the full list.
          </EmptyState>
        </div>
      );
    return (
      <div className="space-y-4">
        {back}
        <ErrorNote onRetry={q.refresh}>Could not load this campaign: {q.error}</ErrorNote>
      </div>
    );
  }
  if (!q.data) return <DetailSkeleton />;

  const d = q.data;
  const c = d.campaign;
  const m = d.metrics;
  const post = isPostEvent(d.phase);
  const color = campaignColor(id);
  const name = m?.name ?? c?.name ?? id;
  const owner = c?.ownerId ? ownerName(c.ownerId) : m?.ownerName ?? null;
  // tasks raised here go to the campaign's owner by default
  const ownerId = c?.ownerId ?? m?.ownerId ?? null;
  const walkIns = id === UNATTRIBUTED;
  const s = meta?.settings ?? {};
  const factor = (k: string, dflt: number) => (typeof s[k] === 'number' ? (s[k] as number) : dflt);
  const factors: CostFactors = { scale: factor('scaleCostFactor', 0.8), change: factor('changeCostFactor', 1.25), stop: factor('stopCostFactor', 2) };
  const eventDate = meta ? istDate(meta.event.startsAt) : null;
  const start = istDate(c?.plannedStartAt);
  const end = istDate(c?.plannedEndAt);
  const asOfText = dateLabel(d.asOf, true);

  const openDecisionTask = (rec: Recommendation) =>
    setDraft({
      title: titleFromAction(rec.suggestedAction),
      description: rec.suggestedAction,
      campaign_id: id,
      owner_id: ownerId,
      decision: TASK_DECISION[rec.decision],
      priority: rec.decision === 'stop' ? 'high' : rec.decision === 'change' ? 'high' : 'medium',
      evidence: `${DECISION[rec.decision].label} call as of ${asOfText}. ${rec.reasons.join(' ')}`,
      source: 'insight',
    });

  return (
    <div className="space-y-5">
      {back}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[80ch]">
          <h1 className="type-display flex items-center gap-3 text-[1.9rem] text-ink">
            <span className="inline-block size-4 shrink-0 rounded-[4px]" style={{ background: color }} aria-hidden />
            {name}
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-ink-2">
            {walkIns ? (
              <>Verified visitors and identified people with no campaign attached, mostly walk-ins identified at the gate. </>
            ) : (
              <>
                {c?.channel || m?.channel ? <>{channelLabel(c?.channel ?? m?.channel)} channel</> : 'No channel set'}, {owner ? <>owned by <span className="font-semibold text-ink">{owner}</span></> : 'no owner assigned'}.{' '}
              </>
            )}
            {start || end ? (
              <>
                Planned {start ? dateLabel(start, true) : 'open start'} to {end ? dateLabel(end, true) : 'open end'}.{' '}
              </>
            ) : null}
            Numbers as of {asOfText}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {m && m.campaignId !== UNATTRIBUTED ? <StatusChip status={c?.status ?? m.status} /> : null}
          {d.decision ? <Chip fg={DECISION[d.decision.decision].fg} bg={DECISION[d.decision.decision].bg}>Call: {DECISION[d.decision.decision].label}</Chip> : null}
          <Button
            variant="secondary"
            icon={<Sparkles size={15} aria-hidden />}
            onClick={() =>
              askCopilot(
                `Review the ${name} campaign (${id}) using the data as of ${d.asOf}: is the ${d.decision ? DECISION[d.decision.decision].label.toLowerCase() : 'current'} call right, which funnel stage loses the most people against the portfolio, and what should ${owner ?? 'the owner'} do this week?`,
              )
            }
          >
            Ask the copilot about this campaign
          </Button>
        </div>
      </header>

      {c?.objective || c?.targetAudience ? (
        <dl className="grid gap-x-8 gap-y-3 rounded-[var(--radius-panel)] bg-paper-2 px-5 py-4 text-[0.9rem] md:grid-cols-2">
          <div>
            <dt className="text-[0.8rem] font-medium text-ink-3">Objective</dt>
            <dd className="mt-0.5 text-ink">{c.objective ?? <span className="text-ink-3">Not set</span>}</dd>
          </div>
          <div>
            <dt className="text-[0.8rem] font-medium text-ink-3">Target audience</dt>
            <dd className="mt-0.5 text-ink">{c.targetAudience ?? <span className="text-ink-3">Not set</span>}</dd>
          </div>
        </dl>
      ) : null}

      {m ? <KeyFigures m={m} totals={d.totals} rec={d.decision} post={post} factors={factors} walkIns={walkIns} /> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel title="Stage by stage against the portfolio" aside={`as of ${asOfText}`}>
            {walkIns ? (
              <p className="text-[0.9rem] text-ink-2">
                Walk-ins have no ad impressions, landing sessions or registrations, so there is no funnel to compare with the portfolio. They count only as verified visitors
                {m ? (
                  <>
                    : <span className="num font-semibold text-ink">{num(m.visitors)}</span> as of {asOfText}
                  </>
                ) : null}
                .
              </p>
            ) : m && m.impressions === 0 && m.identified === 0 && m.registrations === 0 ? (
              <p className="text-[0.9rem] text-ink-2">No impressions, identified people or registrations are recorded against this campaign as of {asOfText}, so there is nothing to compare yet. The stages fill in once activity is imported or entered on the Data page.</p>
            ) : m ? (
              <StageFunnel m={m} totals={d.totals} gaps={d.stageGaps} post={post} />
            ) : (
              <p className="text-[0.9rem] text-ink-2">No metrics for this campaign at this date.</p>
            )}
          </Panel>
        </div>
        <Panel title="The call">
          {d.decision ? (
            <DecisionBox rec={d.decision} factors={factors} onCreateTask={() => openDecisionTask(d.decision!)} />
          ) : (
            <p className="text-[0.9rem] text-ink-2">
              {id === UNATTRIBUTED
                ? 'Walk-ins and unattributed people are not a campaign, so they get no scale, change or stop call.'
                : `No call yet: the campaign has no spend, identified people or registrations as of ${asOfText}. A call appears once it has activity.`}
            </p>
          )}
        </Panel>
      </div>

      <WeeklyCharts weekly={d.weekly} color={color} asOf={d.asOf} eventDate={eventDate} post={post} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        <Panel title="Signals for this campaign" aside={`${d.signals.length} at this date`}>
          {d.signals.length ? (
            <ul className="space-y-3">
              {d.signals.map((sig) => (
                <li key={sig.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <SeverityChip severity={sig.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.9rem] leading-snug font-semibold">{sig.title}</div>
                      <div className="mt-0.5 text-[0.82rem] text-ink-2">{sig.evidence}</div>
                      <div className="mt-1 text-[0.82rem] text-ink">{sig.suggestedAction}</div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() =>
                          setDraft({
                            title: titleFromAction(sig.suggestedAction),
                            description: sig.suggestedAction,
                            campaign_id: id,
                            owner_id: ownerId,
                            evidence: `${sig.title}. ${sig.evidence} (as of ${asOfText})`,
                            priority: sig.severity === 'high' ? 'high' : 'medium',
                            decision: 'fix',
                            source: 'insight',
                          })
                        }
                      >
                        Create task
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.9rem] text-ink-2">No signals fired for this campaign as of {asOfText}.</p>
          )}
        </Panel>

        <Panel
          title="Tasks"
          aside={
            c ? (
              <Button size="sm" variant="secondary" onClick={() => setDraft({ campaign_id: id, owner_id: ownerId, source: 'manual' })}>
                Create task
              </Button>
            ) : null
          }
        >
          <TaskList tasks={d.tasks} onOpen={(t) => setDraft(taskToDraft(t))} />
        </Panel>

        {c ? (
          <Panel title="Manage this campaign">
            <ManagePanel campaign={c} spend={m?.spend ?? 0} color={color} />
          </Panel>
        ) : (
          <Panel title="Manage this campaign" tone="well">
            <p className="text-[0.88rem] text-ink-2">This bucket collects visitors and people with no campaign attached. It has no status, budget or notes to edit.</p>
          </Panel>
        )}
      </div>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

/** A malformed escape such as "%E0" in the URL falls through to the not-found state instead of throwing. */
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function taskToDraft(t: TaskRow): TaskDraft {
  return { id: t.id, title: t.title, description: t.description, campaign_id: t.campaign_id, initiative_id: t.initiative_id, owner_id: t.owner_id, due_date: t.due_date, status: t.status, priority: t.priority, decision: t.decision, evidence: t.evidence, source: t.source };
}

function TaskList({ tasks, onOpen }: { tasks: TaskRow[]; onOpen: (t: TaskRow) => void }) {
  if (!tasks.length) return <p className="text-[0.9rem] text-ink-2">No tasks for this campaign yet. Turn the call or a signal into one with Create task.</p>;
  const open = tasks.filter((t) => t.status !== 'done').length;
  return (
    <>
      <p className="mb-2 text-[0.8rem] text-ink-3">
        <span className="num">{open}</span> open of <span className="num">{tasks.length}</span>. Select a task to edit it.
      </p>
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const st = TASK_STATUS[t.status] ?? { label: t.status, fg: 'var(--ink-2)', bg: 'var(--paper-2)' };
          return (
            <li key={t.id} className="py-2.5">
              <button type="button" onClick={() => onOpen(t)} className="text-left text-[0.9rem] leading-snug font-semibold text-ink hover:text-sagar hover:underline">
                {t.title}
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-ink-2">
                <Chip fg={st.fg} bg={st.bg}>
                  {st.label}
                </Chip>
                <span>{t.owner_name ?? 'Unassigned'}</span>
                <span className="num">{t.due_date ? `Due ${dateLabel(t.due_date, true)}` : 'No due date'}</span>
                {t.priority === 'high' ? <span className="font-semibold text-lac">High priority</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function KeyFigures({ m, totals, rec, post, factors, walkIns }: { m: CampaignMetrics; totals: CampaignMetrics; rec: Recommendation | null; post: boolean; factors: CostFactors; walkIns: boolean }) {
  const eff = post ? m.costs.perVisitor : m.costs.perExpectedVisitor;
  const median = rec?.portfolioMedian ?? null;
  // colour follows the decision rule bands: green in the scale band, crimson above the change threshold
  const ratio = rec?.ratioToMedian ?? (eff != null && median ? eff / median : null);
  const effTone = ratio == null || m.spend <= 0 ? 'neutral' : ratio <= factors.scale ? 'good' : ratio > factors.change ? 'bad' : 'neutral';
  return (
    <section aria-label="Key figures" className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4 sm:grid-cols-3 xl:grid-cols-6">
      <Figure label="Net spend" value={inr(m.spend)} sub={<>{pct(m.shares.spend)} of all spend</>} />
      <Figure label="Identified" value={num(m.identified)} sub={<>{num(m.momentum.identLast14)} in the last 14 days</>} />
      <Figure label="Registered" value={num(m.registrations)} sub={<>{num(m.momentum.regsLast7)} new in the last 7 days</>} />
      <Figure label="Confirmed" value={num(m.confirmed)} sub={walkIns ? <>walk-ins hold no registration</> : <>{pct(m.rates.regToConfirmed)} of registered</>} />
      {post ? (
        <Figure label="Verified visitors" value={num(m.visitors)} sub={walkIns ? <>{pct(m.shares.visitors)} of all verified visitors</> : <>{pct(m.rates.regToVisit)} of registrants came, portfolio {pct(totals.rates.regToVisit)}</>} />
      ) : (
        <Figure label="Expected visitors" value={num(m.expectedVisitors)} sub={<>confirmed × {pct(m.showRateAssumption, 0)} show-rate assumption</>} />
      )}
      <Figure
        label={post ? 'Cost per visitor' : 'Cost per expected visitor'}
        value={walkIns ? '–' : inr(eff)}
        tone={effTone}
        sub={walkIns ? <>not bought, so no cost per head</> : m.spend > 0 ? <>portfolio median {inr(median)}</> : <>no net paid spend</>}
      />
    </section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-12 w-96" />
      <Skeleton className="h-20" />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
