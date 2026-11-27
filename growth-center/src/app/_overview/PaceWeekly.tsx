'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartBarDuotone, ChartLineDuotone } from 'runeicons-react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import type { DailyPoint, WeeklyPoint } from '@/server/engine/timeseries';
import { campaignColor } from '@/lib/colors';
import { addDays, dateLabel, daysBetween, num, pct } from '@/lib/format';
import { cx, Ico, Table, Td, Th, Tile } from '@/components/ui';
import { axisProps, cursorProps, gridProps, Legend } from '@/components/charts';
import { ChartData } from '@/components/ChartData';
import { TipBody, tipProps } from '@/components/tooltip';
import { CountUp, useElementWidth, usePrefersReducedMotion } from '@/components/viz';
import type { Ctx } from './model';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const chip = 'inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[12.5px] leading-none font-[650] whitespace-nowrap';

/* ------------------------------------------------------------------ pace */

interface Row {
  i: number;
  date: string;
  reg: number | null;
  conf: number | null;
  pace: number | null;
  newRegs: number | null;
  projReg: number | null;
  projPace: number | null;
}

export function PaceTile({ c, daily, latestDate }: { c: Ctx; daily: DailyPoint[]; latestDate: string }) {
  const { s, mode } = c;
  const pre = mode === 'campaign';
  const P = s.projection;
  const goal = s.target?.registrationGoal ?? null;
  const reduced = usePrefersReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const animate = !reduced && !introDone;

  const model = useMemo(() => {
    const end = [latestDate, c.eventEnd, c.asOf].sort().pop()!;
    const N = Math.max(1, daysBetween(c.start, end));
    const evI = daysBetween(c.start, c.eventStart);
    const evJ = daysBetween(c.start, c.eventEnd);
    const last = daily.length - 1;
    const rows: Row[] = Array.from({ length: N + 1 }, (_, i) => {
      const d = daily[i];
      return { i, date: addDays(c.start, i), reg: d?.registrations ?? null, conf: d?.confirmed ?? null, pace: d?.registrationPace ?? null, newRegs: d?.newRegistrations ?? null, projReg: null, projPace: null };
    });
    const showProj = pre && P && last >= 0 && last < evI && rows[evI];
    if (showProj) {
      rows[last].projReg = daily[last].registrations;
      rows[evI].projReg = P.registrations;
      if (goal != null && daily[last].registrationPace != null) {
        rows[last].projPace = daily[last].registrationPace;
        rows[evI].projPace = goal;
      }
    }
    let revI: number | null = null;
    for (let i = 1; i < daily.length; i++)
      if (daily[i].registrationGoal !== daily[i - 1].registrationGoal) {
        revI = i;
        break;
      }
    const top = Math.max(goal ?? 0, P?.registrations ?? 0, ...daily.map((d) => Math.max(d.registrationPace ?? 0, d.registrations)), 1);
    const yMax = Math.ceil(top / 800) * 800;
    const months: number[] = [];
    for (let i = 1; i <= N; i++) if (rows[i].date.endsWith('-01')) months.push(i);
    return { N, evI, evJ, last, rows, revI, yMax, months, showProj: !!showProj };
  }, [daily, c.start, c.eventStart, c.eventEnd, c.asOf, latestDate, pre, P, goal]);

  const reg = s.totals.registrations;
  const paceNow = daily[model.last]?.registrationPace ?? null;
  const behind = paceNow != null ? paceNow - reg : null;
  const lastRow = model.rows[model.last];
  const anim = { isAnimationActive: animate, animationBegin: 220, animationDuration: 820, animationEasing: 'ease-out' as const };

  return (
    <Tile field="stone" delay={280} data-area="pace" aria-label="Registrations against the goal pace" className="flex flex-col">
      <div className="flex items-center gap-2">
        <Ico icon={ChartLineDuotone} size={20} ia="var(--nizami)" ib="var(--nizami-2)" />
        <h2 className="text-[14px] leading-[1.3] font-[650]">Registrations against goal pace</h2>
      </div>
      <div className="mt-3 mb-1.5 flex flex-wrap items-end gap-x-3.5 gap-y-2">
        <span className="num text-[46px] leading-[0.85] max-[720px]:text-[40px]">
          <CountUp value={reg} format={num} />
        </span>
        <span className="pb-0.5 text-[12.5px] font-[550] text-ink-2">{pre ? (paceNow != null ? `vs ${num(paceNow)} on goal pace today` : 'no goal set') : goal ? `of ${num(goal)} goal` : 'no goal set'}</span>
        {pre && behind != null ? (
          <span className={cx(chip, 'ml-auto bg-ink text-white')}>{behind > 0 ? `${num(behind)} behind pace` : `${num(-behind)} ahead of pace`}</span>
        ) : !pre && goal ? (
          <span className={cx(chip, 'ml-auto bg-ink text-white')}>{pct(reg / goal, 0)} of goal</span>
        ) : null}
      </div>
      <Legend
        className="mb-[18px]"
        items={[
          { label: 'Registered', color: 'var(--nizami)', line: true },
          { label: 'Goal pace', color: 'var(--ink)', line: true, thin: true },
          ...(model.showProj ? [{ label: 'Run-rate projection', color: 'var(--nizami)', dotted: true }] : []),
          ...(model.revI != null ? [{ label: `Targets revised ${dateLabel(model.rows[model.revI].date)}`, color: 'var(--haldi)', bar: true }] : []),
        ]}
      />
      <div className="relative min-h-[200px] flex-1" role="img" aria-label={`Cumulative registrations: ${num(reg)}${goal ? ` against a goal of ${num(goal)}` : ''}. Hover or use the arrow keys for each day; the table under the chart lists the values.`}>
        <div className="absolute inset-0">
          <ResponsiveContainer debounce={150} width="100%" height="100%">
            <ComposedChart data={model.rows} margin={{ top: 20, right: 56, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <ReferenceArea x1={model.evI - 0.5} x2={model.evJ + 0.5} fill="var(--lac)" fillOpacity={0.12} stroke="none" ifOverflow="hidden" label={{ value: 'Event', position: 'top', fill: 'var(--lac)', fontSize: 11.5, fontWeight: 700 }} />
              <XAxis type="number" dataKey="i" domain={[0, model.N]} ticks={model.months} tickFormatter={(i: number) => MONTHS[Number(model.rows[i]?.date.slice(5, 7)) - 1] ?? ''} {...axisProps} axisLine={false} />
              <YAxis domain={[0, model.yMax]} ticks={[0, 1, 2, 3, 4].map((k) => (model.yMax / 4) * k)} tickFormatter={(v: number) => num(v)} width={44} {...axisProps} axisLine={false} />
              {model.revI != null ? <ReferenceLine x={model.revI} stroke="var(--haldi)" strokeWidth={2.5} ifOverflow="hidden" /> : null}
              <Tooltip
                cursor={cursorProps}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const r = payload?.[0]?.payload as Row | undefined;
                  if (!active || !r || r.reg == null) return null;
                  return (
                    <div className="min-w-[160px] rounded-[12px] bg-bidri px-3 py-2.5 text-[12.5px] text-white shadow-[inset_0_0_0_1px_var(--bidri-3),0_10px_30px_rgba(26,29,35,0.22)]">
                      <TipBody
                        title={dateLabel(r.date, true)}
                        rows={[
                          { color: 'var(--nizami-2)', label: 'Registered', value: num(r.reg) },
                          { color: 'var(--nizami-soft)', label: 'Confirmed', value: num(r.conf) },
                          { color: '#fff', label: 'Goal pace', value: num(r.pace) },
                          { label: 'New that day', value: num(r.newRegs) },
                        ]}
                      />
                    </div>
                  );
                }}
              />
              <Line dataKey="pace" type="linear" stroke="var(--ink)" strokeWidth={1.5} dot={false} activeDot={false} {...anim} />
              {model.showProj ? <Line dataKey="projPace" type="linear" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="2 4" strokeLinecap="round" connectNulls dot={false} activeDot={false} isAnimationActive={false} /> : null}
              <Area
                dataKey="reg"
                type="monotone"
                stroke="var(--nizami)"
                strokeWidth={2.5}
                strokeLinejoin="round"
                fill="var(--nizami)"
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4.5, fill: 'var(--nizami)', stroke: 'var(--stone)', strokeWidth: 2 }}
                {...anim}
                onAnimationEnd={() => setIntroDone(true)}
              />
              {model.showProj ? <Line dataKey="projReg" type="linear" stroke="var(--nizami)" strokeWidth={2.5} strokeDasharray="0.5 5" strokeLinecap="round" connectNulls dot={false} activeDot={false} isAnimationActive={false} /> : null}
              {model.showProj && goal != null ? (
                <ReferenceDot x={model.evI} y={goal} r={4} fill="var(--ink)" stroke="var(--stone)" strokeWidth={2} label={{ value: num(goal), position: 'right', fill: 'var(--ink)', fontSize: 11.5, fontWeight: 700 }} />
              ) : null}
              {model.showProj && P ? (
                <ReferenceDot x={model.evI} y={P.registrations} r={4.5} fill="var(--stone)" stroke="var(--nizami)" strokeWidth={2} label={{ value: num(P.registrations), position: 'right', fill: 'var(--nizami)', fontSize: 11.5, fontWeight: 700 }} />
              ) : null}
              {lastRow?.reg != null ? (
                <ReferenceDot x={model.last} y={lastRow.reg} r={4.5} fill="var(--nizami)" stroke="var(--stone)" strokeWidth={2} label={!model.showProj ? { value: num(lastRow.reg), position: 'right', fill: 'var(--ink)', fontSize: 11.5, fontWeight: 700 } : undefined} />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th align="right">Registered</Th>
              <Th align="right">Confirmed</Th>
              <Th align="right">Goal pace</Th>
            </tr>
          </thead>
          <tbody>
            {daily
              .filter((_, i) => i % 7 === 0 || i === daily.length - 1)
              .map((d) => (
                <tr key={d.date}>
                  <Td>{dateLabel(d.date)}</Td>
                  <Td align="right">{num(d.registrations)}</Td>
                  <Td align="right">{num(d.confirmed)}</Td>
                  <Td align="right">{num(d.registrationPace)}</Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </ChartData>
    </Tile>
  );
}

/* ------------------------------------------------------------------ weekly by campaign */

const WK_H = 168;

export function WeeklyTile({ weekly, campaigns }: { weekly: WeeklyPoint[]; campaigns: CampaignMetrics[] }) {
  const [xRef, width] = useElementWidth<HTMLDivElement>();
  const named = campaigns.filter((m) => m.campaignId !== 'UNATTRIBUTED');
  const hasUnattr = weekly.some((w) => (w.byCampaign.UNATTRIBUTED?.registrations ?? 0) > 0);
  const series = [...named.map((m) => ({ id: m.campaignId, name: m.name })), ...(hasUnattr ? [{ id: 'UNATTRIBUTED', name: 'Walk-ins / unattributed' }] : [])];
  const regs = (w: WeeklyPoint, id: string) => w.byCampaign[id]?.registrations ?? 0;
  const maxT = Math.max(0, ...weekly.map((w) => w.newRegistrations));
  const yMax = Math.max(100, Math.ceil(maxT / 100) * 100);
  const best = weekly.reduce<WeeklyPoint | null>((a, w) => (!a || w.newRegistrations > a.newRegistrations ? w : a), null);
  const slot = width / Math.max(1, weekly.length);
  const step = slot && slot < 30 ? 3 : slot && slot < 50 ? 2 : 1;

  return (
    <Tile field="stone" delay={320} data-area="week" aria-label="New registrations per week by campaign" className="flex flex-col">
      <div className="flex items-center gap-2">
        <Ico icon={ChartBarDuotone} size={20} ia="var(--nizami)" ib="var(--nizami-2)" />
        <h2 className="text-[14px] leading-[1.3] font-[650]">Weekly registrations by campaign</h2>
      </div>
      <div className="mt-3 mb-1.5 flex flex-wrap items-end gap-x-3.5 gap-y-1">
        {best && best.newRegistrations > 0 ? (
          <>
            <span className="num text-[46px] leading-[0.85] max-[720px]:text-[40px]">
              <CountUp value={best.newRegistrations} format={num} />
            </span>
            <span className="pb-0.5 text-[12.5px] font-[550] text-ink-2">best week, from {dateLabel(best.monday)}</span>
          </>
        ) : (
          <span className="pb-0.5 text-[13px] font-[600] text-ink-2">No registrations yet</span>
        )}
      </div>
      <Legend className="mb-[18px]" items={series.map((x) => ({ label: x.name, color: campaignColor(x.id) }))} />
      <div className="relative mt-auto flex items-end gap-1.5 pl-[34px] max-[720px]:gap-[3px] max-[720px]:pl-[30px]" style={{ height: WK_H }}>
        {[0, 0.5, 1].map((f) => (
          <div key={f} aria-hidden className={cx('absolute right-0 left-[34px] h-px max-[720px]:left-[30px]', f ? 'bg-stone-2' : 'bg-stone-3')} style={{ bottom: f * WK_H }}>
            <span className="tab absolute right-[calc(100%+8px)] -top-[7px] text-[11.5px] font-[550] text-ink-2">{num(yMax * f)}</span>
          </div>
        ))}
        {weekly.map((w, wi) => {
          const live = series.filter((x) => regs(w, x.id) > 0);
          const topId = live[live.length - 1]?.id;
          let acc = 0;
          return (
            <div
              key={w.monday}
              tabIndex={0}
              aria-label={`Week from ${dateLabel(w.monday)}: ${num(w.newRegistrations)} registrations`}
              {...tipProps(() => ({
                title: `Week from ${dateLabel(w.monday, true)}`,
                rows: [
                  ...series
                    .map((x) => ({ color: campaignColor(x.id), label: x.name, value: num(regs(w, x.id)), swatch: 'square' as const }))
                    .reverse(),
                  { label: 'All campaigns', value: num(w.newRegistrations), total: true },
                ],
              }))}
              className="relative flex h-full min-w-0 flex-1 cursor-default justify-center rounded-md transition-colors duration-150 hover:bg-stone-2 focus-visible:bg-stone-2"
            >
              <div className="anim-grow-y relative h-full w-full max-w-6" style={{ '--d': `${200 + wi * 30}ms` } as CSSProperties}>
                {series.map((x) => {
                  const n = regs(w, x.id);
                  if (!n) return null;
                  const h = (n / yMax) * WK_H;
                  const isTop = x.id === topId;
                  const el = (
                    <i
                      key={x.id}
                      className={cx('absolute inset-x-0 block', isTop && 'rounded-t-[4px]')}
                      style={{ bottom: acc, height: Math.max(1, h - (isTop ? 0 : 2)), background: campaignColor(x.id) }}
                    />
                  );
                  acc += h;
                  return el;
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div ref={xRef} aria-hidden className="mt-1.5 flex gap-1.5 pl-[34px] max-[720px]:gap-[3px] max-[720px]:pl-[30px]">
        {weekly.map((w, i) => (
          <span key={w.monday} className="flex min-w-0 flex-1 justify-center text-center text-[11px] font-[550] whitespace-nowrap text-ink-2" style={{ visibility: i % step ? 'hidden' : undefined }}>
            {dateLabel(w.monday)}
          </span>
        ))}
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Week from</Th>
              {series.map((x) => (
                <Th key={x.id} align="right">
                  {x.name.split(' ')[0]}
                </Th>
              ))}
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {weekly.map((w) => (
              <tr key={w.monday}>
                <Td>{dateLabel(w.monday)}</Td>
                {series.map((x) => (
                  <Td key={x.id} align="right">
                    {num(regs(w, x.id))}
                  </Td>
                ))}
                <Td align="right" className="font-[650]">
                  {num(w.newRegistrations)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </Tile>
  );
}
