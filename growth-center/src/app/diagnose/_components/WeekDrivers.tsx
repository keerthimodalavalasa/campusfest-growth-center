'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import type { Diagnosis, Driver } from '@/server/engine/diagnose';
import { axisProps, CampaignDot, ChartTip } from '@/components/charts';
import { EmptyState, Figure, Table, Td, Th } from '@/components/ui';
import { campaignColor } from '@/lib/colors';
import { inr, num, pct, signed } from '@/lib/format';
import { tidy } from './text';

export function WeekDrivers({ drivers, post }: { drivers: Diagnosis['drivers']; post: boolean }) {
  const { rows, totalLast7, totalPrev7, delta } = drivers;
  if (!rows.length) {
    return <EmptyState title="No campaigns to compare yet">Week-over-week drivers appear once campaigns have registrations in the last 14 days.</EmptyState>;
  }
  const change = totalPrev7 > 0 ? delta / totalPrev7 : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4 sm:max-w-xl">
        <Figure label="Last 7 days" value={num(totalLast7)} sub="registrations" />
        <Figure label="Previous 7 days" value={num(totalPrev7)} sub="registrations" />
        <Figure label="Change" value={signed(delta)} sub={change != null ? `${signed(change * 100, (v) => v.toFixed(1))}% week over week` : 'no registrations the week before'} tone={delta > 0 ? 'good' : delta < 0 ? 'bad' : 'neutral'} />
      </div>
      {post && totalLast7 === 0 ? <p className="text-[0.83rem] text-ink-3">Registrations closed before the event, so after the event every campaign falls to zero. The table shows the last full week of activity as the previous 7 days.</p> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
        <div>
          <div className="mb-1 text-[0.82rem] text-ink-2">Change in registrations, last 7 days minus previous 7</div>
          {rows.some((r) => r.delta !== 0) ? (
            <DeltaChart rows={rows} />
          ) : (
            <p className="rounded-[var(--radius-control)] bg-paper-2 px-3 py-3 text-[0.85rem] text-ink-2">
              No campaign changed: {totalLast7 === 0 && totalPrev7 === 0 ? 'there were no registrations in either week.' : 'each one registered the same number of people in both weeks.'} Move the as-of date later to compare weeks with activity.
            </p>
          )}
        </div>
        <DriverTable rows={rows} />
      </div>
    </div>
  );
}

/** Measures its box before first paint, so the chart never renders at a placeholder size. */
function useBoxWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function DeltaChart({ rows }: { rows: Driver[] }) {
  const [box, width] = useBoxWidth();
  const data = rows.map((r) => ({ ...r }));
  const lo = Math.min(0, ...rows.map((r) => r.delta));
  const hi = Math.max(0, ...rows.map((r) => r.delta));
  // round ticks on a 1-2-5 step, with room past the longest bar for its label
  const raw = Math.max(hi - lo, 4) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const pad = (hi - lo) * 0.12;
  const dLo = lo < 0 ? Math.floor((lo - pad) / step) * step : 0;
  const dHi = hi > 0 ? Math.ceil((hi + pad) / step) * step : lo < 0 ? 0 : step;
  const height = rows.length * 36 + 36;
  const ticks: number[] = [];
  for (let t = dLo; t <= dHi + 1e-9; t += step) ticks.push(Math.round(t));
  return (
    <div ref={box} style={{ height }}>
      {width > 0 ? (
        <BarChart width={width} height={height} data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" horizontal={false} />
          <XAxis type="number" domain={[dLo, dHi]} ticks={ticks} allowDecimals={false} {...axisProps} tickFormatter={(v: number) => signed(v)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={156} interval={0} />
          <Tooltip
            cursor={{ fill: 'var(--paper-2)' }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as Driver | undefined;
              if (!active || !r) return null;
              return (
                <ChartTip
                  active
                  label={r.name}
                  payload={[
                    { name: 'Previous 7 days', value: r.regsPrev7, color: 'var(--line-2)' },
                    { name: 'Last 7 days', value: r.regsLast7, color: campaignColor(r.campaignId) },
                    { name: 'Change', value: r.delta, color: 'transparent' },
                  ]}
                  format={(v, n) => (n === 'Change' ? signed(v) : num(v))}
                />
              );
            }}
          />
          <ReferenceLine x={0} stroke="var(--ink-2)" strokeWidth={1.25} />
          <Bar dataKey="delta" name="Change in registrations" barSize={16} radius={2} isAnimationActive={false}>
            {data.map((r) => (
              <Cell key={r.campaignId} fill={campaignColor(r.campaignId)} />
            ))}
            <LabelList
              dataKey="delta"
              content={(p) => {
                const x = Number(p.x ?? 0);
                const w = Number(p.width ?? 0);
                const y = Number(p.y ?? 0);
                const h = Number(p.height ?? 0);
                const v = Number(p.value ?? 0);
                const end = v < 0 ? Math.min(x, x + w) : Math.max(x, x + w);
                return (
                  <text x={v < 0 ? end - 5 : end + 5} y={y + h / 2} dy="0.35em" textAnchor={v < 0 ? 'end' : 'start'} fontSize={12} fontWeight={600} fill="var(--ink)" className="num">
                    {signed(v)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      ) : null}
    </div>
  );
}

function DriverTable({ rows }: { rows: Driver[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th className="text-left">Campaign and likely driver</Th>
          <Th align="right">Prev 7</Th>
          <Th align="right">Last 7</Th>
          <Th align="right">Change</Th>
          <Th align="right">Identified, prev to last</Th>
          <Th align="right">Net spend, prev to last</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.campaignId} className="align-top hover:bg-paper">
            <Td className="min-w-[16rem] align-top">
              <div className="font-medium">
                <CampaignDot id={r.campaignId}>{r.name}</CampaignDot>
              </div>
              <div className="mt-0.5 text-[0.78rem] leading-snug text-ink-2">{tidy(r.read)}</div>
            </Td>
            <Td align="right" className="align-top">
              {num(r.regsPrev7)}
            </Td>
            <Td align="right" className="align-top">
              {num(r.regsLast7)}
            </Td>
            <Td align="right" className="align-top font-semibold">
              <span style={{ color: r.delta > 0 ? 'var(--bangle)' : r.delta < 0 ? 'var(--lac)' : 'var(--ink-2)' }}>{signed(r.delta)}</span>
              {r.shareOfChange != null ? <div className="whitespace-nowrap text-[0.72rem] font-normal text-ink-3" title="Share of all campaign movement (sum of absolute changes)">{pct(Math.abs(r.shareOfChange))} of movement</div> : null}
            </Td>
            <Td align="right" className="align-top whitespace-nowrap">
              {num(r.identPrev7)} <span className="text-ink-3">to</span> {num(r.identLast7)}
            </Td>
            <Td align="right" className="align-top whitespace-nowrap">
              {inr(r.spendPrev7)} <span className="text-ink-3">to</span> {inr(r.spendLast7)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
