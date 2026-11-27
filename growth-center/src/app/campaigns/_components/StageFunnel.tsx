'use client';
import { Fragment } from 'react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import type { StageBottleneck } from '@/server/engine/diagnose';
import { num, pct } from '@/lib/format';
import { cx } from '@/components/ui';
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

/**
 * Stage-by-stage conversion against the portfolio. Anonymous stages compare with the totals row;
 * people stages use the diagnosis engine's stage gaps (portfolio of named campaigns), so the gap and
 * the people lost always come from the same comparison.
 */
export function StageFunnel({ m, totals, gaps, post }: { m: CampaignMetrics; totals: CampaignMetrics; gaps: StageBottleneck[]; post: boolean }) {
  const find = (prefix: string) => gaps.find((g) => g.stage.startsWith(prefix)) ?? null;
  const identGap = find('Identified');
  const confGap = find('Registered');
  const attendGap = find('Confirmed');

  const rows: Row[] = [
    { key: 'ctr', label: 'Click-through rate', sub: 'clicks ÷ impressions', base: m.impressions, baseUnit: 'impressions', rate: m.rates.ctr, port: totals.rates.ctr, anonymous: true, gap: null },
    { key: 'lp', label: 'Click → landing page', sub: 'landing sessions ÷ clicks', base: m.clicks, baseUnit: 'clicks', rate: m.rates.clickToLp, port: totals.rates.clickToLp, anonymous: true, gap: null },
    { key: 'start', label: 'Landing → form start', sub: 'form starts ÷ landing sessions', base: m.lpSessions, baseUnit: 'sessions', rate: m.rates.lpToStart, port: totals.rates.lpToStart, anonymous: true, gap: null },
    {
      key: 'reg',
      label: 'Identified → registered',
      sub: '14-day cohort: people identified 14+ days before the as-of date',
      base: m.matureIdentified,
      baseUnit: 'people',
      rate: identGap?.rate ?? m.rates.identToRegMature,
      port: identGap?.portfolioRate ?? totals.rates.identToRegMature,
      anonymous: false,
      gap: identGap,
    },
    { key: 'conf', label: 'Registered → confirmed', sub: 'latest status confirmed ÷ registered', base: m.registrations, baseUnit: 'people', rate: confGap?.rate ?? m.rates.regToConfirmed, port: confGap?.portfolioRate ?? totals.rates.regToConfirmed, anonymous: false, gap: confGap },
  ];
  if (post) rows.push({ key: 'attend', label: 'Confirmed → attended', sub: 'registered visitors ÷ confirmed', base: m.confirmed, baseUnit: 'people', rate: attendGap?.rate ?? m.rates.confirmedToVisit, port: attendGap?.portfolioRate ?? totals.rates.confirmedToVisit, anonymous: false, gap: attendGap });

  const gapPts = (r: Row) => (r.rate != null && r.port != null ? (r.rate - r.port) * 100 : null);
  const maxAbs = Math.max(5, ...rows.map((r) => Math.abs(gapPts(r) ?? 0)));
  const totalVisitorsLost = rows.reduce((s, r) => s + (r.gap?.visitorsLost ?? 0), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[0.86rem]">
        <caption className="sr-only">Conversion at each stage for this campaign against the portfolio</caption>
        <thead>
          <tr className="type-condensed text-[0.8rem] text-ink-2">
            <th scope="col" className="min-w-[10.5rem] border-b border-line-2 py-1.5 pr-2 text-left font-semibold">Stage</th>
            <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">Base</th>
            <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold whitespace-nowrap">Campaign</th>
            <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">Portfolio</th>
            <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-center font-semibold">Gap</th>
            <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold whitespace-nowrap">People lost</th>
            <th scope="col" className="border-b border-line-2 py-1.5 pl-2 text-right font-semibold whitespace-nowrap">
              <span className="inline-flex items-center gap-0.5">
                <InfoTip label="About visitors lost" side="left">
                  People lost at this stage against the portfolio rate, carried through the later stages to the gate{post ? '' : ' (using the show-rate assumption, because the event has not happened)'}. It puts every stage in the same currency.
                </InfoTip>
                {post ? 'Visitors lost' : 'Exp. visitors lost'}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const g = gapPts(r);
            const tone = g == null || Math.abs(g) < 0.05 ? 'var(--ink-3)' : g > 0 ? 'var(--bangle)' : 'var(--lac)';
            return (
              <Fragment key={r.key}>
                {i > 0 && rows[i - 1].anonymous && !r.anonymous ? (
                  <tr>
                    <td colSpan={7} className="border-b border-line bg-paper-2 px-2 py-1 text-[0.76rem] text-ink-3">
                      Identity switch: rows above count anonymous platform events, rows below count distinct people.
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="border-b border-line py-2 pr-2">
                    <div className="font-medium text-ink">{r.label}</div>
                    <div className="text-[0.74rem] text-ink-3">{r.sub}</div>
                  </td>
                  <td className="num border-b border-line px-2 py-2 text-right text-ink-2 whitespace-nowrap">
                    {num(r.base)} <span className="text-[0.74rem] text-ink-3">{r.baseUnit}</span>
                  </td>
                  <td className="num border-b border-line px-2 py-2 text-right font-semibold">{pct(r.rate)}</td>
                  <td className="num border-b border-line px-2 py-2 text-right text-ink-2">{pct(r.port)}</td>
                  <td className="border-b border-line px-2 py-2">
                    <GapBar gap={g} max={maxAbs} color={tone} />
                  </td>
                  <td className="num border-b border-line px-2 py-2 text-right">
                    {r.anonymous ? <span className="text-ink-3" title="Anonymous events, not people">n/a</span> : r.gap ? <span style={{ color: r.gap.peopleLost > 0.5 ? 'var(--lac)' : undefined }}>{num(r.gap.peopleLost)}</span> : <span className="text-ink-3">–</span>}
                  </td>
                  <td className="num border-b border-line py-2 pl-2 text-right">
                    {r.anonymous ? <span className="text-ink-3">n/a</span> : r.gap ? <span style={{ color: r.gap.visitorsLost > 0.5 ? 'var(--lac)' : undefined }}>{num(r.gap.visitorsLost)}</span> : <span className="text-ink-3">–</span>}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="pt-2 pr-2 text-[0.8rem] text-ink-3">
              Gaps are percentage points. Green is better than the portfolio, crimson is worse.
            </td>
            <td className="pt-2 pl-2 text-right text-[0.8rem] whitespace-nowrap text-ink-2">All stages</td>
            <td className="num pt-2 pl-2 text-right font-semibold" style={{ color: totalVisitorsLost > 0.5 ? 'var(--lac)' : undefined }}>
              {num(totalVisitorsLost)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Diverging bar centred on zero, on one scale for every row, with the signed gap in points. */
function GapBar({ gap, max, color }: { gap: number | null; max: number; color: string }) {
  const w = gap == null ? 0 : Math.min(50, (Math.abs(gap) / max) * 50);
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="relative h-2 w-20 shrink-0 rounded-full bg-paper-2" aria-hidden>
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-line-2" />
        {gap != null ? <div className={cx('absolute inset-y-0', gap >= 0 ? 'left-1/2 rounded-r-full' : 'right-1/2 rounded-l-full')} style={{ width: `${w}%`, background: color }} /> : null}
      </div>
      <span className="num w-[4.6rem] text-right font-semibold whitespace-nowrap" style={{ color }}>
        {pts(gap)}
      </span>
    </div>
  );
}
