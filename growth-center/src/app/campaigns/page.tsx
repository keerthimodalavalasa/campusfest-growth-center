'use client';
import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { ChartAreaDuotone, CircleCheckDuotone, IndianRupeeDuotone, LayoutGridDuotone, PlusDuotone, SlidersHorizontalDuotone, UsersDuotone, WalletDuotone } from 'runeicons-react';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { campaignColor, DECISION, type DecisionKey } from '@/lib/colors';
import { dateLabel, inr, inrShort, num, pct } from '@/lib/format';
import { Button, EmptyState, ErrorNote, Ico, PageHeader, Segmented, Skeleton, StatusPill, Tile, TileHead } from '@/components/ui';
import { CampaignCard } from '@/components/CampaignCard';
import { Legend } from '@/components/charts';
import { CallWaffle, GLYPH, RuleStrip } from '@/components/RuleStrip';
import { tipProps } from '@/components/tooltip';
import { GroupHead, HowThisWorks, MetricTile } from '@/components/tiles';
import { CountUp, Gauge, MiniBars, Ring } from '@/components/viz';
import { CampaignTable } from './_components/CampaignTable';
import { EfficiencyScatter, type ScatterPoint } from './_components/EfficiencyScatter';
import { NewCampaignDialog } from './_components/NewCampaignDialog';
import { isPostEvent, StatusText, times, UNATTRIBUTED, type CampaignsResponse } from './_components/shared';

const ORDER: DecisionKey[] = ['scale', 'keep', 'change', 'stop'];

export default function CampaignsPage() {
  const { meta } = useApp();
  const q = useApi<CampaignsResponse>(useAsOfUrl('/api/campaigns'));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  const decisions = useMemo(() => new Map(q.data?.decisions.recommendations.map((r) => [r.campaignId, r]) ?? []), [q.data]);

  const newButton = (
    <Button variant="primary" icon={<Ico icon={PlusDuotone} size={16} ia="#fff" ib="rgba(255,255,255,0.5)" />} onClick={() => setCreating(true)}>
      New campaign
    </Button>
  );
  const dialog = <NewCampaignDialog open={creating} onClose={() => setCreating(false)} onCreated={(id, name) => setCreated({ id, name })} />;

  if (q.error && !q.data)
    return (
      <div className="space-y-4">
        <PageHeader title="Campaigns" actions={newButton} />
        <ErrorNote onRetry={q.refresh}>Could not load campaign metrics: {q.error}</ErrorNote>
        {dialog}
      </div>
    );
  if (!q.data) return <ListSkeleton />;

  const d = q.data;
  const post = isPostEvent(d.phase);
  const pre = !post;
  const T = d.totals;
  const named = d.campaigns.filter((c) => c.campaignId !== UNATTRIBUTED);
  const walkIns = d.campaigns.find((c) => c.campaignId === UNATTRIBUTED) ?? null;
  const showRate = T.showRateAssumption;
  const th = d.decisions.thresholds;
  const recs = d.decisions.recommendations;
  const median = recs.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const factor = (v: number | null) => (v != null && median ? v / median : null);
  const s = meta?.settings ?? {};
  const f = (k: string, dflt: number) => (typeof s[k] === 'number' ? (s[k] as number) : dflt);
  const factors = { scale: f('scaleCostFactor', 0.8), change: f('changeCostFactor', 1.25), stop: f('stopCostFactor', 2) };
  const cut = Date.parse(`${d.asOf}T23:59:59.999+05:30`);
  const target = [...(meta?.targets ?? [])].filter((t) => t.effectiveAt <= cut).pop() ?? null;

  const cpvOf = (m: (typeof named)[number]) => (pre ? m.costs.perExpectedVisitor : m.costs.perVisitor);
  const visShare = (m: (typeof named)[number]) => (pre ? (T.expectedVisitors > 0 ? m.expectedVisitors / T.expectedVisitors : 0) : (m.shares.visitors ?? 0));
  const sorted = [...named].sort((a, b) => (cpvOf(a) ?? Infinity) - (cpvOf(b) ?? Infinity));
  const maxShare = Math.max(0.01, ...named.flatMap((m) => [m.shares.spend ?? 0, visShare(m)]));
  const totalCpv = pre ? T.costs.perExpectedVisitor : T.costs.perVisitor;
  const visitors = pre ? T.expectedVisitors : T.visitors;
  const counts = ORDER.map((k) => [k, recs.filter((r) => r.decision === k).length] as const);
  const toAct = recs.filter((r) => r.decision === 'change' || r.decision === 'stop').length;

  const points: ScatterPoint[] = recs
    .filter((r) => r.efficiency != null && Number.isFinite(r.efficiency))
    .map((r) => ({ id: r.campaignId, name: r.name, x: r.efficiency!, y: r.visitorsOrExpected, spend: r.spend }));
  const unplotted = named.filter((c) => !points.some((p) => p.id === c.campaignId));

  return (
    <div>
      <PageHeader
        title="Campaigns"
        lede={
          <>
            <span className="tab font-[650] text-ink">{named.length}</span> campaigns as of {dateLabel(d.asOf, true)}
            {pre ? (
              <span className="ml-2 inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-[650] text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, var(--stone-2) 0 5px, transparent 5px 9px)' }}>
                Visitors are expected, {pct(showRate, 0)} show rate assumed
              </span>
            ) : null}
          </>
        }
        actions={newButton}
      />

      {created ? (
        <div role="status" className="field-stone mb-3 flex flex-wrap items-center gap-3 rounded-tile-m px-4 py-3 text-[13.5px]">
          <Ico icon={CircleCheckDuotone} size={20} ia="var(--st-scale)" ib="color-mix(in srgb, var(--st-scale) 35%, transparent)" />
          <span className="min-w-0 flex-1">
            Created <b className="font-[650]">{created.name}</b> ({created.id}). Numbers appear once spend or sign-ups are recorded.
          </span>
          <Link href={`/campaigns/${created.id}`} className="font-[650] underline decoration-stone-3 underline-offset-2 hover:decoration-ink">
            Open {created.name}
          </Link>
          <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}

      {named.length === 0 ? (
        <EmptyState title="No campaigns yet" action={newButton}>
          Create a campaign to start tracking its spend, sign-ups and visitors.
        </EmptyState>
      ) : (
        <>
          {/* header row: one solid family tile (money), the rest limestone */}
          <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
            <MetricTile
              field="haldi"
              icon={IndianRupeeDuotone}
              title={pre ? 'Cost per expected visitor' : 'Cost per visitor'}
              label={pre ? 'Cost per expected visitor' : 'Cost per visitor'}
              delay={0}
              className="min-h-[180px]"
              wideViz
              vizClass="!top-[20px] !h-[40px] !w-[92px] max-[720px]:!h-[40px] max-[720px]:!w-[92px]"
              viz={<MiniBars values={sorted.map((m) => cpvOf(m) ?? 0)} color="var(--ink)" width={92} height={40} gap={3} label={`Cost per ${pre ? 'expected ' : ''}visitor by campaign, cheapest first`} />}
              value={totalCpv != null ? <CountUp value={totalCpv} format={inr} /> : '–'}
              sub="all campaigns, net spend"
              foot={<span className="whitespace-nowrap">Median campaign {inr(median)}</span>}
            />
            <MetricTile
              icon={WalletDuotone}
              ia="var(--haldi-track)"
              ib="var(--haldi)"
              title="Net spend"
              label="Net spend"
              delay={40}
              className="min-h-[180px]"
              viz={<Ring value={target ? T.spend / target.budget : NaN} track="var(--stone-2)" arc="var(--haldi)" ink="var(--ink)" label={target ? `${pct(T.spend / target.budget, 0)} of budget` : 'No budget set'} />}
              value={<CountUp value={T.spend} format={inrShort} />}
              sub={target ? `of ${inrShort(target.budget)} budget` : 'no budget set'}
              foot={<span className="whitespace-nowrap">{inr(T.costs.perRegistration)} per registration</span>}
            />
            <MetricTile
              icon={UsersDuotone}
              ia="var(--lac)"
              ib="var(--lac-pale)"
              title={pre ? 'Expected visitors' : 'Verified visitors'}
              label={pre ? 'Expected visitors' : 'Verified visitors'}
              delay={80}
              className="min-h-[180px]"
              wideViz
              vizClass="!top-[18px] !h-[54px] !w-[92px] max-[720px]:!h-[47px] max-[720px]:!w-20"
              viz={<Gauge value={pre ? showRate : (T.rates.regToVisit ?? 0)} assumed={pre} label={pre ? `${pct(showRate)} show rate, assumed` : `${pct(T.rates.regToVisit)} of registrants came`} />}
              value={<CountUp value={visitors} format={num} />}
              sub={pre ? `confirmed × ${pct(showRate, 0)} assumed` : `${pct(T.rates.regToVisit)} of registrants came`}
              foot={<span className="text-ink-2">{pre ? `${num(T.confirmed)} confirmed so far` : `Includes ${num(walkIns?.visitors ?? 0)} walk-ins`}</span>}
            />
            <MetricTile
              icon={SlidersHorizontalDuotone}
              ia="var(--ink)"
              ib="var(--stone-3)"
              title="Calls at this date"
              label="Calls at this date"
              delay={120}
              className="min-h-[180px]"
              vizClass="!h-auto !w-[76px]"
              viz={<CallWaffle decisions={recs.map((r) => r.decision)} />}
              value={toAct}
              sub={toAct === 1 ? 'campaign to change or stop' : 'campaigns to change or stop'}
              foot={counts
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <span className="tab">{n}</span>
                    <StatusPill decision={k} className="h-[22px]" />
                  </span>
                ))}
            />
          </div>

          <GroupHead icon={LayoutGridDuotone} title="Every campaign" delay={160} className="mt-5">
            <Segmented
              label="Show campaigns as"
              value={view}
              onChange={setView}
              className="bg-stone"
              options={[
                { value: 'cards', label: 'Cards' },
                { value: 'table', label: 'Table' },
              ]}
            />
            <span className="ml-auto text-[12.5px] font-[550] text-ink-2">{view === 'cards' ? 'Cheapest visitor first' : 'Select a header to sort'}</span>
          </GroupHead>

          {view === 'cards' ? (
            <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
              {sorted.map((m, i) => (
                <CampaignCard
                  key={m.campaignId}
                  m={m}
                  rec={decisions.get(m.campaignId)}
                  pre={pre}
                  visitorShare={visShare(m)}
                  maxShare={maxShare}
                  delay={180 + i * 40}
                  meta={
                    <span className="flex flex-wrap items-center gap-x-2">
                      <StatusText status={m.status} />
                      <span className="truncate">{m.ownerName ?? 'Unassigned'}</span>
                    </span>
                  }
                />
              ))}
              {walkIns && (walkIns.visitors > 0 || walkIns.identified > 0) ? (
                <Link
                  href={`/campaigns/${UNATTRIBUTED}`}
                  className="anim-settle field-stone relative flex min-w-0 flex-col overflow-hidden rounded-tile-m px-4 pb-4 transition-[filter] duration-150 hover:brightness-[0.97]"
                  style={{ '--d': `${180 + sorted.length * 40}ms` } as CSSProperties}
                >
                  <div aria-hidden className="-mx-4 mb-3.5 h-2 bg-sand" />
                  <span className="text-[14px] leading-[1.3] font-[650]">Walk-ins and unattributed</span>
                  <span className="mt-1 text-[12.5px] font-[550] text-ink-2">Not bought, so no call</span>
                  <span className="num mt-3.5 text-[34px] leading-[0.9]">{num(post ? walkIns.visitors : walkIns.identified)}</span>
                  <small className="mt-1 text-[12px] font-[550] text-ink-2">{post ? 'verified visitors with no campaign' : 'people identified with no campaign'}</small>
                  {post && walkIns.shares.visitors != null ? <small className="mt-auto pt-3 text-[12.5px] font-[600] text-ink-2">{pct(walkIns.shares.visitors)} of all visitors</small> : null}
                </Link>
              ) : null}
            </div>
          ) : (
            <Tile field="stone" className="anim-settle">
              <CampaignTable campaigns={d.campaigns} totals={d.totals} post={post} decisions={decisions} showRate={showRate} />
              <HowThisWorks>
                <p>The all-campaigns row includes walk-ins and unattributed people, so it is not the average of the campaign rows.</p>
                <p>Rates are shares of the stage before. Costs use net spend: platform spend after refunds and credits.</p>
              </HowThisWorks>
            </Tile>
          )}

          <div className="mt-3 grid grid-cols-12 gap-3">
            <Tile field="stone" delay={260} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="Cost per visitor against visitors">
              <TileHead icon={ChartAreaDuotone} aside={`median ${inr(median)}`}>
                {post ? 'What each visitor cost' : 'What each expected visitor costs'}
              </TileHead>
              {points.length ? (
                <>
                  <EfficiencyScatter points={points} scaleAt={th.scaleAtOrBelow} stopAt={th.stopAtOrAbove} post={post} />
                  <Legend className="mt-1" items={points.map((p) => ({ label: p.name, color: campaignColor(p.id) }))} />
                  {unplotted.length ? <p className="mt-2 text-[12.5px] text-ink-2">Not plotted, no {post ? 'visitors' : 'confirmed registrants'} yet: {unplotted.map((c) => c.name).join(', ')}.</p> : null}
                  <HowThisWorks>
                    <p>Each dot is a campaign. Up and to the left is better: more {post ? 'visitors' : 'expected visitors'} at a lower cost each.</p>
                    <p>
                      The scale line sits at {times(factor(th.scaleAtOrBelow))} the portfolio median of {inr(median)}, the stop line at {times(factor(th.stopAtOrAbove))}. Guardrails on opt-outs, cancellations{post ? ' and show-up' : ' and momentum'} can still turn a cheap dot into a Change call.
                    </p>
                    {pre ? <p>Expected visitors are confirmed registrants × the {pct(showRate, 0)} show-rate assumption, not observed attendance.</p> : null}
                  </HowThisWorks>
                </>
              ) : (
                <EmptyState title="Nothing to plot yet">No campaign has both spend and {post ? 'visitors' : 'confirmed registrants'} at this date.</EmptyState>
              )}
            </Tile>

            <Tile field="stone" delay={300} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="The calls">
              <TileHead
                icon={SlidersHorizontalDuotone}
                aside={
                  <Link href="/decide" className="font-[650] text-ink underline decoration-stone-3 underline-offset-2 hover:decoration-ink">
                    Open Decide
                  </Link>
                }
              >
                Where each call falls
              </TileHead>
              {recs.length ? (
                <>
                  <RuleStrip
                    className="mt-4"
                    factors={factors}
                    median={median}
                    points={recs
                      .filter((r) => r.ratioToMedian != null && r.spend > 0)
                      .map((r) => ({
                        id: r.campaignId,
                        label: r.name,
                        ratio: r.ratioToMedian!,
                        color: campaignColor(r.campaignId),
                        tip: { title: r.name, rows: [{ color: campaignColor(r.campaignId), label: post ? 'Cost per visitor' : 'Cost per expected visitor', value: inr(r.efficiency), swatch: 'square' }, { label: 'Against median', value: times(r.ratioToMedian) }], notes: [<>Call: <b>{DECISION[r.decision].label}</b></>] },
                      }))}
                  />
                  <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] max-[560px]:grid-cols-1">
                    {[...recs]
                      .sort((a, b) => ORDER.indexOf(a.decision) - ORDER.indexOf(b.decision) || (a.ratioToMedian ?? 0) - (b.ratioToMedian ?? 0))
                      .map((r) => (
                        <li key={r.campaignId} className="flex min-w-0 items-center gap-2">
                          <Ico icon={GLYPH[r.decision]} size={14} ia={DECISION[r.decision].fg} ib={DECISION[r.decision].fg} />
                          <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(r.campaignId) }} />
                          <Link href={`/campaigns/${r.campaignId}`} className="min-w-0 truncate font-[600] hover:underline">
                            {r.name}
                          </Link>
                          <span className="sr-only">: {DECISION[r.decision].label}</span>
                          <span className="tab ml-auto text-ink-2">{r.spend > 0 ? times(r.ratioToMedian) : 'no spend'}</span>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-[13.5px] text-ink-2">No campaign has enough activity for a call at this date.</p>
              )}

              {d.decisions.reallocations.length ? (
                <div className="mt-4 pt-3.5 shadow-[inset_0_1px_0_var(--stone-2)]">
                  <h3 className="flex items-center gap-2 text-[13.5px] font-[650]">
                    <Ico icon={IndianRupeeDuotone} size={18} ia="var(--haldi-track)" ib="var(--haldi)" />
                    Suggested budget moves
                  </h3>
                  <ul className="mt-2.5 grid gap-2.5">
                    {d.decisions.reallocations.map((mv, i) => {
                      const maxMove = Math.max(...d.decisions.reallocations.map((x) => x.amount));
                      const name = (id: string) => d.campaigns.find((c) => c.campaignId === id)?.name ?? id;
                      return (
                        <li key={i} {...tipProps({ title: 'Budget move', notes: [mv.rationale] })} tabIndex={0} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-md">
                          <span className="num text-[20px] leading-none">{inrShort(mv.amount)}</span>
                          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] font-[600]">
                            <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(mv.from) }} />
                            <span className="truncate">{name(mv.from)}</span>
                            <span aria-hidden className="text-ink-2">→</span>
                            <span className="sr-only">to</span>
                            <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(mv.to) }} />
                            <span className="truncate">{name(mv.to)}</span>
                          </span>
                          <span aria-hidden className="col-start-2 block h-1.5 rounded-r-[3px] bg-haldi" style={{ width: `${(mv.amount / maxMove) * 100}%` }} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <HowThisWorks className="mt-auto pt-3">
                <p>{d.decisions.basis}</p>
                <p>
                  Scale at or below {inr(th.scaleAtOrBelow)} ({times(factor(th.scaleAtOrBelow))} the median), change above {inr(th.changeAbove)} ({times(factor(th.changeAbove))}), stop at or above {inr(th.stopAtOrAbove)} ({times(factor(th.stopAtOrAbove))}).
                </p>
              </HowThisWorks>
            </Tile>
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading campaigns">
      <Skeleton className="mb-2 h-12 w-80 bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-[180px] rounded-tile-s bg-stone" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <Skeleton key={k} className="h-[220px] rounded-tile-m bg-stone" />
        ))}
      </div>
    </div>
  );
}
