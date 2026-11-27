'use client';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartBarDuotone, IndianRupeeDuotone } from 'runeicons-react';
import type { WeeklyPoint } from '@/server/engine/timeseries';
import { axisProps, barCursorProps, ChartTip, gridProps } from '@/components/charts';
import { ChartData } from '@/components/ChartData';
import { addDays, dateLabel, inr, inrShort, num } from '@/lib/format';
import { EmptyState, Table, Td, Th, Tile, TileHead } from '@/components/ui';
import { CountUp, usePrefersReducedMotion } from '@/components/viz';
import { CHART_RESIZE_DEBOUNCE, niceTicks } from './shared';

/**
 * Weekly new registrations (nizami, the registrations family) and weekly net spend (haldi, money): two tiles on
 * their own axes, never a dual axis, each with its exact numbers one click away.
 */
export function WeeklyCharts({ weekly, asOf, eventDate, post }: { weekly: WeeklyPoint[]; asOf: string; eventDate: string | null; post: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  // drop the empty weeks before the campaign's first activity; keep later quiet weeks (they are real)
  const first = weekly.findIndex((w) => w.newRegistrations > 0 || w.spend !== 0 || w.newIdentified > 0);
  const rows = first < 0 ? [] : weekly.slice(first);
  const last = rows[rows.length - 1];
  const partial = last && addDays(last.monday, 6) > asOf;
  const eventWeek = eventDate ? (rows.find((w) => w.monday <= eventDate && eventDate <= addDays(w.monday, 6))?.monday ?? null) : null;
  const weekLabel = (l: string) => `Week of ${dateLabel(l, true)}${partial && l === last?.monday ? ` (to ${dateLabel(asOf)})` : ''}`;

  if (!rows.length)
    return (
      <Tile field="stone" delay={300}>
        <TileHead icon={ChartBarDuotone}>Week by week</TileHead>
        <div className="mt-3">
          <EmptyState title="No activity recorded yet">Weekly registrations and spend appear here once sign-ups or spend are recorded against this campaign.</EmptyState>
        </div>
      </Tile>
    );

  const regTicks = niceTicks(0, Math.max(...rows.map((w) => w.newRegistrations), 1), 4, true);
  const spendTicks = niceTicks(Math.min(...rows.map((w) => w.spend), 0), Math.max(...rows.map((w) => w.spend), 1), 4, true);
  const anyRegs = rows.some((w) => w.newRegistrations > 0);
  const anySpend = rows.some((w) => w.spend !== 0);
  const bestRegs = rows.reduce((a, w) => (w.newRegistrations > a.newRegistrations ? w : a), rows[0]);
  const totalSpend = rows.reduce((s, w) => s + w.spend, 0);
  const anim = { isAnimationActive: !reduced && !introDone, animationBegin: 220, animationDuration: 700, animationEasing: 'ease-out' as const, onAnimationEnd: () => setIntroDone(true) };
  const eventLine = eventWeek ? <ReferenceLine x={eventWeek} stroke="var(--lac)" strokeWidth={1.5} label={{ value: 'Event', position: 'insideTopRight', fill: 'var(--lac)', fontSize: 11.5, fontWeight: 700 }} /> : null;
  const partialNote = partial ? <span>latest week partial</span> : null;

  return (
    <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
      <Tile field="stone" delay={300} className="flex flex-col" aria-label="New registrations per week">
        <TileHead icon={ChartBarDuotone} aside={partialNote}>
          New registrations per week
        </TileHead>
        {anyRegs ? (
          <>
            <div className="mt-3 flex items-end gap-2.5">
              <span className="num text-[34px] leading-[0.9]">
                <CountUp value={bestRegs.newRegistrations} format={num} />
              </span>
              <span className="pb-0.5 text-[12.5px] font-[550] text-ink-2">best week, from {dateLabel(bestRegs.monday)}</span>
            </div>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
                <BarChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="monday" {...axisProps} axisLine={false} tickFormatter={(d: string) => dateLabel(d)} interval="equidistantPreserveStart" minTickGap={6} />
                  <YAxis {...axisProps} axisLine={false} width={44} ticks={regTicks} domain={[regTicks[0], regTicks[regTicks.length - 1]]} tickFormatter={(v: number) => num(v)} />
                  <Tooltip content={<ChartTip labelFormat={weekLabel} format={(v) => num(v)} />} cursor={barCursorProps} isAnimationActive={false} />
                  {eventLine}
                  <Bar dataKey="newRegistrations" name="New registrations" fill="var(--nizami)" radius={[4, 4, 0, 0]} maxBarSize={28} {...anim} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[13.5px] text-ink-2">No registrations are attributed to this campaign in these weeks.</p>
        )}
        <ChartData>
          <Table>
            <thead>
              <tr>
                <Th>Week of</Th>
                <Th align="right">New identified</Th>
                <Th align="right">New registrations</Th>
                {post ? <Th align="right">New visitors</Th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.week}>
                  <Td>
                    {dateLabel(w.monday, true)}
                    {partial && w.monday === last.monday ? ' (partial)' : ''}
                  </Td>
                  <Td align="right">{num(w.newIdentified)}</Td>
                  <Td align="right">{num(w.newRegistrations)}</Td>
                  {post ? <Td align="right">{num(w.newVisitors)}</Td> : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </ChartData>
      </Tile>

      <Tile field="stone" delay={340} className="flex flex-col" aria-label="Net spend per week">
        <TileHead icon={IndianRupeeDuotone} aside={partialNote}>
          Net spend per week
        </TileHead>
        {anySpend ? (
          <>
            <div className="mt-3 flex items-end gap-2.5">
              <span className="num text-[34px] leading-[0.9]">
                <CountUp value={totalSpend} format={inrShort} />
              </span>
              <span className="pb-0.5 text-[12.5px] font-[550] text-ink-2">across {rows.length} weeks</span>
            </div>
            <div className="mt-3 h-52">
              <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
                <BarChart data={rows} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="monday" {...axisProps} axisLine={false} tickFormatter={(d: string) => dateLabel(d)} interval="equidistantPreserveStart" minTickGap={6} />
                  <YAxis {...axisProps} axisLine={false} width={52} ticks={spendTicks} domain={[spendTicks[0], spendTicks[spendTicks.length - 1]]} tickFormatter={(v: number) => inrShort(v)} />
                  <Tooltip content={<ChartTip labelFormat={weekLabel} format={(v) => inr(v)} />} cursor={barCursorProps} isAnimationActive={false} />
                  <ReferenceLine y={0} stroke="var(--stone-3)" />
                  {eventLine}
                  <Bar dataKey="spend" name="Net spend" fill="var(--haldi)" radius={[4, 4, 0, 0]} maxBarSize={28} {...anim} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[13.5px] text-ink-2">No net spend is recorded against this campaign in these weeks.</p>
        )}
        <ChartData>
          <Table>
            <thead>
              <tr>
                <Th>Week of</Th>
                <Th align="right">Net spend</Th>
                <Th align="right">Cost per new registration</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.week}>
                  <Td>
                    {dateLabel(w.monday, true)}
                    {partial && w.monday === last.monday ? ' (partial)' : ''}
                  </Td>
                  <Td align="right">{inr(w.spend)}</Td>
                  <Td align="right">{inr(w.costPerRegistration)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ChartData>
      </Tile>
    </div>
  );
}
