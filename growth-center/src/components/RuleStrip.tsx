'use client';
import type { CSSProperties } from 'react';
import { ArrowUpRightDuotone, CheckDuotone, RotateCwDuotone, SquareStopDuotone } from 'runeicons-react';
import { DECISION, type DecisionKey } from '@/lib/colors';
import { inr } from '@/lib/format';
import { cx, Ico, type IconComponent } from '@/components/ui';
import { tipProps, type TipContent } from '@/components/tooltip';
import { useElementWidth } from '@/components/viz';

const GLYPH: Record<DecisionKey, IconComponent> = { scale: ArrowUpRightDuotone, keep: CheckDuotone, change: RotateCwDuotone, stop: SquareStopDuotone };

export interface RulePoint {
  id: string;
  label: string;
  /** cost as a multiple of the portfolio median */
  ratio: number;
  color: string;
  tip?: TipContent;
}

/**
 * The decision rule bands on one axis: cost per (expected) visitor as a multiple of the portfolio median.
 * Bands are limestone steps labelled with the status glyph and word; `active` fills the band a single
 * campaign sits in with its status colour (glyph + label stay, so colour is never alone). Campaign dots sit
 * above the bands in their campaign colour, stacked into lanes when they would touch.
 */
export function RuleStrip({
  factors,
  median,
  points,
  active,
  className,
}: {
  factors: { scale: number; change: number; stop: number };
  median?: number | null;
  points: RulePoint[];
  active?: DecisionKey | null;
  className?: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const valid = points.filter((p) => Number.isFinite(p.ratio) && p.ratio >= 0);
  const max = Math.max(factors.stop * 1.5, ...valid.map((p) => p.ratio * 1.08));
  const at = (x: number) => (Math.min(Math.max(x, 0), max) / max) * 100;
  const bands: { key: DecisionKey; from: number; to: number }[] = [
    { key: 'scale', from: 0, to: factors.scale },
    { key: 'keep', from: factors.scale, to: factors.change },
    { key: 'change', from: factors.change, to: factors.stop },
    { key: 'stop', from: factors.stop, to: max },
  ];

  // dots that would touch go to the next lane up (at most three lanes)
  const R = 7;
  const lanes: number[][] = [[], [], []];
  const placed = [...valid]
    .sort((a, b) => a.ratio - b.ratio)
    .map((p) => {
      const x = (at(p.ratio) / 100) * width;
      let lane = lanes.findIndex((l) => l.every((o) => Math.abs(o - x) >= R * 2 + 3));
      if (lane < 0) lane = lanes.length - 1;
      lanes[lane].push(x);
      return { p, lane };
    });
  const laneCount = Math.max(1, ...placed.map((d) => d.lane + 1));
  const single = valid.length === 1;
  const dotsH = single ? 22 : laneCount * (R * 2 + 3) + 4;

  return (
    <div ref={ref} className={cx('relative', className)} role="img" aria-label={`Decision bands by cost against the portfolio median: scale at or below ${factors.scale} times, change above ${factors.change} times, stop at or above ${factors.stop} times. ${valid.map((p) => `${p.label} ${p.ratio.toFixed(2)} times`).join(', ')}.`}>
      <div className="relative" style={{ height: dotsH }}>
        {width > 0
          ? placed.map(({ p, lane }, i) =>
              single ? (
                <span key={p.id} className="anim-fade absolute bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${at(p.ratio)}%`, '--d': '300ms' } as CSSProperties}>
                  <span className="tab mb-0.5 text-[12px] font-[750] whitespace-nowrap text-ink">{p.ratio.toFixed(2)}×</span>
                  <i aria-hidden className="block h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-ink" />
                </span>
              ) : (
                <span
                  key={p.id}
                  tabIndex={0}
                  aria-label={`${p.label}: ${p.ratio.toFixed(2)} times the median`}
                  {...tipProps(p.tip ?? { title: p.label, rows: [{ color: p.color, label: 'Against median', value: `${p.ratio.toFixed(2)}×`, swatch: 'square' }] })}
                  className="anim-fade absolute block -translate-x-1/2 rounded-full shadow-[0_0_0_2px_var(--stone)] transition-transform duration-150 hover:scale-125 focus-visible:scale-125"
                  style={{ left: `${at(p.ratio)}%`, bottom: 4 + lane * (R * 2 + 3), width: R * 2, height: R * 2, background: p.color, '--d': `${300 + i * 30}ms` } as CSSProperties}
                />
              ),
            )
          : null}
      </div>
      <div className="relative mt-1 flex h-7 gap-[2px] overflow-hidden rounded-[8px]">
        {bands.map((b) => {
          const on = active === b.key;
          const w = at(b.to) - at(b.from);
          return (
            <div
              key={b.key}
              className={cx('flex min-w-0 items-center justify-center gap-1 text-[12px] font-[700] whitespace-nowrap', on ? 'text-white' : 'bg-stone-2 text-ink-2')}
              style={{ width: `${w}%`, background: on ? DECISION[b.key].fg : undefined }}
            >
              <Ico icon={GLYPH[b.key]} size={14} ia={on ? '#fff' : DECISION[b.key].fg} ib={on ? '#fff' : DECISION[b.key].fg} />
              {(w / 100) * width >= DECISION[b.key].label.length * 7 + 26 ? DECISION[b.key].label : <span className="sr-only">{DECISION[b.key].label}</span>}
            </div>
          );
        })}
      </div>
      <div className={cx('relative mt-1 text-[11.5px] leading-[1.25] font-[600] text-ink-2', median ? 'h-8' : 'h-4')}>
        {[factors.scale, factors.change, factors.stop].map((x) => (
          <span key={x} className="tab absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap" style={{ left: `${at(x)}%` }}>
            {x}×{median ? <span className="font-[550]">{inr(x * median)}</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
