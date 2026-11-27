'use client';
import { Fragment, type CSSProperties } from 'react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import type { StageBottleneck } from '@/server/engine/diagnose';
import { campaignColor } from '@/lib/colors';
import { num, pct } from '@/lib/format';
import { cx, Table, Td, Th } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { tipProps } from '@/components/tooltip';
import { StepFunnel, type FunnelLeak, type FunnelStage } from '@/components/viz';
import { InfoTip, pts } from './shared';

interface Row {
  key: string;
  label: string;
  sub: string;
  base: number;
  baseUnit: string;
  rate: number | null;
  port: number | null;
  anonymous: boolean;
  gap: StageBottleneck | null;
}

/** The campaign's people funnel in the stepped style: identified, registered, confirmed, (expected) visitors. */
export function CampaignStepFunnel({ m, post }: { m: CampaignMetrics; post: boolean }) {
  const ratio = (a: number, b: number) => (b > 0 ? pct(a / b, 0) : '–');
  const last = post ? m.visitors : m.expectedVisitors;
  const stages: FunnelStage[] = [
    { key: 'identified', label: 'Identified', sub: 'distinct people', value: m.identified, field: 'pista' },
    { key: 'registered', label: 'Registered', sub: `${ratio(m.registrations, m.identified)} of identified`, value: m.registrations, field: 'nizami' },
    { key: 'confirmed', label: 'Confirmed', sub: `${ratio(m.confirmed, m.registrations)} of registered`, value: m.confirmed, field: 'nizami2' },
    post
      ? { key: 'visitors', label: 'Verified visitors', sub: `${ratio(m.registeredVisitors, m.confirmed)} of confirmed came`, value: last, field: 'lac' }
      : { key: 'visitors', label: 'Expected visitors', sub: `${pct(m.showRateAssumption, 0)} show rate assumed`, value: last, field: 'lac', assumed: true },
  ];
  const lost = (n: number) => ({ label: 'Lost at this step', value: num(n), total: true });
  const leaks: FunnelLeak[] = [
    { value: Math.max(0, m.identified - m.registrations), label: 'never registered', tip: { title: 'Identified but never registered', rows: [lost(Math.max(0, m.identified - m.registrations))] } },
    {
      value: Math.max(0, m.registrations - m.confirmed),
      label: 'not confirmed',
      tip: { title: 'Registered but not confirmed', rows: [{ label: 'Cancelled', value: num(m.cancelled) }, { label: 'Waitlisted', value: num(m.waitlisted) }, { label: 'Still interested', value: num(m.interested) }, lost(Math.max(0, m.registrations - m.confirmed))] },
    },
    post
      ? { value: Math.max(0, m.confirmed - m.registeredVisitors), label: 'confirmed, never came', tip: { title: 'Confirmed but did not come', rows: [lost(Math.max(0, m.confirmed - m.registeredVisitors))] } }
      : { value: Math.max(0, m.confirmed - m.expectedVisitors), label: 'assumed no-shows', tip: { title: 'Confirmed, assumed not to come', rows: [lost(Math.max(0, m.confirmed - m.expectedVisitors))], notes: [`Planning assumption: ${pct(m.showRateAssumption, 0)} of confirmed registrants attend.`] } },
  ];
  const biggest = leaks.reduce((a, b) => (b.value > a.value ? b : a), leaks[0]);
  return <StepFunnel stages={stages} leaks={leaks.map((l) => ({ ...l, highlight: l === biggest && l.value > 0 }))} format={num} />;
}

/**
 * Each stage's conversion against the portfolio as a bullet: the campaign's rate as a bar in its colour, the
 * portfolio rate as an ink tick, on the row's own scale. People stages carry the engine's people and visitors lost,
 * so the gap and the loss always come from the same comparison. Anonymous stages count events, not people.
 */
export function StageCompare({ m, totals, gaps, post }: { m: CampaignMetrics; totals: CampaignMetrics; gaps: StageBottleneck[]; post: boolean }) {
  const rows = stageRows(m, totals, gaps, post);
  const color = campaignColor(m.campaignId);
  const gapPts = (r: Row) => (r.rate != null && r.port != null ? (r.rate - r.port) * 100 : null);
  const totalVisitorsLost = rows.reduce((s, r) => s + (r.gap?.visitorsLost ?? 0), 0);
  const unit = post ? 'visitors lost' : 'expected visitors lost';

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[13.5px] font-[650]">Against the portfolio</h3>
        <span className="flex items-center gap-1 text-[12.5px] font-[600] text-ink-2">
          <b className="tab font-[750] text-ink">{num(totalVisitorsLost)}</b> {unit}
          <InfoTip label="About visitors lost">
            People lost at each stage against the portfolio rate, carried through the later stages to the gate{post ? '' : ' with the show-rate assumption, because the event has not happened'}. It puts every stage in the same currency.
          </InfoTip>
        </span>
      </div>
      <ul className="grid gap-1">
        {rows.map((r, i) => {
          const g = gapPts(r);
          const top = Math.max(r.rate ?? 0, r.port ?? 0, 0.0001) * 1.18;
          const w = (x: number | null) => `${Math.min(100, ((x ?? 0) / top) * 100)}%`;
          const shown = g == null ? null : Math.round(g * 10) / 10;
          const worse = shown != null && shown <= -1;
          return (
            <Fragment key={r.key}>
              {i > 0 && rows[i - 1].anonymous && !r.anonymous ? <li aria-hidden className="my-1 h-px bg-stone-2" /> : null}
              <li
                tabIndex={0}
                {...tipProps({
                  title: r.label,
                  rows: [
                    { color, label: 'This campaign', value: pct(r.rate), swatch: 'square' },
                    { color: '#fff', label: 'Portfolio', value: pct(r.port) },
                    { label: 'Gap', value: pts(g) },
                    ...(r.gap ? [{ label: 'People lost', value: num(r.gap.peopleLost) }, { label: post ? 'Visitors lost' : 'Exp. visitors lost', value: num(r.gap.visitorsLost), total: true }] : []),
                  ],
                  notes: [`${r.sub}. Base: ${num(r.base)} ${r.baseUnit}.`],
                })}
                className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_64px_44px] items-center gap-3 rounded-md px-1 py-1.5 transition-colors duration-150 hover:bg-stone-2 max-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_58px]"
              >
                <span className="min-w-0 text-[13px] leading-[1.25] font-[600]">
                  {r.label}
                  <small className="block truncate text-[12px] font-[550] text-ink-2">{r.anonymous ? 'events, not people' : `${num(r.base)} ${r.baseUnit}`}</small>
                </span>
                <span className="relative h-3" aria-hidden>
                  <i className="absolute inset-y-0 left-0 block rounded-r-[4px] bg-stone-2" style={{ width: '100%' }} />
                  <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]" style={{ width: w(r.rate), background: color, '--d': `${240 + i * 40}ms` } as CSSProperties} />
                  {r.port != null ? <i className="absolute -inset-y-1 block w-[2.5px] rounded-full bg-ink" style={{ left: `calc(${w(r.port)} - 1px)` }} /> : null}
                </span>
                <span className={cx('tab text-right text-[12.5px] font-[700] whitespace-nowrap', worse ? 'text-ink' : 'text-ink-2')}>
                  {shown != null && shown !== 0 ? <span aria-hidden className="mr-0.5 text-[9px]">{shown > 0 ? '▲' : '▼'}</span> : null}
                  {pts(g)}
                </span>
                <span className="tab text-right text-[12.5px] font-[650] max-[720px]:hidden">{r.anonymous ? '' : r.gap && r.gap.visitorsLost >= 0.5 ? `−${num(r.gap.visitorsLost)}` : '0'}</span>
              </li>
            </Fragment>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-[550] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="block h-2.5 w-4 rounded-r-[3px]" style={{ background: color }} />
          This campaign
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i aria-hidden className="block h-3 w-[2.5px] rounded-full bg-ink" />
          Portfolio
        </span>
        <span className="ml-auto max-[720px]:hidden">Last column: {unit}</span>
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Stage</Th>
              <Th align="right">Base</Th>
              <Th align="right">Campaign</Th>
              <Th align="right">Portfolio</Th>
              <Th align="right">Gap</Th>
              <Th align="right">People lost</Th>
              <Th align="right">{post ? 'Visitors lost' : 'Exp. visitors lost'}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <Td>{r.label}</Td>
                <Td align="right">
                  {num(r.base)} {r.baseUnit}
                </Td>
                <Td align="right">{pct(r.rate)}</Td>
                <Td align="right">{pct(r.port)}</Td>
                <Td align="right">{pts(gapPts(r))}</Td>
                <Td align="right">{r.anonymous ? 'n/a' : r.gap ? num(r.gap.peopleLost) : '–'}</Td>
                <Td align="right">{r.anonymous ? 'n/a' : r.gap ? num(r.gap.visitorsLost) : '–'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </div>
  );
}

function stageRows(m: CampaignMetrics, totals: CampaignMetrics, gaps: StageBottleneck[], post: boolean): Row[] {
  const find = (prefix: string) => gaps.find((g) => g.stage.startsWith(prefix)) ?? null;
  const identGap = find('Identified');
  const confGap = find('Registered');
  const attendGap = find('Confirmed');
  const rows: Row[] = [
    { key: 'ctr', label: 'Click-through', sub: 'clicks ÷ impressions', base: m.impressions, baseUnit: 'impressions', rate: m.rates.ctr, port: totals.rates.ctr, anonymous: true, gap: null },
    { key: 'lp', label: 'Click to landing page', sub: 'landing sessions ÷ clicks', base: m.clicks, baseUnit: 'clicks', rate: m.rates.clickToLp, port: totals.rates.clickToLp, anonymous: true, gap: null },
    { key: 'start', label: 'Landing to form start', sub: 'form starts ÷ landing sessions', base: m.lpSessions, baseUnit: 'sessions', rate: m.rates.lpToStart, port: totals.rates.lpToStart, anonymous: true, gap: null },
    {
      key: 'reg',
      label: 'Identified to registered',
      sub: '14-day cohort: people identified 14+ days before the as-of date',
      base: m.matureIdentified,
      baseUnit: 'people, 14-day cohort',
      rate: identGap?.rate ?? m.rates.identToRegMature,
      port: identGap?.portfolioRate ?? totals.rates.identToRegMature,
      anonymous: false,
      gap: identGap,
    },
    { key: 'conf', label: 'Registered to confirmed', sub: 'latest status confirmed ÷ registered', base: m.registrations, baseUnit: 'people', rate: confGap?.rate ?? m.rates.regToConfirmed, port: confGap?.portfolioRate ?? totals.rates.regToConfirmed, anonymous: false, gap: confGap },
  ];
  if (post) rows.push({ key: 'attend', label: 'Confirmed to attended', sub: 'registered visitors ÷ confirmed', base: m.confirmed, baseUnit: 'people', rate: attendGap?.rate ?? m.rates.confirmedToVisit, port: attendGap?.portfolioRate ?? totals.rates.confirmedToVisit, anonymous: false, gap: attendGap });
  return rows;
}
