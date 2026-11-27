'use client';
import { useMemo, useState, type CSSProperties } from 'react';
import type { StageBottleneck } from '@/server/engine/diagnose';
import { CampaignDot } from '@/components/charts';
import { cx, EmptyState } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { num, pct } from '@/lib/format';
import { NEUTRAL_PTS, pts, shownGap, splitStage, tidy } from './text';

/*
  One-hue sequential scale (lac, the visitors family) on the shortfall against the portfolio: the further a
  campaign converts below the portfolio at a stage, the more visitors it loses there, the heavier the fill.
  At or above the portfolio there is no loss, so those cells stay neutral and carry a ▲ with the printed gap.
  Steps are fixed in points, so a shade means the same thing on every date.
*/
const BOUNDS = [NEUTRAL_PTS, 4, 8, 12];
const MIX = [18, 34, 55, 100];

/** Binned on the value as printed (one decimal), so "−4.0 pts" is never coloured as the 1–4 step. */
function stepOf(gap: number): number {
  const g = shownGap(gap);
  if (g > -NEUTRAL_PTS) return 0;
  let s = 0;
  for (const b of BOUNDS) if (-g >= b) s++;
  return s; // 0 = no real shortfall, 1..4 = heavier
}

function cellColors(step: number): { bg: string; fg: string } {
  if (step === 0) return { bg: 'var(--stone-2)', fg: 'var(--ink)' };
  if (step === 4) return { bg: 'var(--lac)', fg: '#fff' };
  return { bg: `color-mix(in srgb, var(--lac) ${MIX[step - 1]}%, var(--stone))`, fg: 'var(--ink)' };
}

export function BottleneckHeatmap({ gaps, post }: { gaps: StageBottleneck[]; post: boolean }) {
  const [active, setActive] = useState<StageBottleneck | null>(null);
  const visitorUnit = post ? 'visitors' : 'expected visitors';

  const { stages, campaigns, cell, portfolioRate } = useMemo(() => {
    const stages: string[] = [];
    const campaigns: { id: string; name: string }[] = [];
    const cell = new Map<string, StageBottleneck>();
    const portfolioRate = new Map<string, number>();
    for (const g of gaps) {
      if (!stages.includes(g.stage)) stages.push(g.stage);
      if (!campaigns.some((c) => c.id === g.campaignId)) campaigns.push({ id: g.campaignId, name: g.name });
      cell.set(`${g.campaignId}|${g.stage}`, g);
      portfolioRate.set(g.stage, g.portfolioRate);
    }
    return { stages, campaigns, cell, portfolioRate };
  }, [gaps]);

  if (!gaps.length) {
    return (
      <div className="mt-3">
        <EmptyState title="Not enough people yet to compare stages">Stage gaps appear once campaigns have identified and registered people. Move the as-of date later to see them.</EmptyState>
      </div>
    );
  }

  const cols = `minmax(9.5rem, 1.1fr) repeat(${stages.length}, minmax(6.5rem, 1fr))`;

  return (
    <div className="mt-3">
      <div className="overflow-x-auto">
        <div role="table" aria-label="Stage conversion gap against the portfolio, by campaign" className="min-w-fit">
          <div role="row" className="grid items-end gap-1 pb-2" style={{ gridTemplateColumns: cols }}>
            <div role="columnheader" className="px-1 text-[12.5px] font-[600] text-ink-2">
              Campaign
            </div>
            {stages.map((s) => {
              const { main, qualifier } = splitStage(s);
              return (
                <div role="columnheader" key={s} className="px-1 leading-tight" {...(qualifier ? tipProps({ title: main, notes: [qualifier.charAt(0).toUpperCase() + qualifier.slice(1)] }) : {})}>
                  <div className={cx('text-[12.5px] font-[650] text-ink', qualifier && 'underline decoration-stone-3 decoration-dotted decoration-[1.5px] underline-offset-[3px]')}>{main.replace(' → ', ' to ')}</div>
                  <div className="tab mt-0.5 text-[12px] font-[550] text-ink-2">portfolio {pct(portfolioRate.get(s))}</div>
                </div>
              );
            })}
          </div>
          <div role="rowgroup" className="grid gap-1">
            {campaigns.map((c, ri) => (
              <div role="row" key={c.id} className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                <div role="rowheader" className="flex min-w-0 items-center px-1 text-[13px] font-[600]">
                  <CampaignDot id={c.id}>
                    <span className="truncate">{c.name}</span>
                  </CampaignDot>
                </div>
                {stages.map((s, ci) => {
                  const g = cell.get(`${c.id}|${s}`);
                  if (!g) {
                    return (
                      <div role="cell" key={s} className="grid h-12 place-items-center rounded-[8px] text-[12.5px] text-ink-2 shadow-[inset_0_0_0_1.5px_var(--stone-2)]" title="Not enough people at this stage to compare">
                        –
                      </div>
                    );
                  }
                  const step = stepOf(g.gapPts);
                  const { bg, fg } = cellColors(step);
                  const isActive = active === g;
                  const better = shownGap(g.gapPts) >= NEUTRAL_PTS;
                  return (
                    <div role="cell" key={s}>
                      <button
                        type="button"
                        aria-label={tidy(g.explanation)}
                        onMouseEnter={() => setActive(g)}
                        onFocus={() => setActive(g)}
                        onClick={() => setActive(g)}
                        className={cx('anim-fade flex h-12 w-full flex-col items-center justify-center rounded-[8px] leading-tight transition-shadow duration-150', isActive && 'shadow-[0_0_0_2px_var(--stone),0_0_0_4px_var(--ink)]')}
                        style={{ background: bg, color: fg, '--d': `${200 + ri * 40 + ci * 30}ms` } as CSSProperties}
                      >
                        <span className="tab text-[14px] font-[750]">
                          {better ? <span aria-hidden className="mr-0.5 text-[9px]">▲</span> : null}
                          {pts(g.gapPts)}
                        </span>
                        {/* secondary ink only where it keeps 4.5:1: on the two heavier steps the rate stays in full ink */}
                        <span className={cx('tab text-[11.5px] font-[600]', step === 4 ? 'text-lac-soft' : step >= 2 ? 'text-ink' : 'text-ink-2')}>{pct(g.rate)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-[3.25rem] rounded-[12px] bg-stone-2 px-3.5 py-2.5 text-[13px] leading-[1.45] text-ink-2" aria-live="polite">
        {active ? (
          <>
            <span className="text-ink">{tidy(active.explanation)}</span>
            {active.peopleLost > 0 ? (
              <span>
                {' '}
                About <b className="tab font-[700] text-ink">{num(active.peopleLost)}</b> people and <b className="tab font-[700] text-ink">{num(active.visitorsLost)}</b> {visitorUnit} lost here.
              </span>
            ) : (
              <span> At or above the portfolio rate, so no people are lost here.</span>
            )}
          </>
        ) : (
          <>Point at or focus a cell to read it.</>
        )}
      </div>

      <HeatLegend />
    </div>
  );
}

function HeatLegend() {
  const steps = [0, 1, 2, 3, 4].map((s) => ({ s, ...cellColors(s), label: s === 0 ? 'under 1 or better' : s === 4 ? `${BOUNDS[3]}+` : `${BOUNDS[s - 1]}–${BOUNDS[s]}` }));
  return (
    <div className="mt-3 max-w-[30rem]" role="img" aria-label="Colour scale: one hue, darker for a bigger shortfall against the portfolio. Neutral for under 1 point worse or better, then 1 to 4, 4 to 8, 8 to 12, and 12 or more points worse.">
      <div className="text-[12px] font-[600] text-ink-2">Points worse than the portfolio</div>
      <div className="mt-1 grid grid-cols-5 gap-[2px]">
        {steps.map((s) => (
          <span key={s.s} className="block h-3 first:rounded-l-[4px] last:rounded-r-[4px]" style={{ background: s.bg }} />
        ))}
      </div>
      <div className="tab mt-1 grid grid-cols-5 gap-[2px] text-[11.5px] leading-tight font-[550] text-ink-2">
        {steps.map((s) => (
          <span key={s.s}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}
