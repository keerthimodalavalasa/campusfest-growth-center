'use client';
import { CheckDuotone, XDuotone } from 'runeicons-react';
import type { Recommendation } from '@/server/engine/decide';
import { campaignColor } from '@/lib/colors';
import { inr } from '@/lib/format';
import { Button, cx, Ico } from '@/components/ui';
import { RuleStrip } from '@/components/RuleStrip';
import { CountUp } from '@/components/viz';
import { times } from './shared';

export interface CostFactors {
  scale: number;
  change: number;
  stop: number;
}

/**
 * The scale / keep / change / stop call for one campaign: its cost on the rule bands (the band it sits in carries
 * the status colour, glyph and word), then every rule it was checked against, the suggested action and the task.
 */
export function DecisionBox({ rec, factors, onCreateTask }: { rec: Recommendation; factors: CostFactors; onCreateTask: () => void }) {
  const post = rec.efficiencyMetric === 'cost per verified visitor';
  const failing = rec.checks.filter((c) => !c.passed).length;
  const priced = rec.spend > 0 && rec.ratioToMedian != null;
  return (
    <div className="flex flex-1 flex-col">
      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="num text-[40px] leading-[0.9]">{rec.efficiency != null ? <CountUp value={rec.efficiency} format={inr} /> : '–'}</span>
        <span className="pb-0.5 text-[12.5px] font-[550] text-ink-2">
          {post ? 'per verified visitor' : 'per expected visitor'}
          {priced ? <>, {times(rec.ratioToMedian)} the {inr(rec.portfolioMedian)} median</> : ', no net paid spend'}
        </span>
      </div>
      {priced ? (
        <RuleStrip
          className="mt-3"
          factors={factors}
          median={rec.portfolioMedian}
          active={rec.decision}
          points={[{ id: rec.campaignId, label: rec.name, ratio: rec.ratioToMedian!, color: campaignColor(rec.campaignId) }]}
        />
      ) : null}

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h3 className="text-[13.5px] font-[650]">Checks</h3>
        <span className="text-[12.5px] font-[600] text-ink-2">{failing === 0 ? 'every check passes' : `${failing} of ${rec.checks.length} fail`}</span>
      </div>
      <ul className="mt-2 grid gap-2" aria-label="Checks">
        {rec.checks.map((c) => (
          <li key={c.rule} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 text-[13px]">
            <span className={cx('mt-px grid size-5 place-items-center rounded-full', c.passed ? 'bg-stone-2' : 'bg-st-stop')}>
              <Ico icon={c.passed ? CheckDuotone : XDuotone} size={13} ia={c.passed ? 'var(--ink)' : '#fff'} ib={c.passed ? 'var(--ink)' : '#fff'} />
            </span>
            <span className="min-w-0">
              <span className="font-[650] text-ink">
                {c.rule}
                <span className="sr-only">{c.passed ? ', passed' : ', failed'}</span>
              </span>
              <span className="block text-[12.5px] leading-[1.4] text-ink-2">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-tile-m bg-stone-2 px-3.5 py-3">
        <div className="text-[12.5px] font-[650] text-ink-2">Suggested action</div>
        <p className="mt-0.5 text-[13.5px] leading-[1.45] text-ink">{rec.suggestedAction}</p>
      </div>
      <div className="mt-auto pt-4">
        <Button variant="primary" onClick={onCreateTask}>
          Create task from this
        </Button>
      </div>
    </div>
  );
}
