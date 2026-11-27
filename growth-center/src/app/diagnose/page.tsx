'use client';
import { useState, type CSSProperties } from 'react';
import { ArrowDownRightDuotone, ChartBarDuotone, CircleAlertDuotone, ClipboardListDuotone, FunnelDuotone, Grid3x3Duotone, MessageSquareTextDuotone, ShieldCheckDuotone, UserMinusDuotone, UsersDuotone } from 'runeicons-react';
import type { Diagnosis } from '@/server/engine/diagnose';
import type { Snapshot } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { dateLabel, num, pct } from '@/lib/format';
import { Button, cx, Delta, EmptyState, ErrorNote, Ico, PageHeader, Pips, Skeleton, Table, Td, Th, Tile, TileHead } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { HowThisWorks, MetricTile } from '@/components/tiles';
import { SEV_LEVEL } from '@/components/signals';
import { tipProps } from '@/components/tooltip';
import { CountUp, MiniBars, Ring, StepFunnel, type FunnelLeak, type FunnelStage } from '@/components/viz';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';
import { BottleneckHeatmap } from './_components/BottleneckHeatmap';
import { BottleneckList, SignalGrid } from './_components/Findings';
import { ShowUpDrivers } from './_components/ShowUpDrivers';
import { WeekDrivers } from './_components/WeekDrivers';
import { lostLabel, tidy, windowLabel } from './_components/text';

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
  // the snapshot gives the signal tiles their numbers (rates, projection, goals), as on the Overview
  const ov = useApi<{ snapshot: Snapshot }>(useAsOfUrl('/api/overview'));
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  if (q.error) return <ErrorNote onRetry={q.refresh}>Could not load the diagnosis: {q.error}</ErrorNote>;
  if (!q.data) return <DiagnoseSkeleton />;
  const d = q.data;
  const snap = ov.data?.snapshot ?? null;
  const post = d.phase === 'event' || d.phase === 'post-event';
  const showRateAssumption = typeof meta?.settings.showRateAssumption === 'number' ? meta.settings.showRateAssumption : null;
  const eventDate = meta ? new Date(meta.event.startsAt + 5.5 * 3600 * 1000).toISOString().slice(0, 10) : null;
  const asOfText = dateLabel(d.asOf, true);

  const b = d.biggestDrop && d.biggestDrop.lost > 0 ? d.biggestDrop : null;
  const fromRow = b ? d.funnel.find((f) => f.stage === DROP_STAGE[b.from]) : null;
  const fromCount = b ? (fromRow?.count ?? (b.rate != null && b.rate < 1 ? b.lost / (1 - b.rate) : null)) : null;
  const lostTotal = d.bottlenecks.reduce((s, x) => s + x.visitorsLost, 0);
  const worst = d.bottlenecks[0] ?? null;
  const sevCount = (k: keyof typeof SEV_LEVEL) => d.signals.filter((s) => s.severity === k).length;
  const { totalLast7, totalPrev7 } = d.drivers;

  return (
    <div>
      <PageHeader
        title="Where we lose people"
        lede={
          <>
            As of <b className="font-[650] text-ink">{asOfText}</b>, {PHASE[d.phase]}.
            <span className="ml-2 inline-flex h-[26px] items-center rounded-full px-2.5 text-[12.5px] font-[650] text-ink shadow-[inset_0_0_0_1.5px_var(--stone-3)]">Associations, not proven causes</span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            icon={<Ico icon={MessageSquareTextDuotone} size={18} ia="var(--lac)" ib="var(--lac-pale)" />}
            onClick={() => askCopilot(`Diagnose the funnel as of ${d.asOf}: where we lose the most people, which campaign bottleneck matters most in visitors, and what changed week over week. Keep what the data shows separate from hypotheses about causes.`)}
          >
            Ask the copilot
          </Button>
        }
      />

      {/* header row: the page's lead number on the one solid tile (visitors family), the rest limestone */}
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1">
        <MetricTile
          field="lac"
          icon={UserMinusDuotone}
          ia="#fff"
          ib="var(--lac-pale)"
          title="Biggest drop"
          label="Biggest drop in the people funnel"
          delay={0}
          className="min-h-[180px]"
          viz={b && b.rate != null ? <Ring value={b.rate} track="var(--lac-track)" arc="#fff" ink="#fff" label={`${pct(b.rate)} moved on`} /> : null}
          value={b ? <CountUp value={b.lost} format={num} /> : '0'}
          sub={b ? `lost from ${b.from.toLowerCase()} to ${b.to.charAt(0).toLowerCase()}${b.to.slice(1)}` : 'no one has dropped out yet'}
          foot={b && fromCount != null ? <span className="tab">{num(fromCount)} to {num(fromCount - b.lost)}</span> : <span>Move the date later to see drops</span>}
        />
        <MetricTile
          icon={UsersDuotone}
          ia="var(--lac)"
          ib="var(--lac-pale)"
          title={post ? 'Visitors lost to bottlenecks' : 'Expected visitors lost'}
          label={post ? 'Visitors lost to bottlenecks' : 'Expected visitors lost to bottlenecks'}
          delay={40}
          className="min-h-[180px]"
          wideViz
          vizClass="!top-[20px] !flex !h-[40px] !w-[92px] justify-end max-[720px]:!h-[40px] max-[720px]:!w-[92px] max-[720px]:justify-start"
          viz={d.bottlenecks.length ? <MiniBars values={d.bottlenecks.map((x) => x.visitorsLost)} color="var(--lac)" width={Math.min(92, d.bottlenecks.length * 16)} height={40} gap={4} label="Visitors lost by campaign, worst first" /> : null}
          value={lostLabel(lostTotal)}
          sub={`${d.bottlenecks.length} ${d.bottlenecks.length === 1 ? 'campaign' : 'campaigns'} below portfolio`}
          foot={worst ? <span className="truncate">Worst: {worst.name}, {lostLabel(worst.visitorsLost)}</span> : <span className="text-ink-2">No campaign below portfolio</span>}
        />
        <MetricTile
          icon={CircleAlertDuotone}
          ia="var(--ink)"
          ib="var(--stone-3)"
          title="Signals fired"
          label="Signals fired"
          delay={80}
          className="min-h-[180px]"
          vizClass="!top-[20px] !h-[40px] !w-[64px] max-[720px]:!h-[40px] max-[720px]:!w-[64px]"
          viz={<SeverityBars high={sevCount('high')} medium={sevCount('medium')} low={sevCount('low')} />}
          value={<CountUp value={d.signals.length} format={num} />}
          sub={`${sevCount('high')} high severity`}
          foot={(['high', 'medium', 'low'] as const)
            .filter((k) => sevCount(k) > 0)
            .map((k) => (
              <span key={k} className="mr-2 inline-flex items-center gap-1.5 whitespace-nowrap">
                <Pips level={SEV_LEVEL[k]} />
                {sevCount(k)} {k}
              </span>
            ))}
        />
        <MetricTile
          icon={ClipboardListDuotone}
          ia="var(--nizami)"
          ib="var(--nizami-2)"
          title="Registrations, last 7 days"
          label="Registrations, last 7 days"
          delay={120}
          className="min-h-[180px]"
          vizClass="!top-[20px] !h-[40px] !w-[36px] max-[720px]:!h-[40px] max-[720px]:!w-[36px]"
          viz={<MiniBars values={[totalPrev7, totalLast7]} color="var(--nizami)" width={36} height={40} gap={4} highlightLast label={`${num(totalPrev7)} the week before, ${num(totalLast7)} this week`} />}
          value={<CountUp value={totalLast7} format={num} />}
          sub={`vs ${num(totalPrev7)} the week before`}
          foot={<Delta now={totalLast7} prev={totalPrev7} format={num} colored label="vs the previous 7 days" />}
        />
      </div>

      <div className="mt-3 grid grid-cols-12 gap-3">
        <Tile field="stone" delay={160} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="The people funnel">
          <TileHead icon={FunnelDuotone} aside={b ? `biggest drop: ${num(b.lost)}` : null}>
            The people funnel
          </TileHead>
          <AnonymousStrip d={d} />
          <div className="flex min-h-[250px] flex-1 flex-col max-[720px]:min-h-0">
            <PeopleFunnel d={d} post={post} snap={snap} showRateAssumption={showRateAssumption} />
          </div>
          <ChartData>
            <FunnelTable d={d} post={post} showRateAssumption={showRateAssumption} />
          </ChartData>
          {b?.from === 'Identified' && (d.phase === 'campaign' || d.phase === 'pre-launch') ? (
            <HowThisWorks label="Why this drop is partly timing">
              <p>People identified in the last two weeks may still register. The stage gaps by campaign use only the cohort identified 14 or more days ago.</p>
            </HowThisWorks>
          ) : null}
        </Tile>

        <Tile field="stone" delay={200} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="Stage gaps by campaign">
          <TileHead icon={Grid3x3Duotone} aside="campaign minus portfolio">
            Stage gaps by campaign
          </TileHead>
          <BottleneckHeatmap gaps={d.allStageGaps} post={post} />
          <HowThisWorks>
            <p>Each cell is the campaign&apos;s conversion at that stage minus the portfolio rate for the same stage, in percentage points. The small number is the campaign&apos;s own rate.</p>
            <p>Identified to registered uses only people identified 14 or more days ago, so recent leads are not counted as losses.</p>
            <p>
              {post
                ? `Visitors lost are people lost at the stage carried through the portfolio rates of later stages.${d.phase === 'event' ? ' The event is still running, so confirmed to attended covers only the days so far.' : ''}`
                : `Expected visitors lost carry people lost through the later portfolio rates and the ${showRateAssumption != null ? pct(showRateAssumption) : 'planning'} show-rate assumption.`}
            </p>
          </HowThisWorks>
        </Tile>

        <div className="col-span-5 flex min-w-0 flex-col gap-3 max-[1200px]:col-span-12">
          <Tile field="stone" delay={240} className="flex flex-1 flex-col" aria-label="Bottlenecks ranked by visitors lost">
            <TileHead icon={ArrowDownRightDuotone} aside={`${d.bottlenecks.length} below portfolio`}>
              {post ? 'Bottlenecks, by visitors lost' : 'Bottlenecks, by expected visitors'}
            </TileHead>
            <BottleneckList items={d.bottlenecks} asOf={d.asOf} post={post} onTask={setDraft} onAsk={askCopilot} />
          </Tile>

          <Tile field="stone" delay={320} className="flex flex-col" aria-label="Data quality">
            <TileHead icon={ShieldCheckDuotone} aside="cleaned before any number">
              Data quality
            </TileHead>
            <DataQuality rows={d.dataQuality} />
          </Tile>

        </div>

        <section aria-label="Signals" className="col-span-7 flex min-w-0 flex-col gap-2.5 max-[1200px]:col-span-12">
          <div className="anim-settle flex flex-wrap items-center gap-x-2 gap-y-1.5 px-1 pt-1" style={{ '--d': '260ms' } as CSSProperties}>
            <Ico icon={CircleAlertDuotone} size={20} ia="var(--ink)" ib="var(--stone-3)" />
            <h2 className="text-[14px] font-[650]">Signals</h2>
            <span className="tab inline-grid h-[22px] min-w-6 place-items-center rounded-full bg-ink px-[7px] text-[12px] font-[700] text-white">{d.signals.length}</span>
            <span className="ml-auto text-[12.5px] font-[550] text-ink-2">Highest severity first</span>
          </div>
          <SignalGrid signals={d.signals} ctx={snap} asOf={d.asOf} onTask={setDraft} onAsk={askCopilot} />
        </section>

        <Tile field="stone" delay={280} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="Registrations week over week by campaign">
          <TileHead
            icon={ChartBarDuotone}
            aside={
              <Button size="sm" variant="ghost" onClick={() => askCopilot(`Registrations went from ${totalPrev7} to ${totalLast7} in the 7 days to ${d.asOf}. Which campaigns drove the change, and is it volume or conversion? Separate evidence from hypotheses.`)}>
                Ask why
              </Button>
            }
          >
            Registrations, week over week
          </TileHead>
          <p className="tab mt-0.5 text-[12.5px] font-[550] text-ink-2">{windowLabel(d.drivers.window)}</p>
          <WeekDrivers drivers={d.drivers} post={post} />
        </Tile>

        <Tile field="stone" delay={360} className="col-span-7 max-[1200px]:col-span-12" aria-label="What goes with showing up">
          <TileHead icon={UsersDuotone}>What goes with showing up</TileHead>
          {d.showUpDrivers.length ? (
            <>
              <ShowUpDrivers rows={d.showUpDrivers} />
              <HowThisWorks>
                <p>Show rate of registered external people by group, with final status at the as-of date.{d.phase === 'event' ? ' The event is still running, so these rates cover only the days so far.' : ''}</p>
                <p>These are associations. People who download the programme or ask a question may already be more committed, so the behaviour may signal intent rather than cause attendance. Status groups are definitional: only confirmed people were admitted.</p>
                <p>&ldquo;Beyond chance&rdquo; is a two-proportion test between the highest and lowest group at 95%.</p>
              </HowThisWorks>
            </>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="Attendance does not exist yet at this date"
                action={
                  meta && meta.latestDate > d.asOf ? (
                    <Button size="sm" variant="secondary" onClick={() => setAsOf(meta.latestDate)}>
                      View as of {dateLabel(meta.latestDate, true)}
                    </Button>
                  ) : null
                }
              >
                Show-up drivers appear once verified check-ins exist{eventDate ? `, from ${dateLabel(eventDate, true)}` : ''}. Until then, plans use the {showRateAssumption != null ? pct(showRateAssumption) : ''} show-rate assumption.
              </EmptyState>
            </div>
          )}
        </Tile>
      </div>

      {ov.error ? (
        <div className="mt-3">
          <ErrorNote onRetry={ov.refresh}>Signal tiles are missing some numbers: {ov.error}</ErrorNote>
        </div>
      ) : null}

      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

/** Three rising bars, one per severity, filled by weight (never a new hue). */
function SeverityBars({ high, medium, low }: { high: number; medium: number; low: number }) {
  const max = Math.max(1, high, medium, low);
  const bars = [
    { n: high, fill: 'var(--ink)' },
    { n: medium, fill: 'var(--ink-2)' },
    { n: low, fill: 'var(--stone-3)' },
  ];
  return (
    <svg viewBox="0 0 64 40" width={64} height={40} role="img" aria-label={`${high} high, ${medium} medium, ${low} low severity`} className="block">
      {bars.map((b, i) => {
        const h = b.n ? Math.max(3, (b.n / max) * 40) : 0;
        return <rect key={i} x={i * 22} y={40 - h} width={18} height={h} rx={3} fill={b.fill} />;
      })}
    </svg>
  );
}

/** The anonymous top of the funnel as four compact figures: events and sessions, not people. */
function AnonymousStrip({ d }: { d: Diagnosis }) {
  const top = d.funnel.filter((f) => ['Impressions', 'Clicks', 'Landing-page sessions', 'Registration form starts'].includes(f.stage));
  const short: Record<string, string> = { Impressions: 'Impressions', Clicks: 'Clicks', 'Landing-page sessions': 'Sessions', 'Registration form starts': 'Form starts' };
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-[12px] bg-stone-2 p-1.5" {...tipProps({ title: 'Before people are identified', notes: ['These count anonymous platform events and sessions, not people, so they are not comparable with the people funnel below.'] })} tabIndex={0}>
      {top.map((f) => (
        <div key={f.stage} className="min-w-0 rounded-[9px] px-2 py-1.5">
          <div className="num truncate text-[18px] leading-none">{num(f.count)}</div>
          <div className="mt-1 truncate text-[11.5px] font-[600] text-ink-2">
            {short[f.stage] ?? f.stage}
            {f.rateFromPrev != null ? <span className="tab font-[550]"> {pct(f.rateFromPrev)}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function PeopleFunnel({ d, post, snap, showRateAssumption }: { d: Diagnosis; post: boolean; snap: Snapshot | null; showRateAssumption: number | null }) {
  const count = (stage: string) => d.funnel.find((f) => f.stage === stage)?.count ?? 0;
  const ident = count('Identified external people');
  const reg = count('Registered');
  const conf = count('Confirmed');
  const vis = count('Verified visitors');
  const walkIns = snap?.excluded.walkInVisitors ?? 0;
  const regVisitors = post ? Math.max(0, vis - walkIns) : 0;
  const expected = conf * (showRateAssumption ?? 0);
  const ratio = (a: number, b: number) => (b > 0 ? pct(a / b, 0) : '–');
  const dropTo = d.biggestDrop && d.biggestDrop.lost > 0 ? d.biggestDrop.to : null;
  const lost = (n: number) => ({ label: 'Lost at this step', value: num(n), total: true });

  const stages: FunnelStage[] = [
    { key: 'identified', label: 'Identified', sub: 'distinct people', value: ident, field: 'pista' },
    { key: 'registered', label: 'Registered', sub: `${ratio(reg, ident)} of identified`, value: reg, field: 'nizami' },
    { key: 'confirmed', label: 'Confirmed', sub: `${ratio(conf, reg)} of registered`, value: conf, field: 'nizami2' },
    post
      ? {
          key: 'visitors',
          label: 'Verified visitors',
          sub: walkIns > 0 ? (
            <>
              <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px] bg-sand" />
              {num(walkIns)} walk-ins
            </>
          ) : (
            `${ratio(regVisitors, conf)} of confirmed`
          ),
          value: vis,
          field: 'lac',
          cap: walkIns > 0 ? { value: walkIns, label: `${num(walkIns)} walk-ins`, tip: { title: 'Walk-ins', rows: [{ color: 'var(--sand)', label: 'Came without registering', value: num(walkIns), swatch: 'square' }] } } : undefined,
        }
      : { key: 'visitors', label: 'Expected visitors', sub: `${showRateAssumption != null ? pct(showRateAssumption, 0) : '–'} show rate assumed`, value: expected, field: 'lac', assumed: true },
  ];
  const leaks: FunnelLeak[] = [
    { value: Math.max(0, ident - reg), label: 'never registered', tip: { title: 'Identified but never registered', rows: [lost(Math.max(0, ident - reg))] }, highlight: dropTo === 'Registered' },
    { value: Math.max(0, reg - conf), label: 'not confirmed', tip: { title: 'Registered but not confirmed', rows: [lost(Math.max(0, reg - conf))] }, highlight: dropTo === 'Confirmed' },
    post
      ? { value: Math.max(0, conf - regVisitors), label: 'confirmed, never came', tip: { title: 'Confirmed but did not come', rows: [lost(Math.max(0, conf - regVisitors))] }, highlight: dropTo != null && dropTo.startsWith('Attended') }
      : { value: Math.max(0, conf - expected), label: 'assumed no-shows', tip: { title: 'Confirmed, assumed not to come', rows: [lost(Math.max(0, conf - expected))], notes: ['A planning assumption: the event has not happened.'] } },
  ];
  return <StepFunnel stages={stages} leaks={leaks} format={num} />;
}

function FunnelTable({ d, post, showRateAssumption }: { d: Diagnosis; post: boolean; showRateAssumption: number | null }) {
  const dropTo = d.biggestDrop && d.biggestDrop.lost > 0 ? DROP_STAGE[d.biggestDrop.to] : null;
  const confirmed = d.funnel.find((f) => f.stage === 'Confirmed')?.count ?? null;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Stage</Th>
          <Th align="right">Count</Th>
          <Th align="right">From previous</Th>
          <Th>Note</Th>
        </tr>
      </thead>
      <tbody>
        {d.funnel.map((f) => {
          const isVisitors = f.stage === 'Verified visitors';
          const notYet = isVisitors && !post;
          const expected = notYet && confirmed != null && confirmed > 0 && showRateAssumption != null ? confirmed * showRateAssumption : null;
          return (
            <tr key={f.stage} className={cx(f.stage === dropTo && 'font-[700]')}>
              <Td>
                {f.stage}
                {f.stage === dropTo ? ' (biggest drop)' : ''}
              </Td>
              <Td align="right">{notYet ? (expected != null ? `~${num(expected)} expected` : 'not yet') : num(f.count)}</Td>
              <Td align="right">{f.rateFromPrev != null ? pct(f.rateFromPrev) : '–'}</Td>
              <Td className="text-ink-2">{tidy(f.note)}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** What was cleaned or excluded, as compact figures; each note rides in the tooltip. */
function DataQuality({ rows }: { rows: Diagnosis['dataQuality'] }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-1.5 max-[560px]:grid-cols-1">
      {rows.map((r, i) => {
        const v = typeof r.value === 'number' ? num(r.value) : tidy(r.value);
        const zero = r.value === 0 || r.value === '₹0';
        return (
          <li
            key={r.item}
            tabIndex={0}
            {...tipProps({ title: r.item, notes: [r.note] })}
            className="anim-fade flex min-w-0 flex-col rounded-[12px] bg-stone-2 px-3 py-2.5"
            style={{ '--d': `${340 + i * 30}ms` } as CSSProperties}
          >
            <span className={cx('num text-[24px] leading-none', zero && 'text-ink-2')}>{v}</span>
            <span className="mt-1 text-[12px] leading-[1.3] font-[600] text-ink-2">{r.item}</span>
            <span className="sr-only">{r.note}</span>
          </li>
        );
      })}
    </ul>
  );
}

function DiagnoseSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the diagnosis">
      <Skeleton className="mb-2 h-12 w-[28rem] max-w-full bg-stone" />
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="h-[180px] rounded-tile-s bg-stone" />
        ))}
      </div>
      <div className="grid grid-cols-12 gap-3">
        <Skeleton className="col-span-5 h-[440px] rounded-tile-l bg-stone max-[1200px]:col-span-12" />
        <Skeleton className="col-span-7 h-[440px] rounded-tile-l bg-stone max-[1200px]:col-span-12" />
      </div>
    </div>
  );
}
