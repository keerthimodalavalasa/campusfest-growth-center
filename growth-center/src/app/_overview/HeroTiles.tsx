'use client';
import type { ReactNode } from 'react';
import { ClipboardListDuotone, ClockDuotone, IndianRupeeDuotone, UserPlusDuotone, UsersDuotone } from 'runeicons-react';
import type { EventDays } from '@/server/engine/eventday';
import { dateLabel, daysBetween, inr, inrShort, num, pct } from '@/lib/format';
import { cx, Delta, Ico, Skeleton, Tile } from '@/components/ui';
import { MetricTile as Mini } from '@/components/tiles';
import { CountUp, Gauge, Ring, Waffle, WaffleKey } from '@/components/viz';
import { GateClock, GateCountdown, gateDayColor } from '@/components/GateClock';
import { share, waffleUnit, type Ctx, type Overview } from './model';

const chip = 'inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[12.5px] leading-none font-[650] whitespace-nowrap';

/* ------------------------------------------------------------------ hero: the North Star */

export function HeroTile({ c }: { c: Ctx }) {
  const { s, mode } = c;
  const T = s.totals;
  const goal = s.target?.visitorsGoal ?? null;
  const pre = mode === 'campaign';
  const value = pre ? (s.projection?.visitors ?? T.expectedVisitors) : T.visitors;
  const counted = pre ? T.expectedVisitors : T.visitors;
  const unit = waffleUnit(Math.max(goal ?? 0, value, 1));
  const total = Math.max(1, Math.ceil(Math.max(goal ?? 0, counted) / unit));
  const filled = Math.min(total, Math.round(counted / unit));
  const projected = pre ? Math.max(0, Math.min(total - filled, Math.round(value / unit) - filled)) : 0;
  const cols = Math.max(10, Math.min(26, Math.round(Math.sqrt(total * 2.2))));
  const gap = goal != null ? goal - value : null;
  const attained = share(value, goal);

  const gapText =
    gap == null ? 'no visitor goal set' : gap > 0 ? `${num(gap)} ${pre ? 'short on pace' : mode === 'event' ? 'to go' : 'short'}` : `${num(-gap)} over goal${pre ? ' on pace' : ''}`;

  return (
    <Tile field="lac" size="hero" delay={0} data-area="hero" aria-label={pre ? 'North star: projected visitors' : 'North star: verified visitors'} className="@container flex flex-col overflow-hidden">
      <div className="flex items-center gap-2">
        <Ico icon={UsersDuotone} size={20} ia="#fff" ib="var(--lac-pale)" />
        <h2 className="text-[15px] leading-[1.3] font-[650]">{pre ? 'Projected visitors' : 'Unique verified visitors'}</h2>
        <span className={cx(chip, 'ml-auto bg-ground text-lac')}>
          {pre ? `${c.daysLeft} ${c.daysLeft === 1 ? 'day' : 'days'} to event` : mode === 'event' ? `Event day ${c.eventDay} of ${c.eventDays}` : 'After the event'}
        </span>
      </div>

      {/* wraps at any width, and the numeral scales with the tile (container units), so nothing runs off the tile */}
      <div className="mt-3.5 mb-[18px] flex flex-wrap items-end gap-x-[18px] gap-y-3">
        <div className="num text-[clamp(72px,24cqi,132px)] leading-[0.8] font-[820] tracking-[-0.025em]">
          <CountUp value={value} format={num} />
        </div>
        {goal != null ? (
          <div className="pb-1">
            <div className="num text-[30px] leading-none">of {num(goal)}</div>
            <div className="mt-1 text-[12.5px] font-[550] text-k2">visitor goal</div>
          </div>
        ) : null}
        <div className="ml-auto pb-1 text-right">
          {attained != null ? (
            <div className="num text-[44px] leading-[0.9] max-[720px]:text-[34px]">
              <CountUp value={attained * 100} format={(n) => `${Math.round(n)}%`} />
            </div>
          ) : null}
          <div className="mt-1 text-[12.5px] font-[550] text-k2">{gapText}</div>
        </div>
      </div>

      <Waffle total={total} filled={filled} projected={projected} cols={cols} className="mt-auto" />

      <div className="mt-3.5 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12.5px] font-[550] text-k2 [&_b]:font-[700] [&_b]:text-white">
        {pre ? (
          <>
            <span className="inline-flex items-center gap-[7px]">
              <WaffleKey kind="filled" />
              <b>{num(counted)}</b> expected today
            </span>
            {projected > 0 ? (
              <span className="inline-flex items-center gap-[7px]">
                <WaffleKey kind="projected" />
                run-rate to {dateLabel(c.eventStart)}
              </span>
            ) : null}
            {gap != null && gap > 0 ? (
              <span className="inline-flex items-center gap-[7px]">
                <WaffleKey kind="hollow" />
                short of goal
              </span>
            ) : null}
            <span className={cx(chip, 'ml-auto bg-transparent text-white shadow-[inset_0_0_0_1.5px_var(--lac-soft)] max-[720px]:ml-0')}>Assumes {pct(T.showRateAssumption, 0)} show rate</span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-[7px]">
              <WaffleKey kind="filled" />
              {unit} visitors
            </span>
            {gap != null && gap > 0 ? (
              <span className="inline-flex items-center gap-[7px]">
                <WaffleKey kind="hollow" />
                <b>{num(gap)}</b> {mode === 'event' ? 'not in yet' : 'short of goal'}
              </span>
            ) : null}
            <span>
              incl. <b>{num(s.excluded.walkInVisitors)}</b> walk-ins
            </span>
          </>
        )}
      </div>
      <p className="sr-only">One dot is {unit} visitors.</p>
    </Tile>
  );
}

/* ------------------------------------------------------------------ attainment: one solid tile per family */

export function Attainment({ c, prev }: { c: Ctx; prev: Overview['previous'] }) {
  const { s, mode } = c;
  const T = s.totals;
  const tg = s.target;
  const P = s.projection;
  const pre = mode === 'campaign';
  const idF = share(T.identified, tg?.identifiedGoal);
  const rgF = share(T.registrations, tg?.registrationGoal);
  const bdF = share(T.spend, tg?.budget);
  const showRate = pre ? T.showRateAssumption : (T.rates.regToVisit ?? 0);
  const prevPost = prev.phase === 'event' || prev.phase === 'post-event';
  const costPerVis = pre ? T.costs.perExpectedVisitor : T.costs.perVisitor;
  const prevCostPerVis = pre ? prev.costPerExpectedVisitor : prevPost ? prev.costPerVisitor : null;
  const ringLabel = (f: number | null, what: string) => (f == null ? `No ${what} set` : `${pct(f, 0)} of ${what}`);
  const goalText = (g: number | null | undefined, money?: boolean) => (g ? `of ${money ? inrShort(g) : num(g)} ${money ? 'budget' : 'goal'}` : money ? 'no budget set' : 'no goal set');

  return (
    <div data-area="att" className="grid min-w-0 grid-cols-2 grid-rows-2 gap-3">
      <Mini
        field="pista"
        icon={UserPlusDuotone}
        title="Identified people"
        label="Identified people"
        delay={40}
        viz={<Ring value={idF ?? NaN} ghost={P && tg ? P.identified / tg.identifiedGoal : null} track="var(--pista-track)" arc="var(--ink)" ink="var(--ink)" ghostColor="#5e8530" label={ringLabel(idF, 'goal')} />}
        value={<CountUp value={T.identified} format={num} />}
        sub={goalText(tg?.identifiedGoal)}
        foot={P ? <>On pace for {num(P.identified)}</> : T.costs.perIdentified != null ? <>{inr(T.costs.perIdentified)} per person</> : <>No one identified yet</>}
      />
      <Mini
        field="nizami"
        icon={ClipboardListDuotone}
        title="Registrations"
        label="Registrations"
        delay={80}
        viz={<Ring value={rgF ?? NaN} ghost={P && tg ? P.registrations / tg.registrationGoal : null} track="var(--nizami-track)" arc="#fff" ink="#fff" ghostColor="#93aeea" label={ringLabel(rgF, 'goal')} />}
        value={<CountUp value={T.registrations} format={num} />}
        sub={goalText(tg?.registrationGoal)}
        foot={
          <>
            <span className="whitespace-nowrap">{T.costs.perRegistration != null ? `${inr(T.costs.perRegistration)} each` : 'No registrations yet'}</span>
            <Delta now={T.costs.perRegistration} prev={prev.costPerRegistration} format={inr} lowerIsBetter />
          </>
        }
      />
      <Mini
        field="stone"
        icon={UsersDuotone}
        ia="var(--lac)"
        ib="var(--lac-pale)"
        title={pre ? 'Show rate, assumed' : 'Show rate'}
        label="Show rate"
        delay={120}
        vizClass="!h-[54px] !w-[92px] max-[720px]:!h-[47px] max-[720px]:!w-20"
        viz={<Gauge value={showRate} assumed={pre} label={`${pct(showRate)} show rate${pre ? ', assumed' : ''}`} />}
        value={<CountUp value={showRate * 100} format={(n) => `${n.toFixed(1)}%`} />}
        sub={pre ? 'planning assumption' : `${num(T.registeredVisitors)} of ${num(T.registrations)} came`}
        foot={
          <span className="text-ink-2">
            {pre ? `${num(T.confirmed)} confirmed so far` : mode === 'event' ? `Day ${c.eventDay} of ${c.eventDays}, gates still open` : `${num(Math.max(0, T.confirmed - T.registeredVisitors))} confirmed, never came`}
          </span>
        }
      />
      <Mini
        field="haldi"
        icon={IndianRupeeDuotone}
        title="Budget used"
        label="Budget used"
        delay={160}
        viz={<Ring value={bdF ?? NaN} ghost={P && tg ? P.spend / tg.budget : null} track="var(--haldi-track)" arc="var(--ink)" ink="var(--ink)" ghostColor="#8c6410" label={ringLabel(bdF, 'budget')} />}
        value={<CountUp value={T.spend} format={inrShort} />}
        sub={goalText(tg?.budget, true)}
        foot={
          <>
            <span className="whitespace-nowrap">{costPerVis != null ? `${inr(costPerVis)} per ${pre ? 'expected ' : ''}visitor` : `No ${pre ? 'expected ' : ''}visitors yet`}</span>
            <Delta now={costPerVis} prev={prevCostPerVis} format={inr} lowerIsBetter />
          </>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ gate: bidri */

function DayRow({ swatch, round, title, sub, value, dim }: { swatch: string; round?: boolean; title: ReactNode; sub: ReactNode; value: ReactNode; dim?: boolean }) {
  return (
    <div className="grid grid-cols-[12px_1fr_auto] items-center gap-2.5 text-[13px] font-[600] text-silver">
      <i aria-hidden className={cx('block size-3', round ? 'rounded-full' : 'rounded-[3px]')} style={{ background: swatch }} />
      <span className="min-w-0">
        {title}
        <small className="block text-[12px] font-[550] text-silver-2">{sub}</small>
      </span>
      <b className={cx('num text-[22px] leading-none', dim ? 'text-silver-2' : 'text-white')}>{value}</b>
    </div>
  );
}

export function GateTile({ c, gate }: { c: Ctx; gate: EventDays | null }) {
  const pre = c.mode === 'campaign';
  const total = daysBetween(c.start, c.eventStart);
  const done = Math.max(0, Math.min(total, daysBetween(c.start, c.asOf) + 1));
  return (
    <Tile field="bidri" delay={200} data-area="gate" aria-label="Arrivals at the gate" className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2">
        <Ico icon={ClockDuotone} size={20} />
        <h2 className="text-[14px] leading-[1.3] font-[650]">Arrivals at the gate</h2>
        {!pre ? <span className="ml-auto text-[12.5px] font-[550] whitespace-nowrap text-silver-2 max-[1200px]:hidden max-[720px]:inline">first entries by hour</span> : null}
      </div>
      <div className="mx-auto mt-[22px] mb-2 w-full max-w-[296px] max-[720px]:max-w-[270px]">
        {pre ? (
          <GateCountdown totalDays={total} doneDays={done} daysLeft={c.daysLeft} className="block h-auto w-full" />
        ) : gate ? (
          <GateClock data={gate} className="block h-auto w-full" />
        ) : (
          <Skeleton className="aspect-square w-full rounded-full bg-bidri-2" />
        )}
      </div>
      <div className="mt-auto grid gap-2 pt-2">
        {pre ? (
          <>
            <DayRow swatch="var(--silver)" title="Campaign days run" sub={`since ${dateLabel(c.start)}`} value={done} />
            <DayRow swatch="var(--lac-bright)" round title="Gates open" sub={`${dateLabel(c.eventStart)}${c.eventDays > 1 ? ` and ${dateLabel(c.eventEnd)}` : ''}`} value={c.gateOpens} />
          </>
        ) : gate ? (
          gate.days.map((d, j) =>
            d.uniqueVisitors > 0 ? (
              <DayRow
                key={d.date}
                swatch={gateDayColor(j)}
                title={`Day ${j + 1}, ${dateLabel(d.date)}`}
                sub={j === 0 ? `peak ${d.peakHour}:00, ${pct(d.manualShare)} manual scans` : `${num(d.newVisitors)} new, ${num(gate.bothDays)} came both days`}
                value={num(d.uniqueVisitors)}
              />
            ) : (
              <DayRow key={d.date} swatch="var(--bidri-3)" title={`Day ${j + 1}, ${dateLabel(d.date)}`} sub={d.date > c.asOf ? (daysBetween(c.asOf, d.date) === 1 ? 'gates open tomorrow' : `gates open ${dateLabel(d.date)}`) : 'no verified entries'} value="0" dim />
            ),
          )
        ) : null}
      </div>
    </Tile>
  );
}
