'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/api';
import { useAsOfUrl } from '@/lib/app-state';
import { campaignColor } from '@/lib/colors';
import { dateLabel, inr, pct } from '@/lib/format';
import { Button, DecisionChip, EmptyState, ErrorNote, PageHeader, Panel, Skeleton } from '@/components/ui';
import { CampaignDot, Legend } from '@/components/charts';
import { CampaignTable } from './_components/CampaignTable';
import { EfficiencyScatter, type ScatterPoint } from './_components/EfficiencyScatter';
import { NewCampaignDialog } from './_components/NewCampaignDialog';
import { isPostEvent, times, UNATTRIBUTED, type CampaignsResponse } from './_components/shared';

export default function CampaignsPage() {
  const q = useApi<CampaignsResponse>(useAsOfUrl('/api/campaigns'));
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const decisions = useMemo(() => new Map(q.data?.decisions.recommendations.map((r) => [r.campaignId, r]) ?? []), [q.data]);

  const newButton = (
    <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setCreating(true)}>
      New campaign
    </Button>
  );
  const dialog = <NewCampaignDialog open={creating} onClose={() => setCreating(false)} onCreated={(id, name) => setCreated({ id, name })} />;

  if (q.error && !q.data)
    return (
      <div className="space-y-5">
        <PageHeader title="Campaigns" actions={newButton} />
        <ErrorNote onRetry={q.refresh}>Could not load campaign metrics: {q.error}</ErrorNote>
        {dialog}
      </div>
    );
  if (!q.data) return <ListSkeleton />;

  const d = q.data;
  const post = isPostEvent(d.phase);
  const named = d.campaigns.filter((c) => c.campaignId !== UNATTRIBUTED);
  // the totals row carries the portfolio show-rate assumption from Settings
  const showRate = d.totals.showRateAssumption;
  const th = d.decisions.thresholds;
  const median = d.decisions.recommendations.find((r) => r.portfolioMedian != null)?.portfolioMedian ?? null;
  const factor = (v: number | null) => (v != null && median ? v / median : null);

  const points: ScatterPoint[] = d.decisions.recommendations
    .filter((r) => r.efficiency != null && Number.isFinite(r.efficiency))
    .map((r) => ({ id: r.campaignId, name: r.name, x: r.efficiency!, y: r.visitorsOrExpected, spend: r.spend }));
  const unplotted = named.filter((c) => !points.some((p) => p.id === c.campaignId));

  const lede = (
    <>
      <span className="num font-semibold text-ink">{named.length}</span> campaigns as of {dateLabel(d.asOf, true)}.{' '}
      {post ? 'Visitor columns are verified gate admissions.' : <>The event has not happened at this date, so visitor columns show expected visitors: confirmed registrants × {pct(showRate, 0)} show-rate assumption.</>}
    </>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Campaigns" lede={lede} actions={newButton} />

      {created ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-bangle/30 bg-bangle-soft px-3 py-2 text-[0.88rem] text-ink">
          <span>
            Created <span className="font-semibold">{created.name}</span> ({created.id}). It has no activity yet; numbers appear once spend or sign-ups are recorded against it.
          </span>
          <span className="flex items-center gap-2">
            <Link href={`/campaigns/${created.id}`} className="font-semibold text-sagar hover:underline">
              Open {created.name}
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>
              Dismiss
            </Button>
          </span>
        </div>
      ) : null}

      {named.length === 0 ? (
        <EmptyState title="No campaigns yet" action={newButton}>
          Create a campaign to start tracking its spend, sign-ups and visitors.
        </EmptyState>
      ) : (
        <>
          <Panel title="Every campaign, stage by stage" aside={<span>Select a column header to sort</span>} pad={false} className="p-5">
            <CampaignTable campaigns={d.campaigns} totals={d.totals} post={post} decisions={decisions} showRate={showRate} />
            <p className="mt-3 text-[0.8rem] text-ink-3">
              The all-campaigns row includes walk-ins and unattributed people, so it is not the average of the campaign rows. Rates are shares of the stage before; costs use net spend.
            </p>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <Panel title={post ? 'What each visitor cost, against how many came' : 'What each expected visitor costs, against how many are expected'}>
              {points.length ? (
                <>
                  <EfficiencyScatter points={points} scaleAt={th.scaleAtOrBelow} stopAt={th.stopAtOrAbove} post={post} />
                  <div className="mt-2">
                    <Legend items={points.map((p) => ({ label: p.name, color: campaignColor(p.id) }))} />
                  </div>
                  <p className="mt-3 max-w-[78ch] text-[0.86rem] text-ink-2">
                    Each dot is a campaign. Up and to the left is better: more {post ? 'visitors' : 'expected visitors'} at a lower cost each. The green band is the scale zone (at or below {times(factor(th.scaleAtOrBelow))} the portfolio median of {inr(median)}); the red band is the stop zone (at or above {times(factor(th.stopAtOrAbove))}). Guardrails on opt-outs, cancellations{post ? ', show-up' : ' and momentum'} can still turn a cheap dot into a Change call.
                    {!post ? ` Expected visitors = confirmed × ${pct(showRate, 0)} show-rate assumption, not observed attendance.` : ''}
                  </p>
                  {unplotted.length ? <p className="mt-1 text-[0.8rem] text-ink-3">Not plotted (no {post ? 'visitors' : 'confirmed registrants'} or no activity yet): {unplotted.map((c) => c.name).join(', ')}.</p> : null}
                </>
              ) : (
                <EmptyState title="Nothing to plot yet">No campaign has both spend and {post ? 'visitors' : 'confirmed registrants'} at this date.</EmptyState>
              )}
            </Panel>

            <Panel title="The calls" aside={<Link href="/decide" className="font-medium text-sagar hover:underline">Open Decide</Link>}>
              <p className="text-[0.84rem] text-ink-2">{d.decisions.basis}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[0.8rem]">
                <Threshold label="Scale at or below" value={th.scaleAtOrBelow} f={factor(th.scaleAtOrBelow)} color="var(--bangle)" />
                <Threshold label="Change above" value={th.changeAbove} f={factor(th.changeAbove)} color="var(--zari)" />
                <Threshold label="Stop at or above" value={th.stopAtOrAbove} f={factor(th.stopAtOrAbove)} color="var(--lac)" />
              </dl>
              {d.decisions.recommendations.length ? (
                <table className="mt-4 w-full border-collapse text-[0.85rem]">
                  <caption className="sr-only">Decision per campaign with its efficiency</caption>
                  <thead>
                    <tr className="type-condensed text-[0.78rem] text-ink-2">
                      <th scope="col" className="border-b border-line-2 py-1.5 pr-2 text-left font-semibold">Call</th>
                      <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-left font-semibold">Campaign</th>
                      <th scope="col" className="border-b border-line-2 px-2 py-1.5 text-right font-semibold">{post ? 'Cost / visitor' : 'Cost / exp. visitor'}</th>
                      <th scope="col" className="border-b border-line-2 py-1.5 pl-2 text-right font-semibold">Vs median</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.decisions.recommendations.map((r) => (
                      <tr key={r.campaignId}>
                        <td className="border-b border-line py-1.5 pr-2">
                          <DecisionChip decision={r.decision} />
                        </td>
                        <td className="border-b border-line px-2 py-1.5">
                          <Link href={`/campaigns/${r.campaignId}`} className="hover:text-sagar hover:underline">
                            <CampaignDot id={r.campaignId}>{r.name}</CampaignDot>
                          </Link>
                        </td>
                        <td className="num border-b border-line px-2 py-1.5 text-right">{inr(r.efficiency)}</td>
                        <td className="num border-b border-line py-1.5 pl-2 text-right">{r.spend > 0 ? times(r.ratioToMedian) : <span className="text-ink-3">net spend ≤ ₹0</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-[0.88rem] text-ink-2">No campaign has enough activity for a call at this date.</p>
              )}
              {d.decisions.reallocations.length ? (
                <div className="mt-4 rounded-[var(--radius-control)] bg-paper-2 px-3 py-2.5">
                  <div className="text-[0.84rem] font-semibold text-ink">Suggested budget moves</div>
                  <ul className="mt-1 space-y-1 text-[0.82rem] text-ink-2">
                    {d.decisions.reallocations.map((m, i) => (
                      <li key={i}>
                        <span className="num font-semibold text-ink">{inr(m.amount)}</span> from {d.campaigns.find((c) => c.campaignId === m.from)?.name ?? m.from} to {d.campaigns.find((c) => c.campaignId === m.to)?.name ?? m.to}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}

function Threshold({ label, value, f, color }: { label: string; value: number | null; f: number | null; color: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-paper-2 px-2.5 py-2">
      <dt className="text-ink-3">{label}</dt>
      <dd className="num mt-0.5 font-semibold" style={{ color }}>
        {inr(value)}
        <span className="ml-1 font-normal text-ink-3">{times(f)}</span>
      </dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-96" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
