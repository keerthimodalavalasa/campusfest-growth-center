'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { SlidersHorizontalDuotone } from 'runeicons-react';
import type { DecisionBoard } from '@/server/engine/decide';
import { campaignColor } from '@/lib/colors';
import { inr, num, pct } from '@/lib/format';
import { Ico, StatusPill } from '@/components/ui';
import { Legend } from '@/components/charts';
import { tipProps } from '@/components/tooltip';
import { CountUp, MicroRing } from '@/components/viz';
import type { Ctx } from './model';

type Rec = DecisionBoard['recommendations'][number];

/**
 * Campaign scoreboard: one limestone card per campaign, cheapest visitor first. Each card carries its campaign colour
 * as a dot by the name, the call pill, cost per (expected) visitor, share of spend vs share of visitors, and the show-up ring.
 * The full table stays one click away in Campaigns.
 */
export function Scoreboard({ c, decisions }: { c: Ctx; decisions: DecisionBoard | null }) {
  const { s, mode } = c;
  const pre = mode === 'campaign';
  const T = s.totals;
  const calls = new Map<string, Rec>((decisions?.recommendations ?? []).map((r) => [r.campaignId, r]));
  const rows = s.campaigns
    .filter((m) => m.campaignId !== 'UNATTRIBUTED')
    .map((m) => ({
      m,
      cpv: pre ? m.costs.perExpectedVisitor : m.costs.perVisitor,
      spendShare: m.shares.spend ?? 0,
      visShare: pre ? (T.expectedVisitors > 0 ? m.expectedVisitors / T.expectedVisitors : 0) : (m.shares.visitors ?? 0),
      came: pre ? m.rates.regToConfirmed : m.rates.regToVisit,
      visitors: pre ? m.expectedVisitors : m.visitors,
    }))
    .sort((a, b) => (a.cpv ?? Infinity) - (b.cpv ?? Infinity));
  const maxShare = Math.max(0.01, ...rows.flatMap((r) => [r.spendShare, r.visShare]));
  const per = pre ? 'per expected visitor' : 'per visitor';

  return (
    <section data-area="score" aria-label="Campaign scoreboard" className="min-w-0">
      <div className="anim-settle flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pt-1.5 pb-3" style={{ '--d': '360ms' } as CSSProperties}>
        <h2 className="flex items-center gap-2 text-[15px] font-[650]">
          <Ico icon={SlidersHorizontalDuotone} size={20} ia="var(--ink)" ib="var(--stone-3)" />
          Campaign scoreboard
        </h2>
        <Legend
          items={[
            { label: 'Share of spend', color: 'var(--haldi)' },
            { label: `Share of ${pre ? 'expected ' : ''}visitors`, color: 'var(--lac)' },
          ]}
        />
        <span className="ml-auto text-[12.5px] font-[550] text-ink-2">Cheapest visitor first</span>
      </div>
      <div className="score-cards">
        {rows.map((r, i) => {
          const rec = calls.get(r.m.campaignId);
          const color = campaignColor(r.m.campaignId);
          return (
            <article
              key={r.m.campaignId}
              {...tipProps(() => ({
                title: r.m.name,
                rows: [
                  { label: 'Net spend', value: inr(r.m.spend) },
                  { label: pre ? 'Expected visitors' : 'Visitors', value: num(r.visitors) },
                  { color: 'var(--haldi)', label: 'Share of spend', value: pct(r.spendShare), swatch: 'square' },
                  { color: 'var(--lac-bright)', label: pre ? 'Share of expected' : 'Share of visitors', value: pct(r.visShare), swatch: 'square' },
                  ...(rec?.portfolioMedian != null ? [{ label: 'Portfolio median', value: inr(rec.portfolioMedian) }] : []),
                ],
                notes: rec?.reasons[0] ? [rec.reasons[0]] : [],
              }))}
              className="anim-settle field-stone relative flex min-w-0 flex-col overflow-hidden rounded-tile-m p-4 transition-[filter] duration-150 focus-within:brightness-[0.97] hover:brightness-[0.97]"
              style={{ '--d': `${380 + i * 40}ms` } as CSSProperties}
            >
              <div className="flex flex-col items-start gap-2 text-[13.5px] leading-[1.3] font-[650]">
                <span className="flex max-w-full min-w-0 items-start gap-2">
                <span aria-hidden className="mt-[4px] size-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <Link
                  href={`/campaigns/${r.m.campaignId}`}
                  className="min-w-0 after:absolute after:inset-0 after:content-['']"
                  aria-label={`${r.m.name}${rec ? `: ${rec.decision}` : ''}. Open campaign detail`}
                >
                  {r.m.name}
                </Link>
                </span>
                {rec ? <StatusPill decision={rec.decision} /> : <span className="inline-flex h-6 items-center rounded-full px-2 text-[12px] font-[650] text-ink-2 shadow-[inset_0_0_0_1.5px_var(--stone-3)]">No call yet</span>}
              </div>
              <div className="mt-3 flex flex-col items-start gap-[5px]">
                <span className="num text-[34px] leading-[0.9]">{r.cpv != null ? <CountUp value={r.cpv} format={inr} /> : '–'}</span>
                <small className="text-[12px] font-[550] text-ink-2">{r.cpv != null ? per : 'no visitors yet'}</small>
              </div>
              <div className="mt-3.5 grid gap-[7px]">
                {[
                  { v: r.spendShare, bg: 'var(--haldi)', d: 460 },
                  { v: r.visShare, bg: 'var(--lac)', d: 500 },
                ].map((b) => (
                  <div key={b.bg} className="grid grid-cols-[1fr_34px] items-center gap-2 text-[12px] font-[650]">
                    <div className="relative h-2.5">
                      <i className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]" style={{ width: `${(b.v / maxShare) * 100}%`, background: b.bg, ...({ '--d': `${b.d + i * 40}ms` } as CSSProperties) }} />
                    </div>
                    <span className="tab text-right">{pct(b.v, 0)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 pt-2.5 text-[12.5px] font-[600] text-ink-2 shadow-[inset_0_1px_0_var(--stone-2)]">
                <MicroRing value={r.came ?? 0} color={pre ? 'var(--nizami)' : 'var(--lac)'} />
                <span>
                  <b className="font-[750] text-ink">{pct(r.came)}</b> {pre ? 'confirmed' : 'came'}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
