'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useState, type CSSProperties } from 'react';
import { ChevronLeftDuotone, CircleAlertDuotone, ClipboardListDuotone, FunnelDuotone, IndianRupeeDuotone, MessageSquareTextDuotone, PlusDuotone, Settings2Duotone, SlidersHorizontalDuotone, UsersDuotone, WalletDuotone } from 'runeicons-react';
import type { Recommendation } from '@/server/engine/decide';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { campaignColor, DECISION } from '@/lib/colors';
import { dateLabel, inr, num, pct } from '@/lib/format';
import { Button, Chip, cx, EmptyState, ErrorNote, Ico, Pips, Skeleton, StatusPill, Tile, TileHead } from '@/components/ui';
import { MetricTile } from '@/components/tiles';
import { SignalTile, signalView } from '@/components/signals';
import { CountUp, Gauge, MiniBars, Ring } from '@/components/viz';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { DecisionBox, type CostFactors } from './DecisionBox';
import { ManagePanel } from './ManagePanel';
import { CampaignStepFunnel, StageCompare } from './StageFunnel';
import { WeeklyCharts } from './WeeklyCharts';
import { channelLabel, istDate, isPostEvent, StatusChip, TASK_STATUS, times, titleFromAction, UNATTRIBUTED, type CampaignDetailResponse, type TaskRow } from './shared';

export function CampaignDetailPage() {
  // useParams reads request-time URL data, so it sits behind a Suspense boundary (cacheComponents is on)
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CampaignDetail />
    </Suspense>
  );
}

const TASK_DECISION: Record<Recommendation['decision'], string> = { scale: 'scale', change: 'change', stop: 'stop', keep: 'monitor' };

function BackLink() {
  return (
    <Link href="/campaigns" className="mb-3 inline-flex h-8 items-center gap-1 rounded-full pr-3 pl-1.5 text-[13px] font-[600] text-ink-2 transition-colors duration-150 hover:bg-stone hover:text-ink">
      <Ico icon={ChevronLeftDuotone} size={16} ia="currentColor" />
      All campaigns
    </Link>
  );
}

function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const id = safeDecode(String(params.id ?? ''));
  const { meta, askCopilot, ownerName } = useApp();
  const q = useApi<CampaignDetailResponse>(useAsOfUrl(`/api/campaigns/${encodeURIComponent(id)}`));
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  if (q.error && !q.data) {
    if (/not found/i.test(q.error))
      return (
        <div>
          <BackLink />
          <h1 className="type-display mb-4 text-[2.6rem] text-ink max-[720px]:text-[2.1rem]">Campaign not found</h1>
          <EmptyState
            title={`There is no campaign with the ID “${id}”`}
            action={
              <Link href="/campaigns" className="font-[650] underline decoration-stone-3 underline-offset-2 hover:decoration-ink">
                Go to all campaigns
              </Link>
            }
          >
            It may have been mistyped, or the data was reset to the original workbook. Pick a campaign from the full list.
          </EmptyState>
        </div>
      );
    return (
      <div>
        <BackLink />
        <h1 className="sr-only">Campaign</h1>
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
  const owner = c?.ownerId ? ownerName(c.ownerId) : (m?.ownerName ?? null);
  // tasks raised here go to the campaign's owner by default
  const ownerId = c?.ownerId ?? m?.ownerId ?? null;
  const walkIns = id === UNATTRIBUTED;
  const s = meta?.settings ?? {};
  const factor = (k: string, dflt: number) => (typeof s[k] === 'number' ? (s[k] as number) : dflt);
  const factors: CostFactors = { scale: factor('scaleCostFactor', 0.8), change: factor('changeCostFactor', 1.25), stop: factor('stopCostFactor', 2) };
  const maxOptOut = factor('maxOptOutRate', 0.08);
  const eventDate = meta ? istDate(meta.event.startsAt) : null;
  const start = istDate(c?.plannedStartAt);
  const end = istDate(c?.plannedEndAt);
  const asOfText = dateLabel(d.asOf, true);
  const rec = d.decision;

  const openDecisionTask = (r: Recommendation) =>
    setDraft({
      title: titleFromAction(r.suggestedAction),
      description: r.suggestedAction,
      campaign_id: id,
      owner_id: ownerId,
      decision: TASK_DECISION[r.decision],
      priority: r.decision === 'stop' ? 'high' : r.decision === 'change' ? 'high' : 'medium',
      evidence: `${DECISION[r.decision].label} call as of ${asOfText}. ${r.reasons.join(' ')}`,
      source: 'insight',
    });

  return (
    <div>
      <BackLink />
      <header className="flex flex-wrap items-end justify-between gap-4 pb-5">
        <div className="min-w-0 max-w-[80ch]">
          <h1 className="type-display flex items-center gap-3 text-[2.6rem] text-ink max-[720px]:text-[2.1rem]">
            <span className="inline-block size-5 shrink-0 rounded-[6px]" style={{ background: color }} aria-hidden />
            <span className="min-w-0">{name}</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-ink-2">
            {walkIns ? (
              <span>Visitors and people with no campaign attached</span>
            ) : (
              <>
                {m && m.campaignId !== UNATTRIBUTED ? <StatusChip status={c?.status ?? m.status} /> : null}
                <span>{c?.channel || m?.channel ? `${channelLabel(c?.channel ?? m?.channel)} channel` : 'No channel set'}</span>
                <span>{owner ? <>Owned by <b className="font-[650] text-ink">{owner}</b></> : 'No owner assigned'}</span>
              </>
            )}
            {start || end ? (
              <span className="tab">
                {start ? dateLabel(start) : 'Open start'} to {end ? dateLabel(end, true) : 'open end'}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rec ? <StatusPill decision={rec.decision} className="h-8 px-3 text-[13px]" /> : null}
          <Button
            variant="secondary"
            icon={<Ico icon={MessageSquareTextDuotone} size={18} ia="var(--lac)" ib="var(--lac-pale)" />}
            onClick={() =>
              askCopilot(
                `Review the ${name} campaign (${id}) using the data as of ${d.asOf}: is the ${rec ? DECISION[rec.decision].label.toLowerCase() : 'current'} call right, which funnel stage loses the most people against the portfolio, and what should ${owner ?? 'the owner'} do this week?`,
              )
            }
          >
            Ask the copilot
          </Button>
        </div>
      </header>

      {m ? <KeyTiles m={m} totals={d.totals} rec={rec} post={post} walkIns={walkIns} weekly={d.weekly} plannedBudget={c?.plannedBudget ?? null} /> : null}

      {c?.objective || c?.targetAudience ? (
        <dl className="mt-3 grid gap-x-8 gap-y-2 rounded-tile-m bg-stone px-4 py-3 text-[13.5px] md:grid-cols-2">
          <div>
            <dt className="text-[12.5px] font-[600] text-ink-2">Objective</dt>
            <dd className="mt-0.5 text-ink">{c.objective ?? <span className="text-ink-2">Not set</span>}</dd>
          </div>
          <div>
            <dt className="text-[12.5px] font-[600] text-ink-2">Target audience</dt>
            <dd className="mt-0.5 text-ink">{c.targetAudience ?? <span className="text-ink-2">Not set</span>}</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-3 grid grid-cols-12 items-stretch gap-3">
        <Tile field="stone" delay={200} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="Stage by stage">
          <TileHead icon={FunnelDuotone} aside={`as of ${dateLabel(d.asOf)}`}>
            Stage by stage
          </TileHead>
          {walkIns ? (
            <p className="mt-3 text-[13.5px] text-ink-2">
              Walk-ins have no ad impressions, landing sessions or registrations, so there is no funnel to compare. They count only as verified visitors{m ? <>: <b className="tab font-[700] text-ink">{num(m.visitors)}</b></> : null}.
            </p>
          ) : m && m.impressions === 0 && m.identified === 0 && m.registrations === 0 ? (
            <div className="mt-3">
              <EmptyState title="No activity recorded yet">Stages fill in once impressions, sign-ups or registrations are imported or entered on the Data page.</EmptyState>
            </div>
          ) : m ? (
            <>
              <div className="flex h-[260px] flex-col max-[720px]:h-auto">
                <CampaignStepFunnel m={m} post={post} />
              </div>
              <div className="mt-5">
                <StageCompare m={m} totals={d.totals} gaps={d.stageGaps} post={post} />
              </div>
            </>
          ) : (
            <p className="mt-3 text-[13.5px] text-ink-2">No metrics for this campaign at this date.</p>
          )}
        </Tile>

        <Tile field="stone" delay={240} pad={false} className="col-span-5 flex flex-col overflow-hidden max-[1200px]:col-span-12" aria-label="The call">
          {rec ? <div aria-hidden className="h-2" style={{ background: DECISION[rec.decision].fg }} /> : null}
          <div className="flex flex-1 flex-col p-5">
            <TileHead icon={SlidersHorizontalDuotone} aside={rec ? <StatusPill decision={rec.decision} /> : null}>
              The call
            </TileHead>
            {rec ? (
              <DecisionBox rec={rec} factors={factors} onCreateTask={() => openDecisionTask(rec)} />
            ) : (
              <p className="mt-3 text-[13.5px] text-ink-2">
                {walkIns ? 'Walk-ins and unattributed people are not a campaign, so they get no scale, change or stop call.' : `No call yet: the campaign has no spend, identified people or registrations as of ${asOfText}.`}
              </p>
            )}
          </div>
        </Tile>
      </div>

      <div className="mt-3">
        <WeeklyCharts weekly={d.weekly} asOf={d.asOf} eventDate={eventDate} post={post} />
      </div>

      <div className="mt-3 grid grid-cols-3 items-start gap-3 max-[1200px]:grid-cols-2 max-[720px]:grid-cols-1">
        <section aria-label="Signals for this campaign" className="flex min-w-0 flex-col gap-2.5">
          <div className="flex items-center gap-2 px-1 pt-1">
            <Ico icon={CircleAlertDuotone} size={20} ia="var(--ink)" ib="var(--stone-3)" />
            <h2 className="text-[14px] font-[650]">Signals</h2>
            <span className="tab inline-grid h-[22px] min-w-6 place-items-center rounded-full bg-ink px-[7px] text-[12px] font-[700] text-white">{d.signals.length}</span>
          </div>
          {d.signals.length ? (
            d.signals.map((sig, i) => (
              <SignalTile
                key={sig.id}
                sig={sig}
                view={signalView(sig, m ? { campaigns: [m], totals: d.totals, projection: null, target: null } : null, maxOptOut)}
                who={name}
                delay={380 + i * 40}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
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
                    <Button size="sm" variant={sig.severity === 'high' ? 'secondary' : 'ghost'} onClick={() => askCopilot(`Explain this signal for ${name} and what you would do, using the data as of ${d.asOf}: "${sig.title}". Evidence: ${sig.evidence}`)}>
                      Ask why
                    </Button>
                  </>
                }
              />
            ))
          ) : (
            <div className="field-stone rounded-tile-m px-4 py-3.5 text-[13.5px] font-[600]">
              Nothing flagged
              <span className="block text-[12.5px] font-[550] text-ink-2">No signal fired for this campaign as of {dateLabel(d.asOf)}</span>
            </div>
          )}
        </section>

        <Tile field="stone" delay={420} aria-label="Tasks">
          <TileHead
            icon={ClipboardListDuotone}
            aside={
              c ? (
                <Button size="sm" variant="secondary" icon={<Ico icon={PlusDuotone} size={14} ia="var(--ink)" />} onClick={() => setDraft({ campaign_id: id, owner_id: ownerId, source: 'manual' })}>
                  Create task
                </Button>
              ) : null
            }
          >
            Tasks
          </TileHead>
          <TaskList tasks={d.tasks} onOpen={(t) => setDraft(taskToDraft(t))} />
        </Tile>

        <Tile field="stone" delay={460} aria-label="Manage this campaign" className="max-[1200px]:col-span-2 max-[720px]:col-span-1">
          <TileHead icon={Settings2Duotone}>Manage this campaign</TileHead>
          <div className="mt-3">
            {c ? <ManagePanel campaign={c} spend={m?.spend ?? 0} /> : <p className="text-[13.5px] text-ink-2">This bucket collects visitors and people with no campaign attached. It has no status, budget or notes to edit.</p>}
          </div>
        </Tile>
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

const PRIORITY_LEVEL: Record<string, number> = { high: 3, medium: 2, low: 1 };

function TaskList({ tasks, onOpen }: { tasks: TaskRow[]; onOpen: (t: TaskRow) => void }) {
  if (!tasks.length) return <p className="mt-3 text-[13.5px] text-ink-2">No tasks yet. Turn the call or a signal into one with Create task.</p>;
  const open = tasks.filter((t) => t.status !== 'done').length;
  return (
    <>
      <p className="mt-1 mb-2 text-[12.5px] font-[550] text-ink-2">
        <span className="tab">{open}</span> open of <span className="tab">{tasks.length}</span>
      </p>
      <ul className="grid gap-1.5">
        {tasks.map((t) => {
          const st = TASK_STATUS[t.status] ?? { label: t.status, fg: 'var(--ink-2)', bg: 'var(--stone-2)' };
          return (
            <li key={t.id}>
              <button type="button" onClick={() => onOpen(t)} className="w-full rounded-[12px] bg-stone-2/60 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-stone-2">
                <span className={cx('block text-[13.5px] leading-[1.3] font-[650] text-ink', t.status === 'done' && 'text-ink-2 line-through decoration-stone-3')}>{t.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-[550] text-ink-2">
                  <Chip fg={st.fg} bg={st.bg} className="h-[22px] px-2 text-[11.5px]">
                    {st.label}
                  </Chip>
                  <span>{t.owner_name ?? 'Unassigned'}</span>
                  <span className="tab">{t.due_date ? `Due ${dateLabel(t.due_date)}` : 'No due date'}</span>
                  {PRIORITY_LEVEL[t.priority] ? (
                    <span className="inline-flex items-center gap-1 text-ink">
                      <Pips level={PRIORITY_LEVEL[t.priority]} />
                      {t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Header row: one solid family tile (visitors), the rest limestone with their family hue as marks. */
function KeyTiles({ m, totals, rec, post, walkIns, weekly, plannedBudget }: { m: CampaignMetrics; totals: CampaignMetrics; rec: Recommendation | null; post: boolean; walkIns: boolean; weekly: CampaignDetailResponse['weekly']; plannedBudget: number | null }) {
  const eff = post ? m.costs.perVisitor : m.costs.perExpectedVisitor;
  const median = rec?.portfolioMedian ?? null;
  const ratio = rec?.ratioToMedian ?? (eff != null && median ? eff / median : null);
  const show = post ? m.rates.regToVisit : m.showRateAssumption;
  const recent = weekly.slice(-10).map((w) => w.newRegistrations);
  const budgetShare = plannedBudget && plannedBudget > 0 ? m.spend / plannedBudget : null;
  const cls = 'min-h-[176px]';
  return (
    <section aria-label="Key figures" className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
      <MetricTile
        field="lac"
        icon={UsersDuotone}
        ia="#fff"
        ib="var(--lac-pale)"
        title={post ? 'Verified visitors' : 'Expected visitors'}
        label={post ? 'Verified visitors' : 'Expected visitors'}
        delay={0}
        className={cls}
        wideViz
        vizClass="!top-[18px] !h-[54px] !w-[92px] max-[720px]:!h-[47px] max-[720px]:!w-20"
        viz={show != null && !walkIns ? <Gauge value={show} assumed={!post} color="#fff" hatch="var(--lac-track)" track="var(--lac-track)" label={post ? `${pct(show)} of registrants came` : `${pct(show)} show rate, assumed`} /> : null}
        value={<CountUp value={post ? m.visitors : m.expectedVisitors} format={num} />}
        sub={walkIns ? `${pct(m.shares.visitors)} of all visitors` : post ? `${pct(m.rates.regToVisit)} of registrants came` : `confirmed × ${pct(m.showRateAssumption, 0)} assumed`}
        foot={walkIns ? <>not bought, so no cost per head</> : post ? <>Portfolio {pct(totals.rates.regToVisit)}</> : <>{num(m.confirmed)} confirmed so far</>}
      />
      <MetricTile
        icon={ClipboardListDuotone}
        ia="var(--nizami)"
        ib="var(--nizami-2)"
        title="Registered"
        label="Registered"
        delay={40}
        className={cls}
        wideViz
        vizClass="!top-[20px] !h-[40px] !w-[92px] max-[720px]:!h-[40px] max-[720px]:!w-[92px]"
        viz={recent.some((n) => n > 0) ? <MiniBars values={recent} color="var(--nizami)" width={92} height={40} gap={3} highlightLast label="New registrations, last 10 weeks" /> : null}
        value={<CountUp value={m.registrations} format={num} />}
        sub={`${num(m.momentum.regsLast7)} in the last 7 days`}
        foot={walkIns ? <>walk-ins hold no registration</> : <>{pct(m.rates.regToConfirmed)} confirmed</>}
      />
      <MetricTile
        icon={WalletDuotone}
        ia="var(--haldi-track)"
        ib="var(--haldi)"
        title="Net spend"
        label="Net spend"
        delay={80}
        className={cls}
        viz={<Ring value={budgetShare ?? m.shares.spend ?? NaN} track="var(--stone-2)" arc="var(--haldi)" ink="var(--ink)" label={budgetShare != null ? `${pct(budgetShare, 0)} of planned budget` : `${pct(m.shares.spend, 0)} of all spend`} />}
        value={<CountUp value={m.spend} format={inr} />}
        sub={budgetShare != null ? `of ${inr(plannedBudget)} planned` : `${pct(m.shares.spend)} of all spend`}
        foot={<>{inr(m.costs.perRegistration)} per registration</>}
      />
      <MetricTile
        icon={IndianRupeeDuotone}
        ia="var(--ink)"
        ib="var(--haldi)"
        title={post ? 'Cost per visitor' : 'Cost per expected visitor'}
        label={post ? 'Cost per visitor' : 'Cost per expected visitor'}
        delay={120}
        className={cls}
        wideViz
        vizClass="!top-[20px] !h-[44px] !w-[92px] max-[720px]:!h-[44px] max-[720px]:!w-[92px]"
        viz={!walkIns && eff != null && median ? <VsMedian value={eff} median={median} /> : null}
        value={walkIns ? '–' : eff != null ? <CountUp value={eff} format={inr} /> : '–'}
        sub={walkIns ? 'not bought' : m.spend > 0 && ratio != null ? `${times(ratio)} the ${inr(median)} median` : 'no net paid spend'}
        foot={rec ? <StatusPill decision={rec.decision} /> : <span className="text-ink-2">No call</span>}
      />
    </section>
  );
}

/** This campaign's cost (haldi) against the portfolio median (ink), as two bars on one scale. */
function VsMedian({ value, median }: { value: number; median: number }) {
  const max = Math.max(value, median) || 1;
  const rows = [
    { label: 'This', v: value, bg: 'var(--haldi)' },
    { label: 'Median', v: median, bg: 'var(--ink-2)' },
  ];
  return (
    <div className="grid gap-1.5" role="img" aria-label={`${inr(value)} against a median of ${inr(median)}`}>
      {rows.map((r, i) => (
        <div key={r.label} className="grid grid-cols-[1fr] gap-0.5">
          <span className="text-[10.5px] leading-none font-[650] text-ink-2">{r.label}</span>
          <i className="anim-grow-x block h-2 rounded-r-[3px]" style={{ width: `${(r.v / max) * 100}%`, background: r.bg, '--d': `${300 + i * 60}ms` } as CSSProperties} />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the campaign">
      <Skeleton className="h-8 w-36 bg-stone" />
      <Skeleton className="h-12 w-96 max-w-full bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-[176px] rounded-tile-s bg-stone" />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-3">
        <Skeleton className="col-span-7 h-[520px] rounded-tile-l bg-stone max-[1200px]:col-span-12" />
        <Skeleton className="col-span-5 h-[520px] rounded-tile-l bg-stone max-[1200px]:col-span-12" />
      </div>
    </div>
  );
}
