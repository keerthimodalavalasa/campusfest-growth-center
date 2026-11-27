'use client';
import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { CheckDuotone, ClipboardListDuotone, PauseDuotone, PlayDuotone, XDuotone } from 'runeicons-react';
import type { CampaignMetrics } from '@/server/engine/snapshot';
import { mutate } from '@/lib/api';
import { DECISION } from '@/lib/colors';
import { dateLabel, inr, inrShort, num } from '@/lib/format';
import { Button, cx, Ico } from '@/components/ui';
import { CampaignCard } from '@/components/CampaignCard';
import { GLYPH } from '@/components/RuleStrip';
import { tipProps } from '@/components/tooltip';
import type { TaskDraft } from '@/components/TaskDialog';
import { StatusText } from '@/app/campaigns/_components/shared';
import { checkChip, COLUMNS, isPost, passReason, shortAction, taskDecision, tidy, type Decision, type DecideResponse, type Recommendation } from './types';

/**
 * Stop / Change / Keep / Scale as four lanes. Each lane is a hairline tray headed by its status block (glyph, word,
 * count); the campaigns inside are the shared limestone CampaignCard with the checks and the actions as its footer.
 */
export function DecisionBoard({ data, onCreateTask }: { data: DecideResponse; onCreateTask: (d: TaskDraft) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const campaigns = new Map(data.campaigns.map((c) => [c.campaignId, c]));
  const post = isPost(data.phase);
  const totalExpected = data.campaigns.reduce((s, c) => s + c.expectedVisitors, 0);
  const visShare = (m: CampaignMetrics) => (post ? (m.shares.visitors ?? 0) : totalExpected > 0 ? m.expectedVisitors / totalExpected : 0);
  const shown = data.recommendations.map((r) => campaigns.get(r.campaignId)).filter((m): m is CampaignMetrics => !!m);
  const maxShare = Math.max(0.01, ...shown.flatMap((m) => [m.shares.spend ?? 0, visShare(m)]));

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

  let order = 0;
  return (
    <section aria-label="Decision board" className="grid grid-cols-4 items-start gap-3 max-[1200px]:grid-cols-2 max-[640px]:grid-cols-1">
      {COLUMNS.map((d, col) => {
        const recs = data.recommendations.filter((r) => r.decision === d);
        const spend = recs.reduce((s, r) => s + r.spend, 0);
        const visitors = recs.reduce((s, r) => s + r.visitorsOrExpected, 0);
        return (
          <div key={d} role="group" aria-label={`${DECISION[d].label}: ${recs.length} ${recs.length === 1 ? 'campaign' : 'campaigns'}`} className="anim-settle flex min-w-0 flex-col rounded-tile-l p-2 shadow-[inset_0_0_0_1.5px_var(--stone-2)]" style={{ '--d': `${160 + col * 40}ms` } as CSSProperties}>
            <header className="px-2 pt-1.5 pb-3">
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-icon" style={{ background: DECISION[d].fg }}>
                  <Ico icon={GLYPH[d]} size={18} ia="#fff" ib="#fff" />
                </span>
                <h3 className="text-[16px] leading-none font-[700]">{DECISION[d].label}</h3>
                <span className="num ml-auto text-[32px] leading-[0.85]">{recs.length}</span>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-[1.35] font-[550] text-ink-2">{laneRule(d, data)}</p>
              <p className="tab mt-0.5 min-h-[17px] text-[12.5px] leading-[1.35] font-[650] text-ink">
                {recs.length ? `${inrShort(spend)} spend, ${num(visitors)} ${post ? 'visitors' : 'expected'}` : null}
              </p>
            </header>
            <div className="flex flex-col gap-2">
              {recs.length ? (
                recs.map((r) => {
                  const m = campaigns.get(r.campaignId);
                  const i = order++;
                  if (!m) return null;
                  const status = m.status ?? 'active';
                  return (
                    <CampaignCard
                      key={r.campaignId}
                      m={m}
                      rec={r}
                      pre={!post}
                      visitorShare={visShare(m)}
                      maxShare={maxShare}
                      delay={220 + i * 40}
                      meta={
                        <span className="flex flex-wrap items-center gap-x-2">
                          <StatusText status={status} />
                          <span className="truncate">{r.ownerName ?? 'No owner'}</span>
                        </span>
                      }
                      footer={
                        <CardFooter
                          rec={r}
                          status={status}
                          busy={busy === r.campaignId}
                          onCreateTask={() => onCreateTask(draftFor(r))}
                          onPause={() => setStatus(r, 'paused', status)}
                          onResume={() => setStatus(r, 'active', 'paused')}
                        />
                      }
                    />
                  );
                })
              ) : (
                <p className="rounded-tile-m border-[1.5px] border-dashed border-stone-3 px-3.5 py-5 text-[13px] font-[550] text-ink-2">No campaign here at this date.</p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function laneRule(d: Decision, data: DecideResponse) {
  const t = data.thresholds;
  const s = data.settings;
  if (t.scaleAtOrBelow == null || t.changeAbove == null || t.stopAtOrAbove == null) {
    return { stop: 'Cost far above the median', change: 'A failed guardrail', keep: 'Guardrails pass, cost near median', scale: 'Every guardrail passes' }[d];
  }
  return {
    stop: `Cost ≥ ${inr(t.stopAtOrAbove)}, ${s.stopCostFactor}× the median`,
    change: `Cost > ${inr(t.changeAbove)}, or a failed guardrail`,
    keep: `Cost ${inr(t.scaleAtOrBelow)} to ${inr(t.changeAbove)}, guardrails pass`,
    scale: `Cost ≤ ${inr(t.scaleAtOrBelow)}, every guardrail passes`,
  }[d];
}

/** The card footer: one chip per check (failed ones solid), the action in a few words, and the buttons. */
function CardFooter({ rec, status, busy, onCreateTask, onPause, onResume }: { rec: Recommendation; status: string; busy: boolean; onCreateTask: () => void; onPause: () => void; onResume: () => void }) {
  const paused = status === 'paused';
  const actionable = rec.decision === 'stop' || rec.decision === 'change';
  const failing = rec.checks.filter((k) => !k.passed).length;
  return (
    // lifted above the card's full-size link so the chips and buttons stay their own targets
    <div className="relative z-[1] mt-auto pt-3">
      <div className="pt-3 shadow-[inset_0_1px_0_var(--stone-2)]">
        <div className="flex items-baseline justify-between gap-2 text-[12px] font-[600] text-ink-2">
          <span>Checks</span>
          <span className="tab">{rec.checks.length ? (failing ? `${failing} of ${rec.checks.length} fail` : 'all pass') : 'not enough data'}</span>
        </div>
        {rec.checks.length ? (
          <ul className="mt-1.5 flex flex-wrap gap-1" aria-label="Checks">
            {rec.checks.map((k) => (
              <li
                key={k.rule}
                tabIndex={0}
                {...tipProps({ title: k.rule, notes: [tidy(k.detail)] })}
                className={cx('inline-flex h-[22px] cursor-default items-center gap-1 rounded-full pr-2 pl-1 text-[11.5px] leading-none font-[650] whitespace-nowrap', k.passed ? 'bg-stone-2 text-ink' : 'bg-st-stop text-white')}
              >
                <Ico icon={k.passed ? CheckDuotone : XDuotone} size={13} ia={k.passed ? 'var(--ink)' : '#fff'} ib={k.passed ? 'var(--ink)' : '#fff'} />
                <span className="sr-only">{k.passed ? 'Passed: ' : 'Failed: '}</span>
                {checkChip(k, rec)}
              </li>
            ))}
          </ul>
        ) : null}
        <p tabIndex={0} {...tipProps({ title: 'Suggested action', notes: [tidy(rec.suggestedAction)] })} className="mt-2.5 w-fit cursor-default rounded-md text-[13px] leading-[1.35] font-[650] text-ink">
          {shortAction(rec)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={onCreateTask} icon={<Ico icon={ClipboardListDuotone} size={15} ia="var(--ink)" ib="var(--stone-3)" />}>
            Create task
          </Button>
          {actionable && !paused && status !== 'stopped' && status !== 'completed' ? (
            <Button size="sm" variant="danger" onClick={onPause} disabled={busy} icon={<Ico icon={PauseDuotone} size={15} ia="var(--st-stop)" ib="color-mix(in srgb, var(--st-stop) 40%, transparent)" />}>
              {busy ? 'Pausing…' : 'Pause campaign'}
            </Button>
          ) : null}
          {paused ? (
            <Button size="sm" variant="ghost" onClick={onResume} disabled={busy} icon={<Ico icon={PlayDuotone} size={15} ia="var(--ink)" ib="var(--stone-3)" />}>
              {busy ? 'Saving…' : 'Set active again'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
