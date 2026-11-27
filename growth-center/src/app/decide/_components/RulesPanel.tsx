'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ChartAreaDuotone, CheckDuotone, ShieldCheckDuotone } from 'runeicons-react';
import { campaignColor, DECISION, type DecisionKey } from '@/lib/colors';
import { inr, pct } from '@/lib/format';
import { Ico, Table, Td, Th, Tile, TileHead } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { GLYPH } from '@/components/RuleStrip';
import { HowThisWorks } from '@/components/tiles';
import { tipProps } from '@/components/tooltip';
import { useElementWidth } from '@/components/viz';
import { isPost, perUnit, ratioLabel, tidy, type DecideResponse, type Recommendation } from './types';

/** The rule book beside the board: where each paid campaign's cost sits against the bands, and the guardrails. */
export function RulesTiles({ data, delay = 0 }: { data: DecideResponse; delay?: number }) {
  const med = data.recommendations.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  return (
    <div className="grid grid-cols-12 gap-3">
      <Tile field="stone" delay={delay} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="Cost per visitor against the rules">
        <TileHead icon={ChartAreaDuotone} aside={med != null ? `median ${inr(med)}` : 'no median yet'}>
          {isPost(data.phase) ? 'Cost per visitor, against the rules' : 'Cost per expected visitor, against the rules'}
        </TileHead>
        <CostPlot data={data} />
        <HowThisWorks label="How each call is made">
          <p>{tidy(data.basis)}</p>
          <p>Thresholds are multiples of the portfolio median, so they move with the data. Campaigns with no paid spend are judged on the guardrails only.</p>
          {data.notes.map((n) => (
            <p key={n}>{tidy(n)}</p>
          ))}
        </HowThisWorks>
      </Tile>
      <Guardrails data={data} delay={delay + 40} />
    </div>
  );
}

interface PlotRow {
  rec: Recommendation;
  eff: number;
}

/**
 * Dot plot: one row per paid campaign, cheapest first, on a cost axis split into the four call zones. The zones
 * are neutral washes labelled with the status glyph and word; the status colour lives on the boundary lines only.
 */
function CostPlot({ data }: { data: DecideResponse }) {
  const [ref, width] = useElementWidth<HTMLElement>();
  const t = data.thresholds;
  const rows: PlotRow[] = data.recommendations
    .filter((r) => r.efficiency != null && r.spend > 0)
    .map((r) => ({ rec: r, eff: r.efficiency! }))
    .sort((a, b) => a.eff - b.eff);
  const unit = perUnit(data.phase);
  if (!rows.length || t.scaleAtOrBelow == null || t.changeAbove == null || t.stopAtOrAbove == null) {
    return <p className="mt-3 text-[13.5px] text-ink-2">No paid campaign has a cost {unit} at this date, so there is nothing to plot.</p>;
  }
  const { scaleAtOrBelow: sc, changeAbove: ch, stopAtOrAbove: st } = t;
  const med = rows[0].rec.portfolioMedian;
  const hiEff = Math.max(...rows.map((r) => r.eff));
  // a data edit can make one campaign's cost explode; past 4× the stop line, switch to a log axis
  const log = hiEff > st * 4;
  const lo = log ? Math.min(rows[0].eff, sc) * 0.7 : 0;
  const hi = log ? hiEff * 1.3 : Math.max(st * 1.5, hiEff * 1.12);
  const at = (x: number) => {
    const v = Math.min(Math.max(x, lo), hi);
    return log ? ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100 : ((v - lo) / (hi - lo)) * 100;
  };
  const zones: { key: DecisionKey; from: number; to: number; wash: boolean }[] = [
    { key: 'scale', from: lo, to: sc, wash: true },
    { key: 'keep', from: sc, to: ch, wash: false },
    { key: 'change', from: ch, to: st, wash: false },
    { key: 'stop', from: st, to: hi, wash: true },
  ];
  const lines: { x: number; color: string; label: string; sub: string; prio: number }[] = [
    { x: st, color: 'var(--st-stop)', label: inr(st), sub: `${data.settings.stopCostFactor}×`, prio: 0 },
    { x: sc, color: 'var(--st-scale)', label: inr(sc), sub: `${data.settings.scaleCostFactor}×`, prio: 1 },
    { x: ch, color: 'var(--st-change)', label: inr(ch), sub: `${data.settings.changeCostFactor}×`, prio: 2 },
  ];
  // the plot area is the track column: the whole width less the label gutter
  const gutter = width && width < 520 ? 104 : 150;
  const valueW = width && width < 520 ? 52 : 96;
  const plotW = Math.max(0, width - gutter - valueW);
  // axis labels: place by priority, drop any that would touch one already placed
  const placed: number[] = [];
  const axis = [...lines, ...(med != null ? [{ x: med, color: 'var(--ink-2)', label: inr(med), sub: 'median', prio: 3 }] : [])]
    .sort((a, b) => a.prio - b.prio)
    .filter((l) => {
      const px = (at(l.x) / 100) * plotW;
      if (placed.some((p) => Math.abs(p - px) < 46)) return false;
      placed.push(px);
      return true;
    });

  return (
    <figure ref={ref} className="mt-4 min-w-0">
      <figcaption className="sr-only">
        Cost {unit} for each paid campaign against the call zones: scale at or below {inr(sc)}, change above {inr(ch)}, stop at or above {inr(st)}. Exact numbers are in View data.
      </figcaption>
      {/* zone header: limestone steps with the status glyph and word */}
      <div className="grid" style={{ gridTemplateColumns: `${gutter}px minmax(0,1fr) ${valueW}px` }}>
        <span />
        <div className="flex h-7 gap-[2px] overflow-hidden rounded-[8px]">
          {zones.map((z) => {
            const w = at(z.to) - at(z.from);
            const fits = (w / 100) * plotW >= DECISION[z.key].label.length * 7 + 26;
            return (
              <div key={z.key} className="flex min-w-0 items-center justify-center gap-1 bg-stone-2 text-[12px] font-[700] whitespace-nowrap text-ink-2" style={{ width: `${w}%` }}>
                <Ico icon={GLYPH[z.key]} size={14} ia={DECISION[z.key].fg} ib={DECISION[z.key].fg} />
                {fits ? DECISION[z.key].label : <span className="sr-only">{DECISION[z.key].label}</span>}
              </div>
            );
          })}
        </div>
        <span />
      </div>

      <div className="relative mt-1.5 grid" style={{ gridTemplateColumns: `${gutter}px minmax(0,1fr) ${valueW}px` }}>
        {/* washes and boundary lines, behind the rows */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: gutter, right: valueW }}>
          {zones
            .filter((z) => z.wash)
            .map((z) => (
              <div key={z.key} className="absolute inset-y-0 bg-stone-2/70" style={{ left: `${at(z.from)}%`, width: `${at(z.to) - at(z.from)}%` }} />
            ))}
          {lines.map((l) => (
            <div key={l.label} className="absolute inset-y-0 w-[1.5px] -translate-x-1/2" style={{ left: `${at(l.x)}%`, background: l.color }} />
          ))}
          {med != null ? <div className="absolute inset-y-0 -translate-x-1/2 border-l border-dashed border-ink-2" style={{ left: `${at(med)}%` }} /> : null}
        </div>

        {rows.map(({ rec, eff }, i) => {
          const color = campaignColor(rec.campaignId);
          const x = at(eff);
          return (
            <div key={rec.campaignId} className="contents">
              <Link href={`/campaigns/${rec.campaignId}`} className="relative flex h-9 min-w-0 items-center gap-2 pr-3 text-[12.5px] font-[600] hover:underline">
                <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
                <span className="truncate">{rec.name}</span>
              </Link>
              <div className="relative h-9">
                <i aria-hidden className="anim-grow-x absolute top-1/2 left-0 block h-[1.5px] -translate-y-1/2 bg-stone-3" style={{ width: `${x}%`, '--d': `${260 + i * 40}ms` } as CSSProperties} />
                <span
                  tabIndex={0}
                  aria-label={`${rec.name}: ${inr(eff)} ${unit}, ${ratioLabel(rec.ratioToMedian)} the median, ${DECISION[rec.decision].label}`}
                  {...tipProps({
                    title: rec.name,
                    rows: [
                      { color, label: `Cost ${unit}`, value: inr(eff), swatch: 'square' },
                      { label: 'Against median', value: ratioLabel(rec.ratioToMedian) },
                    ],
                    notes: [
                      <>
                        Call: <b>{DECISION[rec.decision].label}</b>
                      </>,
                    ],
                  })}
                  className="anim-fade absolute top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-default rounded-full shadow-[0_0_0_2px_var(--stone)] transition-transform duration-150 hover:scale-125 focus-visible:scale-125"
                  style={{ left: `${x}%`, background: color, '--d': `${320 + i * 40}ms` } as CSSProperties}
                />
              </div>
              <span aria-hidden className="tab flex h-9 items-center justify-end gap-1.5 text-[12px] font-[750] whitespace-nowrap text-ink">
                {inr(eff)}
                <span className="font-[550] text-ink-2 max-[520px]:hidden">{ratioLabel(rec.ratioToMedian)}</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* axis: the three boundaries (and the median when it has room), in rupees and as multiples */}
      <div className="grid" style={{ gridTemplateColumns: `${gutter}px minmax(0,1fr) ${valueW}px` }}>
        <span />
        <div className="relative h-9 border-t-[1.5px] border-stone-3">
          {axis.map((l) => (
            <span key={l.sub} className="tab absolute top-1 flex -translate-x-1/2 flex-col items-center text-[11.5px] leading-[1.25] whitespace-nowrap" style={{ left: `${at(l.x)}%` }}>
              <b className="font-[700] text-ink">{l.label}</b>
              <span className="font-[550] text-ink-2">{l.sub}</span>
            </span>
          ))}
        </div>
        <span />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-[550] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="flex gap-[3px]">
            <i className="block h-3 w-[1.5px] bg-st-scale" />
            <i className="block h-3 w-[1.5px] bg-st-change" />
            <i className="block h-3 w-[1.5px] bg-st-stop" />
          </span>
          Boundaries, in rupees and × median
        </span>
        {med != null ? (
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="block h-3 border-l border-dashed border-ink-2" />
            Median <span className="tab font-[650] text-ink">{inr(med)}</span>
          </span>
        ) : null}
      </div>
      {log ? <p className="mt-1 text-[12px] font-[550] text-ink-2">Log scale: one campaign costs far more than the rest.</p> : null}

      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Campaign</Th>
              <Th align="right">Cost {unit}</Th>
              <Th align="right">Against median</Th>
              <Th>Call</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rec, eff }) => (
              <tr key={rec.campaignId}>
                <Td>{rec.name}</Td>
                <Td align="right">{inr(eff)}</Td>
                <Td align="right">{ratioLabel(rec.ratioToMedian)}</Td>
                <Td>{DECISION[rec.decision].label}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </figure>
  );
}

/** The quality guardrails, each with its limit as the numeral and the campaigns failing it. */
function Guardrails({ data, delay }: { data: DecideResponse; delay: number }) {
  const s = data.settings;
  const post = isPost(data.phase);
  const guards = [
    { rule: 'Opt-out guardrail', limit: pct(s.maxOptOutRate), label: 'Opt-out rate ceiling', scope: '30+ identified people' },
    { rule: 'Cancellation guardrail', limit: `+${s.maxCancelRateGapPts}`, unit: 'pts', label: 'Cancellations over portfolio', scope: '30+ registrations' },
    post
      ? { rule: 'Show-up quality', limit: '−10', unit: 'pts', label: 'Show-up under portfolio', scope: '30+ registrations' }
      : { rule: 'Momentum', limit: pct(s.momentumDropRatio, 0), label: 'Sign-ups vs the week before', scope: '10+ sign-ups, still spending' },
  ];
  return (
    <Tile field="stone" delay={delay} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="Guardrails">
      <TileHead icon={ShieldCheckDuotone} aside="any fail means Change">
        Guardrails
      </TileHead>
      <ul className="mt-3.5 grid gap-2">
        {guards.map((g) => {
          const checked = data.recommendations.filter((r) => r.checks.some((k) => k.rule === g.rule));
          const failing = checked.filter((r) => r.checks.some((k) => k.rule === g.rule && !k.passed));
          return (
            <li key={g.rule} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-tile-m bg-stone-2/60 px-3.5 py-3 max-[420px]:grid-cols-[76px_minmax(0,1fr)]">
              <span className="num text-[30px] leading-[0.9]">
                {g.limit}
                {g.unit ? <small className="ml-0.5 text-[15px]">{g.unit}</small> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] leading-[1.3] font-[650]">{g.label}</span>
                <span className="block text-[12px] font-[550] text-ink-2">
                  {g.scope}, <span className="tab">{checked.length}</span> checked
                </span>
              </span>
              <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-1">
                {failing.length ? (
                  failing.map((r) => (
                    <span key={r.campaignId} className="inline-flex h-[22px] items-center gap-1.5 rounded-full bg-ground pr-2 pl-1.5 text-[11.5px] font-[650]">
                      <i aria-hidden className="block size-2.5 rounded-[3px]" style={{ background: campaignColor(r.campaignId) }} />
                      {r.name}
                      <span className="ml-0.5 inline-flex items-center gap-0.5 font-[600] text-ink-2">
                        <Ico icon={GLYPH[r.decision]} size={12} ia={DECISION[r.decision].fg} ib={DECISION[r.decision].fg} />
                        {DECISION[r.decision].label}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1 text-[12px] font-[600] text-ink-2">
                    <Ico icon={CheckDuotone} size={14} ia="var(--ink)" ib="var(--ink)" />
                    {checked.length ? 'Every checked campaign passes' : 'No campaign has enough data yet'}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto pt-3 text-[12.5px] font-[550] text-ink-2">
        No paid spend: judged on guardrails only.{' '}
        <a href="#assumptions" className="font-[650] text-ink underline decoration-stone-3 underline-offset-2 hover:decoration-ink">
          Edit the limits
        </a>
      </p>
    </Tile>
  );
}
