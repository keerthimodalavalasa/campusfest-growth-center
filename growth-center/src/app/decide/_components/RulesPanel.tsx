'use client';
import { CartesianGrid, LabelList, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { DECISION, campaignColor } from '@/lib/colors';
import { dateLabel, inr, pct } from '@/lib/format';
import { Panel } from '@/components/ui';
import { axisProps, ChartTip, gridProps } from '@/components/charts';
import { isPost, perUnit, ratioLabel, tidy, type Decision, type DecideResponse } from './types';

/** The rule book above the board: basis, thresholds, guardrails and where each paid campaign sits. */
export function RulesPanel({ data }: { data: DecideResponse }) {
  const s = data.settings;
  const t = data.thresholds;
  const med = data.recommendations.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const post = isPost(data.phase);

  return (
    <Panel title="How each call is made" aside={`as of ${dateLabel(data.asOf, true)}`}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0 space-y-4">
          <p className="text-[0.9rem] text-ink-2">{tidy(data.basis)}</p>
          {med == null ? (
            <p className="text-[0.88rem] text-ink-2">No paid campaign has an efficiency figure at this date, so there is no median and no cost thresholds. Calls rest on the guardrails only.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Threshold label="Portfolio median" value={inr(med)} sub={perUnit(data.phase)} />
              <Threshold decision="scale" label="Scale at or below" value={inr(t.scaleAtOrBelow)} sub={`${s.scaleCostFactor}× the median`} />
              <Threshold decision="change" label="Change above" value={inr(t.changeAbove)} sub={`${s.changeCostFactor}× the median`} />
              <Threshold decision="stop" label="Stop at or above" value={inr(t.stopAtOrAbove)} sub={`${s.stopCostFactor}× the median`} />
            </dl>
          )}
          <div className="text-[0.84rem] text-ink-2">
            <p className="font-medium text-ink">Any failed guardrail moves a campaign to Change, whatever its cost:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 marker:text-ink-3">
              <li>
                Opt-out rate above <span className="num font-medium text-ink">{pct(s.maxOptOutRate)}</span> (30+ identified people)
              </li>
              <li>
                Cancellation rate more than <span className="num font-medium text-ink">{s.maxCancelRateGapPts} pts</span> above the portfolio (30+ registrations)
              </li>
              {post ? (
                <li>Share of registrants who attended more than 10 pts below the portfolio (30+ registrations)</li>
              ) : (
                <li>
                  Registrations in the last 7 days below <span className="num font-medium text-ink">{pct(s.momentumDropRatio)}</span> of the previous 7 days while still spending (10+ registrations in the earlier week)
                </li>
              )}
            </ul>
            <p className="mt-2 text-ink-3">
              Campaigns with no paid spend are judged on guardrails only.{' '}
              <a href="#assumptions" className="font-medium text-sagar hover:underline">
                Edit the factors
              </a>
            </p>
          </div>
        </div>
        <EfficiencyPlot data={data} />
      </div>
    </Panel>
  );
}

function Threshold({ label, value, sub, decision }: { label: string; value: string; sub: string; decision?: Decision }) {
  return (
    <div className="min-w-0 border-l-2 pl-2.5" style={{ borderColor: decision ? DECISION[decision].fg : 'var(--line-2)' }}>
      <dt className="text-[0.8rem] text-ink-3">{label}</dt>
      <dd className="num type-title mt-0.5 text-[1.2rem] text-ink">{value}</dd>
      <dd className="text-[0.76rem] text-ink-2">{sub}</dd>
    </div>
  );
}

interface PlotRow {
  id: string;
  name: string;
  eff: number;
  ratio: number | null;
  decision: Decision;
}

/** Dot plot: each paid campaign's efficiency against the four zones. */
function EfficiencyPlot({ data }: { data: DecideResponse }) {
  const t = data.thresholds;
  const rows: PlotRow[] = data.recommendations
    .filter((r) => r.efficiency != null && r.spend > 0)
    .map((r) => ({ id: r.campaignId, name: r.name, eff: r.efficiency!, ratio: r.ratioToMedian, decision: r.decision }))
    .sort((a, b) => b.eff - a.eff);
  if (!rows.length || t.scaleAtOrBelow == null || t.changeAbove == null || t.stopAtOrAbove == null) {
    return <p className="self-center text-[0.88rem] text-ink-2">No paid campaign has an efficiency figure to plot at this date.</p>;
  }
  const med = data.recommendations.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const top = Math.max(...rows.map((r) => r.eff), t.stopAtOrAbove) * 1.15;
  const step = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((x) => top / x <= 6) ?? 10000;
  const xmax = Math.ceil(top / step) * step;
  const ticks = Array.from({ length: Math.round(xmax / step) + 1 }, (_, i) => i * step);
  const zones: { d: Decision; x1: number; x2: number }[] = [
    { d: 'scale', x1: 0, x2: t.scaleAtOrBelow },
    { d: 'keep', x1: t.scaleAtOrBelow, x2: t.changeAbove },
    { d: 'change', x1: t.changeAbove, x2: t.stopAtOrAbove },
    { d: 'stop', x1: t.stopAtOrAbove, x2: xmax },
  ];
  const unit = perUnit(data.phase);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-[0.84rem] font-medium text-ink-2">Cost {unit}, paid campaigns</figcaption>
      <div style={{ height: rows.length * 34 + 56 }}>
        <ResponsiveContainer debounce={250} width="100%" height="100%">
          <ScatterChart margin={{ top: 22, right: 56, bottom: 0, left: 0 }}>
            <CartesianGrid {...gridProps} vertical horizontal={false} />
            {zones.map((z) => (
              <ReferenceArea key={z.d} x1={z.x1} x2={z.x2} fill={DECISION[z.d].bg} fillOpacity={0.85} stroke="none" ifOverflow="hidden" label={{ value: DECISION[z.d].label, position: 'top', fill: DECISION[z.d].fg, fontSize: 12, fontWeight: 600 }} />
            ))}
            {med != null ? <ReferenceLine x={med} stroke="var(--ink-3)" strokeDasharray="4 3" label={{ value: 'median', position: 'insideBottomRight', fill: 'var(--ink-3)', fontSize: 11 }} /> : null}
            <XAxis type="number" dataKey="eff" domain={[0, xmax]} ticks={ticks} {...axisProps} tickFormatter={(v: number) => inr(v)} allowDataOverflow />
            <YAxis type="category" dataKey="name" {...axisProps} width={142} allowDuplicatedCategory={false} interval={0} />
            <Tooltip
              cursor={false}
              content={(p) => {
                const row = (p.payload?.[0]?.payload ?? null) as PlotRow | null;
                if (!p.active || !row) return null;
                return (
                  <ChartTip
                    active
                    label={row.name}
                    payload={[
                      { name: `Cost ${unit}`, value: row.eff, color: campaignColor(row.id) },
                      { name: 'Ratio to median', value: row.ratio ?? undefined, color: DECISION[row.decision].fg },
                    ]}
                    format={(v, name) => (name === 'Ratio to median' ? ratioLabel(v) : inr(v))}
                  />
                );
              }}
            />
            <Scatter
              data={rows}
              isAnimationActive={false}
              shape={(p: unknown) => {
                const { cx, cy, payload } = p as { cx: number; cy: number; payload: PlotRow };
                return <circle cx={cx} cy={cy} r={6.5} fill={campaignColor(payload.id)} stroke="var(--surface)" strokeWidth={1.5} />;
              }}
            >
              <LabelList dataKey="eff" position="right" offset={10} formatter={(v) => inr(Number(v))} style={{ fill: 'var(--ink)', fontSize: 12, fontVariantNumeric: 'tabular-nums', stroke: 'var(--surface)', strokeWidth: 3, paintOrder: 'stroke' }} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
