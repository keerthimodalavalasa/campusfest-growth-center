'use client';
import { Check, X } from 'lucide-react';
import type { Recommendation } from '@/server/engine/decide';
import { inr } from '@/lib/format';
import { Button, DecisionChip } from '@/components/ui';
import { times } from './shared';

export interface CostFactors {
  scale: number;
  change: number;
  stop: number;
}

/** The scale / keep / change / stop call for one campaign, with every rule it was checked against. */
export function DecisionBox({ rec, factors, onCreateTask }: { rec: Recommendation; factors: CostFactors; onCreateTask: () => void }) {
  const metric = rec.efficiencyMetric === 'cost per verified visitor' ? 'Cost per verified visitor' : 'Cost per expected visitor';
  const failing = rec.checks.filter((c) => !c.passed).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <DecisionChip decision={rec.decision} className="h-7 px-3 text-[0.85rem]" />
        <span className="text-[0.86rem] text-ink-2">
          {failing === 0 ? 'Every check passes.' : `${failing} of ${rec.checks.length} checks fail.`}
        </span>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-[0.82rem] text-ink-3">{metric}</div>
            <div className="num type-title text-[1.45rem] text-ink">{inr(rec.efficiency)}</div>
          </div>
          <div className="text-right text-[0.86rem] text-ink-2">
            {rec.spend > 0 && rec.ratioToMedian != null ? (
              <>
                <span className="num font-semibold text-ink">{times(rec.ratioToMedian)}</span> the portfolio median of <span className="num">{inr(rec.portfolioMedian)}</span>
              </>
            ) : (
              <>No net paid spend, so cost is not a constraint.</>
            )}
          </div>
        </div>
        {rec.spend > 0 && rec.ratioToMedian != null ? <RatioStrip ratio={rec.ratioToMedian} f={factors} /> : null}
      </div>

      <ul className="space-y-2" aria-label="Checks">
        {rec.checks.map((c) => (
          <li key={c.rule} className="flex items-start gap-2.5 text-[0.86rem]">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full" style={{ background: c.passed ? 'var(--bangle-soft)' : 'var(--lac-soft)', color: c.passed ? 'var(--bangle)' : 'var(--lac)' }}>
              {c.passed ? <Check size={13} strokeWidth={2.6} aria-hidden /> : <X size={13} strokeWidth={2.6} aria-hidden />}
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-ink">
                {c.rule}
                <span className="sr-only">{c.passed ? ', passed' : ', failed'}</span>
              </span>
              <span className="block text-ink-2">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-[var(--radius-control)] bg-paper-2 px-3 py-2.5">
        <div className="text-[0.8rem] font-semibold text-ink-2">Suggested action</div>
        <p className="mt-0.5 text-[0.9rem] text-ink">{rec.suggestedAction}</p>
      </div>
      <Button variant="primary" onClick={onCreateTask}>
        Create task from this
      </Button>
    </div>
  );
}

/** Where the campaign's cost sits on the rule bands, as a multiple of the portfolio median. */
function RatioStrip({ ratio, f }: { ratio: number; f: CostFactors }) {
  const max = Math.max(f.stop * 1.5, ratio * 1.08);
  const at = (x: number) => `${(Math.min(x, max) / max) * 100}%`;
  const bands = [
    { from: 0, to: f.scale, bg: 'var(--bangle-soft)', fg: 'var(--bangle)', label: 'Scale' },
    { from: f.scale, to: f.change, bg: 'var(--sagar-soft)', fg: 'var(--sagar)', label: 'Keep' },
    { from: f.change, to: f.stop, bg: 'var(--zari-soft)', fg: 'var(--zari)', label: 'Change' },
    { from: f.stop, to: max, bg: 'var(--lac-soft)', fg: 'var(--lac)', label: 'Stop' },
  ];
  return (
    <div className="mt-3" role="img" aria-label={`${ratio.toFixed(2)} times the median. Scale at or below ${f.scale} times, change above ${f.change} times, stop at or above ${f.stop} times.`}>
      {/* caret above the bands marks this campaign without covering the band names */}
      <div className="relative h-2">
        <div className="absolute bottom-0 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-ink" style={{ left: at(ratio) }} />
      </div>
      <div className="relative h-5">
        <div className="absolute inset-0 overflow-hidden rounded-md">
          {bands.map((b) => (
            <div key={b.label} className="absolute inset-y-0 grid place-items-center text-[0.7rem] font-semibold" style={{ left: at(b.from), width: `calc(${at(b.to)} - ${at(b.from)})`, background: b.bg, color: b.fg }}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-1 h-4 text-[0.72rem] text-ink-3">
        {[f.scale, f.change, f.stop].map((x) => (
          <span key={x} className="num absolute -translate-x-1/2" style={{ left: at(x) }}>
            {x}×
          </span>
        ))}
      </div>
    </div>
  );
}
