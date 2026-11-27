'use client';
import type { Signal, StageBottleneck } from '@/server/engine/diagnose';
import type { TaskDraft } from '@/components/TaskDialog';
import { CampaignDot } from '@/components/charts';
import { Button, cx, SeverityChip } from '@/components/ui';
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

/** Ranked list of each campaign's worst stage, in visitors lost. */
export function BottleneckList({ items, asOf, post, onTask, onAsk }: { items: StageBottleneck[]; asOf: string; post: boolean; onTask: (d: TaskDraft) => void; onAsk: (prompt: string) => void }) {
  if (!items.length) {
    return <p className="text-[0.9rem] text-ink-2">No campaign converts below the portfolio rate at any stage on this date.</p>;
  }
  const max = Math.max(...items.map((b) => b.visitorsLost), 1);
  const unit = post ? 'visitors lost' : 'expected visitors lost';
  return (
    <ol className="space-y-0">
      {items.map((b, i) => {
        const { main } = splitStage(b.stage);
        const stageLc = main.charAt(0).toLowerCase() + main.slice(1);
        // Same threshold as the heatmap's grey band: under 1 point is shown, but muted.
        const slight = Math.abs(shownGap(b.gapPts)) < NEUTRAL_PTS;
        return (
          <li key={`${b.campaignId}-${b.stage}`} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0">
            <span className="num pt-0.5 text-[0.85rem] font-semibold text-ink-3">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <div className="min-w-0 text-[0.92rem] font-semibold">
                  <CampaignDot id={b.campaignId}>{b.name}</CampaignDot>
                  <span className="ml-2 font-normal text-ink-2">{main}</span>
                </div>
                <div className="num shrink-0 text-right">
                  <span className={cx('type-title text-[1.1rem]', slight ? 'text-ink-2' : 'text-lac')}>{lostLabel(b.visitorsLost)}</span>
                  <span className="ml-1 text-[0.78rem] text-ink-3">{unit}</span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-paper-2">
                  <div className={cx('h-1.5 rounded-full', slight ? 'bg-ink-3' : 'bg-lac')} style={{ width: `${Math.max(1, (b.visitorsLost / max) * 100)}%` }} />
                </div>
                <span className="num w-28 shrink-0 text-right text-[0.75rem] text-ink-3">
                  {pct(b.rate)} vs {pct(b.portfolioRate)}
                </span>
              </div>
              {slight ? <p className="mt-1 text-[0.78rem] text-ink-3">Within 1 pt of the portfolio rate, the grey band on the heatmap, so treat it as no real difference.</p> : null}
              <p className="mt-1.5 text-[0.82rem] leading-snug text-ink-2">{tidy(b.explanation)}</p>
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

const SEV_ORDER: Signal['severity'][] = ['high', 'medium', 'low'];
const SEV_HEAD: Record<Signal['severity'], string> = { high: 'High severity', medium: 'Medium severity', low: 'Low severity' };

export function SignalGroups({ signals, asOf, onTask, onAsk }: { signals: Signal[]; asOf: string; onTask: (d: TaskDraft) => void; onAsk: (prompt: string) => void }) {
  const { campaignName } = useApp();
  if (!signals.length) {
    return <p className="text-[0.9rem] text-ink-2">No signals fired at this date. Move the as-of date or check the stage gaps for slower-moving problems.</p>;
  }
  return (
    <div className="space-y-5">
      {SEV_ORDER.map((sev) => {
        const list = signals.filter((s) => s.severity === sev);
        if (!list.length) return null;
        return (
          <section key={sev} aria-label={SEV_HEAD[sev]}>
            <h3 className="mb-2 flex items-center gap-2 text-[0.85rem] font-semibold text-ink-2">
              {SEV_HEAD[sev]}
              <span className="num font-normal text-ink-3">{list.length}</span>
            </h3>
            <ul className="space-y-3">
              {list.map((sig) => (
                <li key={sig.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="grid grid-cols-1 items-start gap-x-2 gap-y-1 sm:grid-cols-[4.75rem_minmax(0,1fr)] sm:gap-y-0">
                    <div>
                      <SeverityChip severity={sig.severity} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.9rem] font-semibold leading-snug">{sig.campaignId ? <CampaignDot id={sig.campaignId}>{tidy(sig.title)}</CampaignDot> : tidy(sig.title)}</div>
                      <div className="mt-0.5 text-[0.82rem] text-ink-2">{tidy(sig.evidence)}</div>
                      <div className="mt-1 text-[0.82rem] text-ink">
                        <span className="text-ink-3">Suggested action: </span>
                        {sig.suggestedAction}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
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
                        <Button size="sm" variant="ghost" onClick={() => onAsk(`Explain this signal and what you would do about it, using the data as of ${asOf}: "${sig.title}". Evidence: ${sig.evidence}`)}>
                          Ask why
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
