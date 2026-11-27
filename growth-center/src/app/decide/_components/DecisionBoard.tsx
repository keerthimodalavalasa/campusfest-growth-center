'use client';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { mutate } from '@/lib/api';
import { DECISION } from '@/lib/colors';
import { dateLabel, inr, inrShort, num } from '@/lib/format';
import { Button, Chip } from '@/components/ui';
import { CampaignDot } from '@/components/charts';
import type { TaskDraft } from '@/components/TaskDialog';
import { COLUMNS, isPost, passReason, perUnit, ratioLabel, shortCheck, taskDecision, tidy, type Decision, type DecideResponse, type Recommendation } from './types';

/** Stop / Change / Keep / Scale columns, one card per campaign. */
export function DecisionBoard({ data, onCreateTask }: { data: DecideResponse; onCreateTask: (d: TaskDraft) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const campaigns = new Map(data.campaigns.map((c) => [c.campaignId, c]));
  const post = isPost(data.phase);

  const setStatus = async (rec: Recommendation, status: string, previous: string) => {
    setBusy(rec.campaignId);
    try {
      await mutate(`/api/campaigns/${rec.campaignId}`, 'PATCH', { status });
      if (status === 'paused') {
        toast.success(`${rec.name} paused`, {
          description: 'Its status is now paused. Past spend and results are unchanged.',
          action: { label: 'Undo', onClick: () => void setStatus(rec, previous, 'paused') },
        });
      } else {
        toast.success(`${rec.name} set back to ${status}`);
      }
    } catch (e) {
      toast.error(`Could not update ${rec.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const draftFor = (rec: Recommendation): TaskDraft => {
    const c = campaigns.get(rec.campaignId);
    const failed = rec.checks.filter((k) => !k.passed).map((k) => k.rule.toLowerCase());
    const title =
      rec.decision === 'stop'
        ? `Stop new spend on ${rec.name}`
        : rec.decision === 'change'
          ? `Fix ${failed.join(', ') || 'efficiency'} on ${rec.name}`
          : rec.decision === 'scale'
            ? `Scale ${rec.name} in steps of about 20% a week`
            : `Hold ${rec.name} budget and review weekly`;
    return {
      title,
      description: tidy(rec.suggestedAction),
      campaign_id: rec.campaignId,
      owner_id: c?.ownerId ?? null,
      decision: taskDecision(rec.decision),
      priority: rec.decision === 'stop' || rec.decision === 'change' ? 'high' : 'medium',
      source: 'insight',
      evidence: `${DECISION[rec.decision].label} call as of ${dateLabel(data.asOf, true)}. ${rec.checks.some((k) => !k.passed) ? rec.reasons.map(tidy).join(' ') : passReason(rec, data.phase)} Basis: ${tidy(data.basis)}`,
    };
  };

  return (
    <section aria-label="Decision board" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((d) => {
        const recs = data.recommendations.filter((r) => r.decision === d);
        const spend = recs.reduce((s, r) => s + r.spend, 0);
        const visitors = recs.reduce((s, r) => s + r.visitorsOrExpected, 0);
        return (
          <div key={d} className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] bg-paper-2">
            <div className="h-1 shrink-0" style={{ background: DECISION[d].fg }} aria-hidden />
            <div className="px-3.5 pb-2.5 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="type-title text-[1.08rem]" style={{ color: DECISION[d].fg }}>
                  {DECISION[d].label}
                  <span className="num ml-1.5 text-[0.95rem] font-medium text-ink-3">{recs.length}</span>
                </h2>
                {recs.length ? (
                  <span className="num text-right text-[0.78rem] text-ink-2">
                    {inrShort(spend)} spend, {num(visitors)} {post ? 'visitors' : 'exp. visitors'}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[0.78rem] text-ink-3">{columnRule(d, data)}</p>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
              {recs.length ? (
                recs.map((r) => (
                  <DecisionCard
                    key={r.campaignId}
                    rec={r}
                    data={data}
                    campaign={campaigns.get(r.campaignId)}
                    busy={busy === r.campaignId}
                    onCreateTask={() => onCreateTask(draftFor(r))}
                    onPause={(prev) => setStatus(r, 'paused', prev)}
                    onResume={() => setStatus(r, 'active', 'paused')}
                  />
                ))
              ) : (
                <p className="px-1 pb-2 text-[0.84rem] text-ink-2">No campaign is in {DECISION[d].label} at this date.</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function columnRule(d: Decision, data: DecideResponse) {
  const t = data.thresholds;
  const s = data.settings;
  if (t.scaleAtOrBelow == null || t.changeAbove == null || t.stopAtOrAbove == null) {
    return { stop: 'Cost far above the median', change: 'A failed guardrail', keep: 'Guardrails pass, cost near the median', scale: 'Every guardrail passes' }[d];
  }
  return {
    stop: `Cost at or above ${inr(t.stopAtOrAbove)} (${s.stopCostFactor}× the median)`,
    change: `Cost above ${inr(t.changeAbove)}, or any failed guardrail`,
    keep: `Cost from ${inr(t.scaleAtOrBelow)} to ${inr(t.changeAbove)}, guardrails pass`,
    scale: `Cost at or below ${inr(t.scaleAtOrBelow)} and every guardrail passes`,
  }[d];
}

const ratioColor = (r: number | null, s: DecideResponse['settings']) => {
  if (r == null) return 'var(--ink-2)';
  if (r >= s.stopCostFactor) return 'var(--lac)';
  if (r > s.changeCostFactor) return 'var(--zari)';
  if (r <= s.scaleCostFactor) return 'var(--bangle)';
  return 'var(--ink-2)';
};

function DecisionCard({
  rec,
  data,
  campaign,
  busy,
  onCreateTask,
  onPause,
  onResume,
}: {
  rec: Recommendation;
  data: DecideResponse;
  campaign: CampaignMetrics | undefined;
  busy: boolean;
  onCreateTask: () => void;
  onPause: (previousStatus: string) => void;
  onResume: () => void;
}) {
  const s = data.settings;
  const post = isPost(data.phase);
  const failed = rec.checks.filter((k) => !k.passed);
  const status = campaign?.status ?? 'active';
  const paused = status === 'paused';
  const actionable = rec.decision === 'stop' || rec.decision === 'change';

  return (
    <article className="rounded-[10px] border border-line bg-surface p-3.5" aria-label={`${rec.name}: ${DECISION[rec.decision].label}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/campaigns/${rec.campaignId}`} className="font-semibold leading-snug text-ink hover:underline">
            <CampaignDot id={rec.campaignId}>{rec.name}</CampaignDot>
          </Link>
          <div className="pl-[18px] text-[0.8rem] text-ink-3">{rec.ownerName ?? 'No owner'}</div>
        </div>
        {status !== 'active' ? <Chip className="capitalize">{status}</Chip> : null}
      </header>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
        {rec.efficiency != null ? (
          <>
            <span className="num type-title text-[1.3rem] text-ink">{inr(rec.efficiency)}</span>
            <span className="text-[0.78rem] text-ink-3">{perUnit(data.phase)}</span>
            <span className="num ml-auto text-[0.86rem] font-semibold" style={{ color: ratioColor(rec.ratioToMedian, s) }}>
              {ratioLabel(rec.ratioToMedian)} median
            </span>
          </>
        ) : (
          <span className="type-title text-[1.05rem] text-ink-2">{rec.spend <= 0 ? 'No paid spend' : 'No efficiency yet'}</span>
        )}
      </div>
      <div className="num text-[0.78rem] text-ink-3">
        {inr(rec.spend)} spend, {num(rec.visitorsOrExpected)} {post ? 'verified visitors' : 'expected visitors'}
      </div>

      {failed.length ? (
        <div className="mt-2.5">
          <div className="text-[0.78rem] text-ink-3">
            <span className="num">{failed.length}</span> of <span className="num">{rec.checks.length}</span> checks failed
          </div>
          <ul className="mt-1 space-y-1 text-[0.83rem] leading-snug text-ink">
            {failed.map((k) => (
              <li key={k.rule} className="flex gap-1.5">
                <X size={14} strokeWidth={2.4} className="mt-[3px] shrink-0 text-lac" aria-hidden />
                <span className="num">
                  <span className="sr-only">Failed: </span>
                  {tidy(shortCheck(k, rec, s))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2.5 flex gap-1.5 text-[0.83rem] leading-snug text-ink">
          <Check size={14} strokeWidth={2.4} className="mt-[3px] shrink-0 text-bangle" aria-hidden />
          <span className="num">
            <span className="sr-only">Passed: </span>
            {passReason(rec, data.phase)}
          </span>
        </p>
      )}

      {rec.checks.length ? (
        <details className="mt-1.5 text-[0.78rem]">
          <summary className="cursor-pointer text-ink-3 hover:text-ink">
            {rec.checks.length === 1 ? (
              'The one check'
            ) : (
              <>
                All <span className="num">{rec.checks.length}</span> checks
              </>
            )}
          </summary>
          <ul className="mt-1.5 space-y-1 text-ink-2">
            {rec.checks.map((k) => (
              <li key={k.rule} className="flex gap-1.5">
                {k.passed ? <Check size={13} strokeWidth={2.4} className="mt-[2px] shrink-0 text-bangle" aria-hidden /> : <X size={13} strokeWidth={2.4} className="mt-[2px] shrink-0 text-lac" aria-hidden />}
                <span className="num">
                  <span className="sr-only">{k.passed ? 'Passed: ' : 'Failed: '}</span>
                  <span className="font-medium text-ink">{k.rule}.</span> {tidy(k.detail)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-2.5 border-t border-line pt-2.5 text-[0.82rem] leading-snug text-ink-2">{tidy(rec.suggestedAction)}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" onClick={onCreateTask}>
          Create task
        </Button>
        {actionable && !paused && status !== 'stopped' && status !== 'completed' ? (
          <Button size="sm" variant="danger" onClick={() => onPause(status)} disabled={busy}>
            {busy ? 'Pausing…' : 'Pause campaign'}
          </Button>
        ) : null}
        {paused ? (
          <Button size="sm" variant="ghost" onClick={onResume} disabled={busy}>
            {busy ? 'Saving…' : 'Set active again'}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
