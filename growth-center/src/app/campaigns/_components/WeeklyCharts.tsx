'use client';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeeklyPoint } from '@/server/engine/timeseries';
import { axisProps, ChartTip, gridProps } from '@/components/charts';
import { addDays, dateLabel, inr, inrShort, num } from '@/lib/format';
import { EmptyState, Panel } from '@/components/ui';
import { CHART_RESIZE_DEBOUNCE, niceTicks } from './shared';

/** Weekly new registrations and weekly net spend: two charts on their own axes, plus the exact numbers. */
export function WeeklyCharts({ weekly, color, asOf, eventDate, post }: { weekly: WeeklyPoint[]; color: string; asOf: string; eventDate: string | null; post: boolean }) {
  // drop the empty weeks before the campaign's first activity; keep later quiet weeks (they are real)
  const first = weekly.findIndex((w) => w.newRegistrations > 0 || w.spend !== 0 || w.newIdentified > 0);
  const rows = first < 0 ? [] : weekly.slice(first);
  const last = rows[rows.length - 1];
  const partial = last && addDays(last.monday, 6) > asOf;
  const eventWeek = eventDate ? rows.find((w) => w.monday <= eventDate && eventDate <= addDays(w.monday, 6))?.monday ?? null : null;
  const weekLabel = (l: string) => `Week of ${dateLabel(l, true)}${partial && l === last?.monday ? ` (to ${dateLabel(asOf)})` : ''}`;
  const note = partial ? `The latest week is partial: it runs to ${dateLabel(asOf, true)}.` : null;

  if (!rows.length)
    return (
      <Panel title="Week by week">
        <EmptyState title="No activity recorded yet">Weekly registrations and spend appear here once sign-ups or spend are recorded against this campaign.</EmptyState>
      </Panel>
    );

  const regTicks = niceTicks(0, Math.max(...rows.map((w) => w.newRegistrations), 1), 4, true);
  const spendTicks = niceTicks(Math.min(...rows.map((w) => w.spend), 0), Math.max(...rows.map((w) => w.spend), 1), 4, true);
  // a series of zeros is not a chart: say so instead of drawing an empty grid
  const anyRegs = rows.some((w) => w.newRegistrations > 0);
  const anySpend = rows.some((w) => w.spend !== 0);
  const eventLine = eventWeek ? <ReferenceLine x={eventWeek} stroke="var(--ink-3)" strokeDasharray="3 3" label={{ value: 'event week', position: 'insideTopRight', fill: 'var(--ink-3)', fontSize: 11 }} /> : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="New registrations per week" aside={note ? 'latest week partial' : null}>
          {anyRegs ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
                <BarChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="monday" {...axisProps} tickFormatter={(d: string) => dateLabel(d)} interval="equidistantPreserveStart" minTickGap={6} />
                  <YAxis {...axisProps} width={44} ticks={regTicks} domain={[regTicks[0], regTicks[regTicks.length - 1]]} tickFormatter={(v: number) => num(v)} />
                  <Tooltip content={<ChartTip labelFormat={weekLabel} format={(v) => num(v)} />} cursor={{ fill: 'var(--paper-2)' }} />
                  {eventLine}
                  <Bar dataKey="newRegistrations" name="New registrations" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[0.88rem] text-ink-2">No registrations are attributed to this campaign in these weeks.</p>
          )}
        </Panel>
        <Panel title="Net spend per week" aside={note ? 'latest week partial' : null}>
          {anySpend ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
                <BarChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="monday" {...axisProps} tickFormatter={(d: string) => dateLabel(d)} interval="equidistantPreserveStart" minTickGap={6} />
                  <YAxis {...axisProps} width={52} ticks={spendTicks} domain={[spendTicks[0], spendTicks[spendTicks.length - 1]]} tickFormatter={(v: number) => inrShort(v)} />
                  <Tooltip content={<ChartTip labelFormat={weekLabel} format={(v) => inr(v)} />} cursor={{ fill: 'var(--paper-2)' }} />
                  <ReferenceLine y={0} stroke="var(--line-2)" />
                  {eventLine}
                  <Bar dataKey="spend" name="Net spend" fill="var(--ink-3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-[0.88rem] text-ink-2">No net spend is recorded against this campaign in these weeks.</p>
          )}
        </Panel>
      </div>

      <details className="group rounded-[var(--radius-panel)] bg-paper-2 px-5 py-3">
        <summary className="cursor-pointer text-[0.88rem] font-semibold text-ink select-none">Weekly numbers behind both charts</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[0.85rem]">
            <thead>
              <tr className="type-condensed text-[0.8rem] text-ink-2">
                <th scope="col" className="border-b border-line-2 py-1.5 pr-2 text-left font-semibold">Week of</th>
                <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">New identified</th>
                <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">New registrations</th>
                {post ? <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">New visitors</th> : null}
                <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">Net spend</th>
                <th scope="col" className="border-b border-line-2 py-1.5 pl-2 text-right font-semibold">Cost / new reg.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.week}>
                  <td className="border-b border-line py-1.5 pr-2 whitespace-nowrap">
                    {dateLabel(w.monday, true)}
                    {partial && w.monday === last.monday ? <span className="ml-1 text-ink-3">(partial)</span> : null}
                  </td>
                  <td className="num border-b border-line px-2 py-1.5 text-right">{num(w.newIdentified)}</td>
                  <td className="num border-b border-line px-2 py-1.5 text-right">{num(w.newRegistrations)}</td>
                  {post ? <td className="num border-b border-line px-2 py-1.5 text-right">{num(w.newVisitors)}</td> : null}
                  <td className="num border-b border-line px-2 py-1.5 text-right">{inr(w.spend)}</td>
                  <td className="num border-b border-line py-1.5 pl-2 text-right">{inr(w.costPerRegistration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
