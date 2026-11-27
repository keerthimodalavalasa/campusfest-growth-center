'use client';
import { useMemo, useState } from 'react';
import type { StageBottleneck } from '@/server/engine/diagnose';
import { CampaignDot } from '@/components/charts';
import { cx, EmptyState } from '@/components/ui';
import { num, pct } from '@/lib/format';
import { NEUTRAL_PTS, pts, shownGap, splitStage, tidy } from './text';

/** Step boundaries in percentage points. Fixed, so a colour means the same thing on every date. */
const BOUNDS = [NEUTRAL_PTS, 4, 8, 12];
const MIX = [15, 35, 60, 100];

/** Binned on the value as printed (one decimal), so "−4.0 pts" is never coloured as the 1–4 step. */
function stepOf(gap: number): number {
  const a = Math.abs(shownGap(gap));
  let s = 0;
  for (const b of BOUNDS) if (a >= b) s++;
  return s; // 0 = neutral, 1..4 = intensity
}

function cellColors(gap: number): { bg: string; fg: string } {
  const s = stepOf(gap);
  if (s === 0) return { bg: 'var(--paper-2)', fg: 'var(--ink)' };
  const accent = shownGap(gap) > 0 ? 'var(--bangle)' : 'var(--lac)';
  return { bg: s === 4 ? accent : `color-mix(in srgb, ${accent} ${MIX[s - 1]}%, var(--surface))`, fg: s === 4 ? '#fff' : 'var(--ink)' };
}

function cellTitle(c: StageBottleneck, visitorUnit: string): string {
  const lost = c.peopleLost > 0 ? `\nPeople lost vs portfolio: ~${num(c.peopleLost)}; ${visitorUnit} lost: ~${num(c.visitorsLost)}.` : '\nAt or above the portfolio rate: no people lost at this stage.';
  return `${tidy(c.explanation)}${lost}`;
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
    return <EmptyState title="Not enough people yet to compare stages">Stage gaps appear once campaigns have identified and registered people at this date. Move the as-of date later to see them.</EmptyState>;
  }

  const cols = `minmax(10.5rem, 1.15fr) repeat(${stages.length}, minmax(7.25rem, 1fr))`;

  return (
    <div>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Stage conversion gap versus portfolio, by campaign" className="min-w-fit">
          <div role="row" className="grid items-end gap-1 pb-1.5" style={{ gridTemplateColumns: cols }}>
            <div role="columnheader" className="type-condensed px-1 text-[0.8rem] font-semibold text-ink-2">
              Campaign
            </div>
            {stages.map((s) => {
              const { main, qualifier } = splitStage(s);
              return (
                <div role="columnheader" key={s} className="px-1 leading-tight">
                  <div className="type-condensed text-[0.82rem] font-semibold text-ink">{main}</div>
                  {qualifier ? <div className="text-[0.72rem] text-ink-3">{qualifier}</div> : null}
                  <div className="num mt-0.5 text-[0.74rem] text-ink-3">Portfolio {pct(portfolioRate.get(s))}</div>
                </div>
              );
            })}
          </div>
          <div role="rowgroup" className="space-y-1">
            {campaigns.map((c) => (
              <div role="row" key={c.id} className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                <div role="rowheader" className="flex items-center px-1 text-[0.88rem] font-medium">
                  <CampaignDot id={c.id}>{c.name}</CampaignDot>
                </div>
                {stages.map((s) => {
                  const g = cell.get(`${c.id}|${s}`);
                  if (!g) {
                    return (
                      <div role="cell" key={s} className="grid h-12 place-items-center rounded-md border border-dashed border-line text-[0.8rem] text-ink-3" title="Not enough people at this stage to compare">
                        –
                      </div>
                    );
                  }
                  const { bg, fg } = cellColors(g.gapPts);
                  const isActive = active === g;
                  return (
                    <div role="cell" key={s}>
                      <button
                        type="button"
                        title={cellTitle(g, visitorUnit)}
                        aria-label={tidy(g.explanation)}
                        onMouseEnter={() => setActive(g)}
                        onFocus={() => setActive(g)}
                        onClick={() => setActive(g)}
                        className={cx('flex h-12 w-full flex-col items-center justify-center rounded-md leading-tight transition-shadow', isActive && 'ring-2 ring-ink ring-offset-1')}
                        style={{ background: bg, color: fg }}
                      >
                        <span className="num text-[0.9rem] font-semibold">{pts(g.gapPts)}</span>
                        <span className="num text-[0.72rem] opacity-80">{pct(g.rate)}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 min-h-[3.25rem] rounded-[var(--radius-control)] bg-paper-2 px-3 py-2 text-[0.83rem] text-ink-2" aria-live="polite">
        {active ? (
          <>
            <span className="text-ink">{tidy(active.explanation)}</span>
            {active.peopleLost <= 0 ? <span> At or above the portfolio rate, so no people are lost here.</span> : !post ? <span> Visitors here are expected visitors, using the show-rate assumption.</span> : null}
          </>
        ) : (
          <>Point at or focus a cell to read its explanation and the people lost at that stage.</>
        )}
      </div>

      <HeatLegend />
    </div>
  );
}

function HeatLegend() {
  const worse = [4, 3, 2, 1].map((s) => ({ s, gap: -BOUNDS[s - 1] }));
  const better = [1, 2, 3, 4].map((s) => ({ s, gap: BOUNDS[s - 1] }));
  const range = (s: number) => (s === 4 ? `${BOUNDS[3]}+` : `${BOUNDS[s - 1]}–${BOUNDS[s]}`);
  const steps = [...worse.map((w) => ({ key: `w${w.s}`, bg: cellColors(w.gap).bg, label: range(w.s) })), { key: 'n', bg: 'var(--paper-2)', label: 'under 1' }, ...better.map((b) => ({ key: `b${b.s}`, bg: cellColors(b.gap).bg, label: range(b.s) }))];
  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
      <div className="w-full max-w-[26rem]" role="img" aria-label="Colour scale: four shades of red for 1 to 12 or more points worse than the portfolio, grey for under 1 point either way, four shades of green for 1 to 12 or more points better.">
        <div className="flex justify-between text-[0.75rem] text-ink-2">
          <span>Points worse than portfolio</span>
          <span>Points better</span>
        </div>
        <div className="mt-1 grid grid-cols-9 gap-1">
          {steps.map((s) => (
            <span key={s.key} className={cx('block h-3.5 rounded-[3px]', s.key === 'n' && 'border border-line-2')} style={{ background: s.bg }} />
          ))}
        </div>
        <div className="num mt-0.5 grid grid-cols-9 gap-1 text-center text-[0.68rem] leading-tight text-ink-3">
          {steps.map((s) => (
            <span key={s.key}>{s.label}</span>
          ))}
        </div>
      </div>
      <span className="text-[0.75rem] text-ink-3">Cells show the gap in percentage points; small text is the campaign&apos;s own rate.</span>
    </div>
  );
}
