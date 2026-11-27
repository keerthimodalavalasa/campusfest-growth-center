'use client';
import type { CSSProperties } from 'react';
import type { Signal, StageBottleneck } from '@/server/engine/diagnose';
import type { TaskDraft } from '@/components/TaskDialog';
import { campaignColor } from '@/lib/colors';
import { Button, cx } from '@/components/ui';
import { SEV_LEVEL, SignalTile, signalView, type SignalContext } from '@/components/signals';
import { tipProps } from '@/components/tooltip';
import { useApp } from '@/lib/app-state';
import { dateLabel, pct } from '@/lib/format';
import { lostLabel, NEUTRAL_PTS, pts, shownGap, splitStage, tidy } from './text';

/** A short, campaign-specific task title from a signal's suggested action. */
function signalTaskTitle(sig: Signal, campaign: string | null): string {
  let clause = sig.suggestedAction.split(/[.;]/)[0].trim();
  if (clause.length > 80 && clause.includes(':')) clause = clause.split(':')[0].trim();
  if (!campaign) return clause;
  return `${campaign}: ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
}

/** Each campaign's worst stage, ranked by visitors lost: a lac bar (visitors) per campaign, the explanation in the tooltip. */
export function BottleneckList({ items, asOf, post, onTask, onAsk }: { items: StageBottleneck[]; asOf: string; post: boolean; onTask: (d: TaskDraft) => void; onAsk: (prompt: string) => void }) {
  if (!items.length) {
    return <p className="mt-3 text-[13.5px] text-ink-2">No campaign converts below the portfolio rate at any stage on this date.</p>;
  }
  const max = Math.max(...items.map((b) => b.visitorsLost), 1);
  return (
    <ol className="mt-3 grid gap-1">
      {items.map((b, i) => {
        const { main } = splitStage(b.stage);
        const stageLc = main.charAt(0).toLowerCase() + main.slice(1);
        // same threshold as the heatmap's neutral step: under 1 point is shown, but muted
        const slight = Math.abs(shownGap(b.gapPts)) < NEUTRAL_PTS;
        return (
          <li key={`${b.campaignId}-${b.stage}`} className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 rounded-[12px] px-1.5 py-2.5 transition-colors duration-150 hover:bg-stone-2">
            <span className="num pt-0.5 text-[18px] leading-none text-ink-2">{i + 1}</span>
            <div className="min-w-0">
              <div tabIndex={0} {...tipProps({ title: `${b.name}: ${main.replace(' → ', ' to ')}`, notes: [tidy(b.explanation), slight ? 'Within 1 point of the portfolio, so treat it as no real difference.' : ''].filter(Boolean) })} className="rounded-md">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-[650]">
                    <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(b.campaignId) }} />
                    <span className="truncate">{b.name}</span>
                    <span className="truncate font-[550] text-ink-2">{main.replace(' → ', ' to ')}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num text-[22px] leading-none">{lostLabel(b.visitorsLost)}</span>
                    <span className="ml-1 text-[12px] font-[550] text-ink-2">{post ? 'visitors' : 'expected'}</span>
                  </span>
                </div>
                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="relative h-2.5">
                    <i
                      className={cx('anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]', slight ? 'bg-stone-3' : 'bg-lac')}
                      style={{ width: `${Math.max(1.5, (b.visitorsLost / max) * 100)}%`, '--d': `${260 + i * 50}ms` } as CSSProperties}
                    />
                  </span>
                  <span className="tab text-[12px] font-[600] whitespace-nowrap text-ink-2">
                    {pct(b.rate)} vs {pct(b.portfolioRate)}, {pts(b.gapPts)}
                  </span>
                </div>
                <p className="sr-only">{tidy(b.explanation)}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    onTask({
                      title: `${b.name}: close the ${stageLc} gap`,
                      description: `${b.name} converts ${pct(b.rate)} at ${stageLc}, against ${pct(b.portfolioRate)} for the portfolio (${pts(b.gapPts)}). Find what is different about this campaign at this stage and bring it toward the portfolio rate.`,
                      campaign_id: b.campaignId,
                      decision: 'fix',
                      priority: b.visitorsLost >= 50 ? 'high' : b.visitorsLost >= 10 ? 'medium' : 'low',
                      evidence: `${tidy(b.explanation)}${post ? '' : ' Visitors are expected visitors, using the show-rate assumption.'} (as of ${dateLabel(asOf, true)})`,
                      source: 'insight',
                    })
                  }
                >
                  Create task
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onAsk(`Why might ${b.name} be losing people at "${main}"? ${tidy(b.explanation)} Use the data as of ${asOf}, separate what the data shows from hypotheses, and suggest how to test the most likely cause.`)}>
                  Ask why
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Every signal as a tile (the Overview's signal tiles), highest severity first, each with its two actions. */
export function SignalGrid({ signals, ctx, asOf, onTask, onAsk }: { signals: Signal[]; ctx: SignalContext | null; asOf: string; onTask: (d: TaskDraft) => void; onAsk: (prompt: string) => void }) {
  const { campaignName, meta } = useApp();
  const maxOptOut = Number(meta?.settings?.maxOptOutRate ?? 0.08);
  if (!signals.length) {
    return (
      <div className="field-stone rounded-tile-m px-4 py-3.5 text-[13.5px] font-[650]">
        Nothing flagged at this date
        <span className="block text-[12.5px] font-[550] text-ink-2">Move the as-of date, or check the stage gaps for slower problems</span>
      </div>
    );
  }
  const sorted = [...signals].sort((a, b) => SEV_LEVEL[b.severity] - SEV_LEVEL[a.severity]);
  return (
    <div className="grid grid-cols-2 gap-2.5 max-[720px]:grid-cols-1">
      {sorted.map((sig, i) => {
        const who = sig.campaignId ? campaignName(sig.campaignId) : 'All campaigns';
        const high = sig.severity === 'high';
        return (
          <SignalTile
            key={sig.id}
            sig={sig}
            view={signalView(sig, ctx, maxOptOut)}
            who={who}
            delay={300 + i * 40}
            actions={
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    onTask({
                      title: signalTaskTitle(sig, sig.campaignId ? campaignName(sig.campaignId) : null),
                      description: sig.suggestedAction,
                      campaign_id: sig.campaignId,
                      priority: sig.severity === 'high' ? 'high' : sig.severity === 'medium' ? 'medium' : 'low',
                      evidence: `${tidy(sig.title)}. ${tidy(sig.evidence)} (as of ${dateLabel(asOf, true)})`,
                      source: 'insight',
                    })
                  }
                >
                  Create task
                </Button>
                <Button size="sm" variant={high ? 'secondary' : 'ghost'} onClick={() => onAsk(`Explain this signal and what you would do about it, using the data as of ${asOf}: "${sig.title}". Evidence: ${sig.evidence}`)}>
                  Ask why
                </Button>
              </>
            }
          />
        );
      })}
    </div>
  );
}
