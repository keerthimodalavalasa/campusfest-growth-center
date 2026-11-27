'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Snapshot, CampaignMetrics } from '@/server/engine/snapshot';
import type { DailyPoint, WeeklyPoint } from '@/server/engine/timeseries';
import type { Diagnosis } from '@/server/engine/diagnose';
import type { DecisionBoard } from '@/server/engine/decide';
import type { EventDays } from '@/server/engine/eventday';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { campaignColor } from '@/lib/colors';
import { dateLabel, inr, inrShort, num, pct } from '@/lib/format';
import { Button, DecisionChip, ErrorNote, Figure, Meter, PageHeader, Panel, SeverityChip, Skeleton, Table, Td, Th } from '@/components/ui';
import { axisProps, CampaignDot, ChartTip, gridProps, Legend } from '@/components/charts';
import { FunnelRibbon } from '@/components/FunnelRibbon';
import { GateClock } from '@/components/GateClock';
import { ChartData } from '@/components/ChartData';
import { TaskDialog, type TaskDraft } from '@/components/TaskDialog';

interface Overview {
  snapshot: Snapshot;
  previous: { asOf: string; phase: Snapshot['phase']; registrations: number; visitors: number; spend: number; costPerRegistration: number | null; costPerVisitor: number | null; costPerExpectedVisitor: number | null; regToVisit: number | null; regToConfirmed: number | null };
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
}

/** "vs last week" line for a figure (Sesama-style period delta). Lower is better for costs. */
function Delta({ now, prev, format, lowerIsBetter, unit = '' }: { now: number | null; prev: number | null; format: (n: number) => string; lowerIsBetter?: boolean; unit?: string }) {
  if (now == null || prev == null || !Number.isFinite(now) || !Number.isFinite(prev)) return <span className="text-ink-3">no comparison yet</span>;
  const d = now - prev;
  if (Math.abs(d) < 1e-9) return <span className="text-ink-3">no change vs last week</span>;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return (
    <span>
      <span className="num font-semibold" style={{ color: good ? 'var(--bangle)' : 'var(--lac)' }}>
        {d > 0 ? '▲' : '▼'} {format(Math.abs(d))}
        {unit}
      </span>{' '}
      <span className="text-ink-3">vs last week</span>
    </span>
  );
}

const PHASE: Record<Snapshot['phase'], string> = {
  'pre-launch': 'Before launch',
  campaign: 'Campaign running',
  event: 'Event days',
  'post-event': 'After the event',
};

export default function OverviewPage() {
  const { askCopilot } = useApp();
  const ov = useApi<Overview>(useAsOfUrl('/api/overview'));
  const gate = useApi<EventDays>(useAsOfUrl('/api/eventday'));
  const camps = useApi<{ decisions: DecisionBoard }>(useAsOfUrl('/api/campaigns'));
  const diag = useApi<Diagnosis>(useAsOfUrl('/api/diagnose'));
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  if (ov.error) return <ErrorNote onRetry={ov.refresh}>{ov.error}</ErrorNote>;
  if (!ov.data) return <OverviewSkeleton />;
  const s = ov.data.snapshot;
  const post = s.phase === 'event' || s.phase === 'post-event';
  const target = s.target;
  const decisions = new Map(camps.data?.decisions.recommendations.map((r) => [r.campaignId, r]) ?? []);

  const lede = (
    <>
      {PHASE[s.phase]}.{' '}
      {target ? (
        <>
          Targets in force: <span className="font-semibold text-ink">{target.version}</span>.{' '}
        </>
      ) : null}
      {s.daysToEvent > 0 ? (
        <>
          <span className="num font-semibold text-ink">{Math.ceil(s.daysToEvent)}</span> days to the event.
        </>
      ) : (
        <>Event held 12–13 Apr 2025.</>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="How the campaign is tracking"
        lede={lede}
        actions={
          <Button variant="secondary" onClick={() => askCopilot(`Summarise how we are tracking as of ${dateLabel(s.asOf, true)}: target attainment, the biggest risk, and the one action you would take this week.`)}>
            Ask the copilot for a summary
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Panel title="Funnel to the gate" aside={`as of ${dateLabel(s.asOf, true)}`}>
          <FunnelRibbon snap={s} />
        </Panel>
        <Panel title="Against target" aside={target ? target.version : 'No target yet'}>
          <div className="space-y-4">
            <AttainmentRow label="Unique verified visitors" value={post ? s.totals.visitors : 0} goal={target?.visitorsGoal ?? null} projected={s.projection?.visitors ?? null} note={post ? undefined : `projected ${num(s.projection?.visitors)} (assumption-based)`} color="var(--lac)" />
            <AttainmentRow label="Registered people" value={s.totals.registrations} goal={target?.registrationGoal ?? null} projected={s.projection?.registrations ?? null} note={s.projection ? `projected ${num(s.projection.registrations)} at today's pace` : undefined} />
            <AttainmentRow label="Identified people" value={s.totals.identified} goal={target?.identifiedGoal ?? null} projected={s.projection?.identified ?? null} />
            <AttainmentRow label="Net marketing spend" value={s.totals.spend} goal={target?.budget ?? null} projected={s.projection?.spend ?? null} money color="var(--sagar)" note={s.projection ? `projected ${inr(s.projection.spend)} by event day` : undefined} />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Figure label="Cost per registration" value={inr(s.totals.costs.perRegistration)} sub={<Delta now={s.totals.costs.perRegistration} prev={ov.data.previous.costPerRegistration} format={(n) => inr(n)} lowerIsBetter />} />
            <Figure
              label={post ? 'Cost per visitor' : 'Cost per expected visitor'}
              value={inr(post ? s.totals.costs.perVisitor : s.totals.costs.perExpectedVisitor)}
              sub={<Delta now={post ? s.totals.costs.perVisitor : s.totals.costs.perExpectedVisitor} prev={post ? (ov.data.previous.phase === 'post-event' || ov.data.previous.phase === 'event' ? ov.data.previous.costPerVisitor : null) : ov.data.previous.costPerExpectedVisitor} format={(n) => inr(n)} lowerIsBetter />}
            />
            <Figure
              label={post ? 'Registrants who came' : 'Confirmed share'}
              value={post ? pct(s.totals.rates.regToVisit) : pct(s.totals.rates.regToConfirmed)}
              sub={<Delta now={post ? s.totals.rates.regToVisit : s.totals.rates.regToConfirmed} prev={post ? ov.data.previous.regToVisit : ov.data.previous.regToConfirmed} format={(n) => (n * 100).toFixed(1)} unit=" pts" />}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Registrations against the goal pace" aside={<Legend items={[{ label: 'Registered', color: 'var(--ink)' }, { label: 'Confirmed', color: 'var(--sagar)' }, { label: 'Goal pace', color: 'var(--zari-bright)', dashed: true }]} />}>
          <CumulativeChart daily={ov.data.daily} momentum={s.totals.momentum} live={s.phase === 'campaign'} />
          <ChartData>
            <DailyTable daily={ov.data.daily} />
          </ChartData>
        </Panel>
        <Panel title="New registrations per week, by campaign" aside={<span>tap a bar for detail</span>}>
          <WeeklyStack weekly={ov.data.weekly} campaigns={s.campaigns} />
        </Panel>
      </div>

      {post && gate.data ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Panel title="Arrivals at the gate" aside="first entries by hour, India time">
              <GateClock data={gate.data} size={340} />
            </Panel>
        <Panel title="What needs attention" aside={diag.data ? `${diag.data.signals.length} signals` : null}>
          {diag.data ? (
            diag.data.signals.length ? (
              <ul className="space-y-3">
                {diag.data.signals.slice(0, 5).map((sig) => (
                  <li key={sig.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <SeverityChip severity={sig.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.9rem] font-semibold leading-snug">{sig.title}</div>
                        <div className="mt-0.5 text-[0.8rem] text-ink-2">{sig.evidence}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setDraft({ title: sig.suggestedAction.split('.')[0], description: sig.suggestedAction, campaign_id: sig.campaignId, evidence: `${sig.title}. ${sig.evidence} (as of ${dateLabel(s.asOf, true)})`, priority: sig.severity === 'high' ? 'high' : 'medium', source: 'insight' })}>
                            Create task
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => askCopilot(`Explain this signal and what you would do about it, using the data as of ${s.asOf}: "${sig.title}"`)}>
                            Ask why
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9rem] text-ink-2">No signals fired at this date.</p>
            )
          ) : (
            <Skeleton className="h-48" />
          )}
        </Panel>
          </div>
        <Panel title="Campaign scoreboard" aside={<Link href="/campaigns" className="font-medium text-sagar hover:underline">All campaign detail</Link>} pad={false} className="p-5">
          <Scoreboard campaigns={s.campaigns} post={post} decisions={decisions} />
        </Panel>
        </>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Campaign scoreboard" aside={<Link href="/campaigns" className="font-medium text-sagar hover:underline">All campaign detail</Link>} pad={false} className="p-5">
          <Scoreboard campaigns={s.campaigns} post={post} decisions={decisions} />
        </Panel>
        <Panel title="What needs attention" aside={diag.data ? `${diag.data.signals.length} signals` : null}>
          {diag.data ? (
            diag.data.signals.length ? (
              <ul className="space-y-3">
                {diag.data.signals.slice(0, 5).map((sig) => (
                  <li key={sig.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start gap-2">
                      <SeverityChip severity={sig.severity} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.9rem] font-semibold leading-snug">{sig.title}</div>
                        <div className="mt-0.5 text-[0.8rem] text-ink-2">{sig.evidence}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => setDraft({ title: sig.suggestedAction.split('.')[0], description: sig.suggestedAction, campaign_id: sig.campaignId, evidence: `${sig.title}. ${sig.evidence} (as of ${dateLabel(s.asOf, true)})`, priority: sig.severity === 'high' ? 'high' : 'medium', source: 'insight' })}>
                            Create task
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => askCopilot(`Explain this signal and what you would do about it, using the data as of ${s.asOf}: "${sig.title}"`)}>
                            Ask why
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.9rem] text-ink-2">No signals fired at this date.</p>
            )
          ) : (
            <Skeleton className="h-48" />
          )}
        </Panel>
        </div>
      )}
      <TaskDialog open={!!draft} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function AttainmentRow({ label, value, goal, projected, note, money, color = 'var(--ink)' }: { label: string; value: number; goal: number | null; projected?: number | null; note?: string; money?: boolean; color?: string }) {
  const share = goal ? value / goal : null;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[0.88rem] font-medium text-ink-2">{label}</span>
        <span className="num text-[0.9rem]">
          <span className="type-title text-[1.05rem] text-ink">{money ? inrShort(value) : num(value)}</span>
          {goal ? <span className="text-ink-3"> / {money ? inrShort(goal) : num(goal)}</span> : null}
          {share != null ? <span className="ml-2 font-semibold" style={{ color: share >= 1 ? 'var(--bangle)' : 'var(--ink-2)' }}>{pct(share, 0)}</span> : null}
        </span>
      </div>
      <Meter value={value} goal={goal} projected={projected} color={color} />
      {note ? <div className="mt-1 text-[0.75rem] text-ink-3">{note}</div> : null}
    </div>
  );
}

function CumulativeChart({ daily, momentum, live }: { daily: DailyPoint[]; momentum: { regsLast7: number; regsPrev7: number }; live: boolean }) {
  const revision = useMemo(() => {
    for (let i = 1; i < daily.length; i++) if (daily[i].registrationGoal !== daily[i - 1].registrationGoal) return daily[i].date;
    return null;
  }, [daily]);
  const last = daily.length - 1;
  const up = momentum.regsLast7 >= momentum.regsPrev7;
  /** Live head (pattern after benji.org/liveline): the as-of value in a pill, a soft pulse and a momentum arrow. */
  const LiveHead = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index } = props;
    if (index !== last || cx == null || cy == null) return <g key={`d-${index}`} />;
    const label = live ? `${num(daily[last].registrations)} ${up ? '▲' : '▼'} ${num(momentum.regsLast7)} this week` : `${num(daily[last].registrations)} registered`;
    const w = label.length * 6.6 + 16;
    const x = Math.max(4, cx - w - 10);
    return (
      <g key="live-head">
        {live ? <circle cx={cx} cy={cy} r={4} fill="var(--ink)" className="live-pulse" opacity={0.5} /> : null}
        <circle cx={cx} cy={cy} r={4} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        <rect x={x} y={cy - 26} width={w} height={20} rx={10} fill="var(--ink)" />
        <text x={x + w / 2} y={cy - 12} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#fff" className="num">
          {label}
        </text>
      </g>
    );
  };
  return (
    <div className="h-64">
      <ResponsiveContainer debounce={250} width="100%" height="100%">
        <ComposedChart data={daily} margin={{ top: 28, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={(d: string) => dateLabel(d)} minTickGap={36} />
          <YAxis {...axisProps} tickFormatter={(v: number) => num(v)} width={52} />
          <Tooltip content={<ChartTip labelFormat={(l) => dateLabel(l, true)} format={(v) => num(v)} />} />
          {revision ? <ReferenceLine x={revision} stroke="var(--zari-bright)" strokeWidth={1.5} label={{ value: 'targets revised', position: 'insideTopLeft', fill: 'var(--zari)', fontSize: 11 }} /> : null}
          <Area type="monotone" dataKey="registrations" name="Registered" stroke="var(--ink)" strokeWidth={2} fill="var(--ink)" fillOpacity={0.07} dot={LiveHead} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke="var(--sagar)" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="registrationPace" name="Goal pace" stroke="var(--zari-bright)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DailyTable({ daily }: { daily: DailyPoint[] }) {
  const rows = [...daily].reverse().filter((d) => d.newRegistrations || d.spend || d.newVisitors);
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th align="right">New registrations</Th>
          <Th align="right">Registered to date</Th>
          <Th align="right">Confirmed</Th>
          <Th align="right">Goal pace</Th>
          <Th align="right">Net spend</Th>
          <Th align="right">New visitors</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.date}>
            <Td>{dateLabel(d.date, true)}</Td>
            <Td align="right">{num(d.newRegistrations)}</Td>
            <Td align="right">{num(d.registrations)}</Td>
            <Td align="right">{num(d.confirmed)}</Td>
            <Td align="right">{num(d.registrationPace)}</Td>
            <Td align="right">{inr(d.spend)}</Td>
            <Td align="right">{num(d.newVisitors)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function WeeklyStack({ weekly, campaigns }: { weekly: WeeklyPoint[]; campaigns: CampaignMetrics[] }) {
  const ids = campaigns.filter((c) => c.campaignId !== 'UNATTRIBUTED').map((c) => c.campaignId);
  const names = new Map(campaigns.map((c) => [c.campaignId, c.name]));
  const data = weekly
    .filter((w) => w.newRegistrations > 0 || w.spend !== 0)
    .map((w) => ({ week: w.monday, total: w.newRegistrations, ...Object.fromEntries(ids.map((id) => [id, w.byCampaign[id]?.registrations ?? 0])) }));
  return (
    <>
      <div className="h-56">
        <ResponsiveContainer debounce={250} width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="week" {...axisProps} tickFormatter={(d: string) => dateLabel(d)} />
            <YAxis {...axisProps} width={44} />
            <Tooltip content={<ChartTip labelFormat={(l) => `Week of ${dateLabel(l, true)}`} format={(v) => num(v)} />} cursor={{ fill: 'var(--paper-2)' }} />
            {ids.map((id, i) => (
              <Bar key={id} dataKey={id} name={names.get(id)} stackId="w" fill={campaignColor(id)} stroke="var(--surface)" strokeWidth={1} radius={i === ids.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3">
        <Legend items={ids.map((id) => ({ label: names.get(id) ?? id, color: campaignColor(id) }))} />
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Week of</Th>
              {ids.map((id) => (
                <Th key={id} align="right">
                  {names.get(id)}
                </Th>
              ))}
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((w) => (
              <tr key={w.week}>
                <Td>{dateLabel(w.week, true)}</Td>
                {ids.map((id) => (
                  <Td key={id} align="right">
                    {num((w as Record<string, number | string>)[id] as number)}
                  </Td>
                ))}
                <Td align="right" className="font-semibold">
                  {num(w.total)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </>
  );
}

function Scoreboard({ campaigns, post, decisions }: { campaigns: CampaignMetrics[]; post: boolean; decisions: Map<string, DecisionBoard['recommendations'][number]> }) {
  const rows = campaigns.filter((c) => c.campaignId !== 'UNATTRIBUTED');
  return (
    <Table>
      <thead>
        <tr>
          <Th>Campaign</Th>
          <Th>Share of spend vs share of {post ? 'visitors' : 'registrations'}</Th>
          <Th align="right">{post ? 'Cost / visitor' : 'Cost / exp. visitor'}</Th>
          <Th align="right">{post ? 'Show rate' : 'Confirmed'}</Th>
          <Th>Call</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const outShare = post ? c.shares.visitors : c.shares.registrations;
          const d = decisions.get(c.campaignId);
          return (
            <tr key={c.campaignId} className="hover:bg-paper">
              <Td>
                <Link href={`/campaigns/${c.campaignId}`} className="font-medium hover:underline">
                  <CampaignDot id={c.campaignId}>{c.name}</CampaignDot>
                </Link>
              </Td>
              <Td className="min-w-[11rem]">
                <ShareBars spend={c.shares.spend ?? 0} out={outShare ?? 0} />
              </Td>
              <Td align="right">{inr(post ? c.costs.perVisitor : c.costs.perExpectedVisitor)}</Td>
              <Td align="right">{post ? pct(c.rates.regToVisit) : pct(c.rates.regToConfirmed)}</Td>
              <Td>{d ? <DecisionChip decision={d.decision} /> : null}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Two thin bars: what a campaign costs (share of spend) vs what it delivers. */
function ShareBars({ spend, out }: { spend: number; out: number }) {
  const max = 0.4;
  return (
    <div className="space-y-1" title={`Spend ${pct(spend)}, output ${pct(out)}`}>
      <div className="flex items-center gap-2">
        <div className="h-1.5 rounded-full bg-ink-3" style={{ width: `${Math.min(100, (spend / max) * 100)}%`, minWidth: 2 }} />
        <span className="num text-[0.72rem] text-ink-3">{pct(spend, 0)}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (out / max) * 100)}%`, minWidth: 2, background: out >= spend ? 'var(--bangle)' : 'var(--lac)' }} />
        <span className="num text-[0.72rem] text-ink-3">{pct(out, 0)}</span>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-12 w-96" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
