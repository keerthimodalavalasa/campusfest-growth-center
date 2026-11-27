'use client';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { Recommendation } from '@/server/engine/decide';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { campaignColor } from '@/lib/colors';
import { inr, num, pct } from '@/lib/format';
import { cx, StatusPill } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { CountUp, MicroRing } from '@/components/viz';

/**
 * One campaign as a limestone card: campaign colour cap, the call pill, cost per (expected) visitor as the numeral,
 * share of spend (haldi) against share of visitors (lac), and the show-up ring. The whole card links to the
 * campaign. `meta` is an optional line under the name (status, owner); `footer` replaces the default ring row.
 * Shares are drawn on a common scale (`maxShare`) so cards compare with each other.
 */
export function CampaignCard({
  m,
  rec,
  pre,
  visitorShare,
  maxShare,
  delay = 0,
  meta,
  footer,
  className,
}: {
  m: CampaignMetrics;
  rec?: Recommendation | null;
  /** before the event: expected visitors (an assumption) instead of verified ones */
  pre: boolean;
  visitorShare: number;
  maxShare: number;
  delay?: number;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const color = campaignColor(m.campaignId);
  const cpv = pre ? m.costs.perExpectedVisitor : m.costs.perVisitor;
  const visitors = pre ? m.expectedVisitors : m.visitors;
  const came = pre ? m.rates.regToConfirmed : m.rates.regToVisit;
  const spendShare = m.shares.spend ?? 0;
  const d = (ms: number) => ({ '--d': `${ms + delay}ms` }) as CSSProperties;
  return (
    <article
      {...tipProps(() => ({
        title: m.name,
        rows: [
          { label: 'Net spend', value: inr(m.spend) },
          { label: pre ? 'Expected visitors' : 'Verified visitors', value: num(visitors) },
          { color: 'var(--haldi)', label: 'Share of spend', value: pct(spendShare), swatch: 'square' },
          { color: 'var(--lac-bright)', label: pre ? 'Share of expected' : 'Share of visitors', value: pct(visitorShare), swatch: 'square' },
          ...(rec?.portfolioMedian != null ? [{ label: 'Portfolio median', value: inr(rec.portfolioMedian) }] : []),
        ],
        notes: rec?.reasons[0] ? [rec.reasons[0]] : [],
      }))}
      className={cx('anim-settle field-stone relative flex min-w-0 flex-col overflow-hidden rounded-tile-m px-4 pb-4 transition-[filter] duration-150 focus-within:brightness-[0.97] hover:brightness-[0.97]', className)}
      style={d(0)}
    >
      <div aria-hidden className="-mx-4 mb-3.5 h-2" style={{ background: color }} />
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/campaigns/${m.campaignId}`}
          className="min-w-0 text-[14px] leading-[1.3] font-[650] after:absolute after:inset-0 after:content-['']"
          aria-label={`${m.name}${rec ? `: ${rec.decision}` : ''}. Open campaign detail`}
        >
          {m.name}
        </Link>
        {rec ? <StatusPill decision={rec.decision} /> : <span className="inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[12px] font-[650] text-ink-2 shadow-[inset_0_0_0_1.5px_var(--stone-3)]">No call yet</span>}
      </div>
      {meta ? <div className="mt-1 text-[12.5px] font-[550] text-ink-2">{meta}</div> : null}
      <div className="mt-3.5 flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="num text-[34px] leading-[0.9]">{cpv != null ? <CountUp value={cpv} format={inr} delay={delay} /> : '–'}</span>
        <small className="pb-0.5 text-[12px] font-[550] text-ink-2">
          {cpv != null ? (pre ? 'per expected visitor' : 'per visitor') : 'no visitors yet'}
          {rec?.ratioToMedian != null && m.spend > 0 ? `, ${rec.ratioToMedian.toFixed(2)}× median` : ''}
        </small>
      </div>
      <div className="mt-3.5 grid gap-[7px]">
        {[
          { v: spendShare, bg: 'var(--haldi)', label: 'Spend', at: 460 },
          { v: visitorShare, bg: 'var(--lac)', label: pre ? 'Expected' : 'Visitors', at: 500 },
        ].map((b) => (
          <div key={b.label} className="grid grid-cols-[62px_1fr_38px] items-center gap-2 text-[12px] font-[600]">
            <span className="text-ink-2">{b.label}</span>
            <div className="relative h-2.5">
              <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]" style={{ width: `${Math.min(100, (Math.max(0, b.v) / maxShare) * 100)}%`, background: b.bg, ...d(b.at) }} />
            </div>
            <span className="tab text-right">{pct(b.v, 0)}</span>
          </div>
        ))}
      </div>
      {footer ?? (
        <div className="mt-auto flex items-center gap-2 pt-3">
          <div className="flex w-full items-center gap-2 pt-2.5 text-[12.5px] font-[600] text-ink-2 shadow-[inset_0_1px_0_var(--stone-2)]">
            <MicroRing value={came ?? 0} color={pre ? 'var(--nizami)' : 'var(--lac)'} />
            <span>
              <b className="font-[750] text-ink">{pct(came)}</b> {pre ? 'confirmed' : 'came'}
            </span>
            <span className="tab ml-auto">
              <b className="font-[750] text-ink">{num(visitors)}</b> {pre ? 'expected' : 'visitors'}
            </span>
          </div>
        </div>
      )}
    </article>
  );
}
