'use client';
import { useState } from 'react';
import { ArrowLeftRightDuotone, ChartBarDuotone, IndianRupeeDuotone, LayoutGridDuotone, MessageSquareTextDuotone, SlidersHorizontalDuotone } from 'runeicons-react';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { campaignColor } from '@/lib/colors';
import { dateLabel, inr, inrShort, num, pct } from '@/lib/format';
import { Button, EmptyState, ErrorNote, Ico, PageHeader, Skeleton, StatusPill } from '@/components/ui';
import { CallWaffle } from '@/components/RuleStrip';
import { GroupHead, MetricTile } from '@/components/tiles';
import { CountUp, MiniBars, Ring } from '@/components/viz';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { AssumptionsPanel, type SettingRow } from './_components/AssumptionsPanel';
import { BudgetSimulator } from './_components/BudgetSimulator';
import { DecisionBoard } from './_components/DecisionBoard';
import { RulesTiles } from './_components/RulesPanel';
import { COLUMNS, isPost, perUnit, type DecideResponse } from './_components/types';

export default function DecidePage() {
  const { askCopilot } = useApp();
  const q = useApi<DecideResponse>(useAsOfUrl('/api/decide'));
  // fetched alongside the board rather than after it, so the assumptions tile is not a second wait
  const settingsQ = useApi<{ settings: SettingRow[] }>('/api/settings');
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  const askButton = (asOf?: string) => (
    <Button
      variant="secondary"
      icon={<Ico icon={MessageSquareTextDuotone} size={18} ia="var(--lac)" ib="var(--lac-pale)" />}
      onClick={() => askCopilot(`Challenge the scale, keep, change and stop calls${asOf ? ` as of ${asOf}` : ''}. Which call is least robust to the assumptions (show-rate, thresholds, attribution), and what evidence would change it?`)}
    >
      Challenge the calls
    </Button>
  );

  if (q.error && !q.data) {
    return (
      <div>
        <PageHeader title="Scale, keep, change or stop" actions={askButton()} />
        <ErrorNote onRetry={q.refresh}>Could not load the decision board: {q.error}</ErrorNote>
      </div>
    );
  }
  if (!q.data) return <DecideSkeleton />;
  const d = q.data;
  const post = isPost(d.phase);
  const recs = d.recommendations;
  const median = recs.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const showRate = d.settings.showRateAssumption;

  // header-row figures
  const totalSpend = d.campaigns.reduce((s, c) => s + c.spend, 0);
  const atRisk = recs.filter((r) => r.decision === 'stop' || r.decision === 'change');
  const atRiskSpend = atRisk.reduce((s, r) => s + Math.max(0, r.spend), 0);
  const atRiskVisitors = atRisk.reduce((s, r) => s + r.visitorsOrExpected, 0);
  const costs = recs.filter((r) => r.efficiency != null && r.spend > 0).map((r) => r.efficiency!).sort((a, b) => a - b);
  const moves = d.reallocations;
  const moved = moves.reduce((s, m) => s + m.amount, 0);
  const t = d.thresholds;
  const points = recs
    .filter((r) => r.ratioToMedian != null && r.spend > 0)
    .map((r) => ({ id: r.campaignId, label: r.name, ratio: r.ratioToMedian!, color: campaignColor(r.campaignId) }));

  return (
    <div>
      <PageHeader
        title="Scale, keep, change or stop"
        lede={
          d.phase === 'pre-launch' ? (
            <>The campaign had not started on {dateLabel(d.asOf, true)}, so there is nothing to decide yet.</>
          ) : (
            <>
              Rule-based calls as of <b className="font-[650] text-ink">{dateLabel(d.asOf, true)}</b>, on {post ? 'verified attendance' : 'expected visitors'}
              {post ? null : (
                <span className="ml-2 inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-[650] text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--stone-2) 0 5px, transparent 5px 9px)' }}>
                  {pct(showRate, 0)} show rate assumed
                </span>
              )}
            </>
          )
        }
        actions={askButton(d.asOf)}
      />
      {q.error ? (
        <div className="mb-3">
          <ErrorNote onRetry={q.refresh}>Could not refresh the board: {q.error}. Showing the last loaded data.</ErrorNote>
        </div>
      ) : null}

      {recs.length ? (
        <>
          {/* header row: the money at stake is the one solid tile (haldi); the rest stay limestone */}
          <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
            <MetricTile
              field="haldi"
              icon={IndianRupeeDuotone}
              title="Spend on Stop and Change"
              label="Net spend on campaigns called Stop or Change"
              delay={0}
              className="min-h-[180px]"
              viz={<Ring value={totalSpend > 0 ? atRiskSpend / totalSpend : 0} track="var(--haldi-track)" arc="var(--ink)" ink="var(--ink)" label={`${pct(totalSpend > 0 ? atRiskSpend / totalSpend : 0, 0)} of net spend`} />}
              value={<CountUp value={atRiskSpend} format={inrShort} />}
              sub={atRisk.length ? `of ${inrShort(totalSpend)} net spend` : 'no campaign to stop or change'}
              foot={<span className="tab whitespace-nowrap">{atRisk.length ? `${num(atRiskVisitors)} ${post ? 'visitors' : 'expected visitors'} from it` : 'Every campaign is Keep or Scale'}</span>}
            />
            <MetricTile
              icon={SlidersHorizontalDuotone}
              ia="var(--ink)"
              ib="var(--stone-3)"
              title="Calls at this date"
              label="Calls at this date"
              delay={40}
              className="min-h-[180px]"
              vizClass="!h-auto !w-[76px]"
              viz={<CallWaffle decisions={recs.map((r) => r.decision)} />}
              value={<CountUp value={atRisk.length} format={num} />}
              sub={atRisk.length === 1 ? 'campaign to change or stop' : 'campaigns to change or stop'}
              foot={COLUMNS.map((k) => [k, recs.filter((r) => r.decision === k).length] as const)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="tab">{n}</span>
                    <StatusPill decision={k} className="h-[22px]" />
                  </span>
                ))}
            />
            <MetricTile
              icon={ChartBarDuotone}
              ia="var(--haldi-track)"
              ib="var(--haldi)"
              title="Median cost"
              label={`Portfolio median cost ${perUnit(d.phase)}`}
              delay={80}
              className="min-h-[180px]"
              wideViz
              vizClass="!h-[40px] !w-[92px] max-[720px]:!h-[40px] max-[720px]:!w-[92px]"
              viz={costs.length ? <MiniBars values={costs} color="var(--ink)" width={92} height={40} gap={3} label="Cost per visitor by paid campaign, cheapest first" /> : null}
              value={median != null ? <CountUp value={median} format={inr} /> : '–'}
              sub={perUnit(d.phase)}
              foot={t.scaleAtOrBelow != null && t.stopAtOrAbove != null ? <span className="tab whitespace-nowrap">Scale ≤ {inr(t.scaleAtOrBelow)}, stop ≥ {inr(t.stopAtOrAbove)}</span> : <span className="text-ink-2">No paid campaign priced yet</span>}
            />
            <MetricTile
              icon={ArrowLeftRightDuotone}
              ia="var(--haldi-track)"
              ib="var(--haldi)"
              title="Suggested budget moves"
              label="Suggested budget moves"
              delay={120}
              className="min-h-[180px]"
              wideViz
              vizClass="!flex !h-[40px] !w-[92px] justify-end max-[720px]:!h-[40px] max-[720px]:!w-[92px] max-[720px]:justify-start"
              viz={moves.length ? <MiniBars values={moves.map((m) => m.amount)} color="var(--haldi)" width={Math.min(92, moves.length * 18)} height={40} gap={4} label="Suggested move amounts" /> : null}
              value={<CountUp value={moved} format={inrShort} />}
              sub={moves.length ? `${moves.length} ${moves.length === 1 ? 'move' : 'moves'}, Stop to Scale` : 'nothing to move at this date'}
              foot={
                <a href="#simulator" className="font-[650] underline decoration-stone-3 underline-offset-2 hover:decoration-ink">
                  Try them in the simulator
                </a>
              }
            />
          </div>

          <GroupHead icon={LayoutGridDuotone} title="The calls" delay={140} className="mt-5" aside={post ? 'On verified visitors' : 'On expected visitors'} />
          <DecisionBoard data={d} onCreateTask={setDraft} />

          <div className="mt-3">
            <RulesTiles data={d} delay={300} />
          </div>
          <div className="mt-3">
            <BudgetSimulator data={d} onCreateTask={setDraft} delay={360} />
          </div>
        </>
      ) : (
        <EmptyState title="No campaign has activity at this date">Move the date on the tape forward to a day after launch to see the calls and the simulator.</EmptyState>
      )}

      <div className="mt-3">
        <AssumptionsPanel q={settingsQ} median={median} perUnit={perUnit(d.phase)} points={points} delay={400} />
      </div>

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function DecideSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the decision board">
      <Skeleton className="mb-2 h-12 w-96 max-w-full bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[180px] rounded-tile-s bg-stone" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 rounded-tile-l bg-stone" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-tile-l bg-stone" />
    </div>
  );
}
