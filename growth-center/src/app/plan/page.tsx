'use client';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { mutate, useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { inr, inrShort, num, pct } from '@/lib/format';
import { Button, Chip, ErrorNote, PageHeader, Panel, Select, Skeleton, Table, Td, Th, cx } from '@/components/ui';

/* ------------------------------------------------------------------ types (subset of analysis/out/model.json) */
interface Scenario {
  unique_verified_visitors: number;
  rounded: number;
  cost_per_visitor_inr: number;
  registrations: number;
  registrant_show: number;
}
interface Step {
  label: string;
  delta: number;
  rounded?: number;
}
interface Idea {
  rank: number;
  key: string;
  name: string;
  concept: string;
  budget_inr: number;
  owner: string;
  dates: string;
  test_design: string;
  kpis: string[];
  leading_indicator: string;
  thresholds: { scale: string; change: string; stop: string };
  critical_variable: string;
  biggest_risk: string;
  dashboard_ai: string;
  incremental_visitors_base: number;
  incremental_visitors_sponsor_band: number | null;
  incremental_visitors_stretch: number;
  person_weeks: number;
  ice: { I: number; C: number; E: number; I_basis?: string; C_basis?: string; E_basis?: string };
}
interface Plan {
  meta: { fest: string; north_star: string };
  base: Scenario;
  stretch: Scenario;
  floor: Scenario & { definition?: string };
  sponsor_band: { delta_visitors: number; base_plus_band: number };
  waterfall: { base: Step[] | { steps: Step[] } };
  growth_split_base: { growth: number; from_more_registrations: number; from_better_show_up: number; of_which_engine: number; of_which_mix_shift: number };
  funnel: { base: { stage: string; count: number; rate?: number; basis?: string }[]; stretch: { stage: string; count: number; rate?: number }[] };
  sensitivities: { base: { sensitivity: string; delta_visitors: number; basis: string }[] };
  budget: { lines: { key: string; idea: string | null; line: string; inr: number }[]; total: number };
  capacity: { base: Record<string, number>; stretch: Record<string, number>; permit_ask: string | Record<string, number> };
  ideas: Idea[];
  timeline: { phase: string; dates: string; items: string[] }[];
  checks: { check: string; pass: boolean; detail: string }[];
  inputs: Record<string, { value: unknown; flag: string; basis: string; source?: string } | unknown>;
}
interface Initiative {
  id: string;
  rank: number;
  name: string;
  status: string;
  owner_name: string | null;
  task_count: number;
  tasks_done: number;
  evidence: { campaigns: string[]; spend: number; registrations: number; visitors: number | null; costPerVisitor: number | null; showRate: number | null } | null;
}

const STATUS = ['planned', 'testing', 'scaling', 'changed', 'stopped', 'done'] as const;
const STATUS_LABEL: Record<string, string> = { planned: 'Planned', testing: 'Testing', scaling: 'Scaling', changed: 'Changed', stopped: 'Stopped', done: 'Done' };

type RawStep = Step & { step?: string; exact?: number; integer?: number };
const stepsOf = (w: Plan['waterfall']['base']): Step[] =>
  ((Array.isArray(w) ? w : w.steps ?? []) as RawStep[])
    .map((s) => ({ label: s.label ?? s.step ?? '', delta: s.delta ?? s.exact ?? 0, rounded: s.integer }))
    .filter((s) => Math.abs(s.rounded ?? s.delta) >= 1); // steps that round to zero add noise, not information

export default function PlanPage() {
  const { askCopilot } = useApp();
  const plan = useApi<Plan>('/api/plan');
  const ini = useApi<{ initiatives: Initiative[] }>(useAsOfUrl('/api/initiatives'));
  const [open, setOpen] = useState<string | null>('engine');

  if (plan.error) return <ErrorNote onRetry={plan.refresh}>{plan.error}</ErrorNote>;
  if (!plan.data) return <Skeleton className="h-[80vh]" />;
  const p = plan.data;
  const byKey = new Map(ini.data?.initiatives.map((i) => [i.id, i]) ?? []);

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Hyderabad 2027: aim for ${num(p.stretch.rounded)}, commit to ${num(p.base.rounded)}`}
        lede={
          <>
            Unique verified external visitors at HITEX, {p.meta.fest || 'Hyderabad, Sat–Sun 13–14 Mar 2027'}, on the same ₹3 lakh as 2025. Every step above the base unlocks at a dated gate, not with more money. Numbers come from <code className="rounded bg-paper-2 px-1">analysis/model.py</code>; all {p.checks.filter((c) => c.pass).length} of {p.checks.length} model checks pass.
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => askCopilot('Walk me through the Hyderabad 2027 plan: which bet carries the most risk, and what is the earliest signal that tells us?')}>
            Ask the copilot about the plan
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="How high we aim" aside="verified visitors">
          <TargetLadder p={p} />
        </Panel>
        <Panel title="Why the base is believable" aside={`2,050 to ${num(p.base.rounded)}`}>
          <Waterfall steps={stepsOf(p.waterfall.base)} start={2050} end={p.base.unique_verified_visitors} />
          <p className="mt-3 text-[0.85rem] text-ink-2">
            Growth of <span className="num font-semibold text-ink">+{num(p.growth_split_base.growth)}</span>: <span className="num">+{num(p.growth_split_base.from_more_registrations)}</span> from more registrations and{' '}
            <span className="num">+{num(p.growth_split_base.from_better_show_up)}</span> from better show-up (engine <span className="num">+{num(p.growth_split_base.of_which_engine)}</span>, mix shift to high-show channels <span className="num">+{num(p.growth_split_base.of_which_mix_shift)}</span>).
          </p>
        </Panel>
      </div>

      <Panel title="Five bets, ranked by ICE" aside="Impact, Confidence, Ease, each 1–10">
        <div className="divide-y divide-line">
          {p.ideas.map((idea) => (
            <BetRow key={idea.key} idea={idea} live={byKey.get(idea.key)} open={open === idea.key} onToggle={() => setOpen(open === idea.key ? null : idea.key)} onAsk={() => askCopilot(`For the 2027 bet "${idea.name}": using the 2025 data, what evidence supports it, what is its leading indicator, and what would make us stop it?`)} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Funnel, base vs stretch" pad={false} className="p-5">
          <FunnelTable p={p} />
        </Panel>
        <Panel title="Where the ₹3 lakh goes" aside={inr(p.budget.total)}>
          <BudgetBars lines={p.budget.lines} total={p.budget.total} />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title="Timeline and gates">
          <Timeline items={p.timeline} />
        </Panel>
        <div className="space-y-5">
          <Panel title="What could move the base" aside="visitors vs base">
            <Tornado rows={p.sensitivities.base} />
          </Panel>
          <Panel title="Capacity is not the constraint">
            <Capacity p={p} />
          </Panel>
        </div>
      </div>

      <Panel title="Inputs: sourced facts vs assumptions" pad={false} className="p-5">
        <Inputs inputs={p.inputs} />
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ target ladder */
function TargetLadder({ p }: { p: Plan }) {
  const rows = [
    { label: '2025 actual', value: 2050, cpv: 134, tone: 'var(--ink-3)', note: '₹2.74L net spend' },
    { label: 'Floor', value: p.floor.unique_verified_visitors, cpv: p.floor.cost_per_visitor_inr, tone: 'var(--ink-2)', note: 'every channel 15% worse, engine at half strength' },
    { label: 'Base, our commitment', value: p.base.unique_verified_visitors, cpv: p.base.cost_per_visitor_inr, tone: 'var(--ink)', note: `${pct(p.base.registrant_show)} of registrants show up` },
    { label: 'With a prize sponsor', value: p.sponsor_band.base_plus_band, cpv: null, tone: 'var(--zari-bright)', note: `+${num(p.sponsor_band.delta_visitors)} only if signed by 12 Jan` },
    { label: 'Stretch, our aim', value: p.stretch.unique_verified_visitors, cpv: p.stretch.cost_per_visitor_inr, tone: 'var(--lac)', note: 'each mechanism proven at its gate' },
  ];
  const max = Math.max(...rows.map((r) => r.value)) * 1.06;
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-[0.88rem] font-medium text-ink-2">{r.label}</span>
            <span className="num">
              <span className="type-title text-[1.15rem]" style={{ color: r.tone === 'var(--ink-3)' ? 'var(--ink-2)' : r.tone }}>
                {num(r.value)}
              </span>
              {r.cpv != null ? <span className="ml-2 text-[0.8rem] text-ink-3">{inr(r.cpv)} each</span> : null}
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-paper-2">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.tone }} />
            <div className="absolute -inset-y-1 w-px bg-ink-3" style={{ left: `${(2050 / max) * 100}%` }} title="2025 actual" />
          </div>
          <div className="mt-0.5 text-[0.75rem] text-ink-3">{r.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ waterfall */
function Waterfall({ steps, start, end }: { steps: Step[]; start: number; end: number }) {
  // running totals computed without mutation (prefix sums)
  const after = steps.map((_, i) => start + steps.slice(0, i + 1).reduce((t, s) => t + s.delta, 0));
  const lo = Math.min(start, ...after) * 0.86;
  const hi = Math.max(start, end, ...after) * 1.02;
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const bars = [
    { label: '2025', from: 0, to: start, kind: 'total' as const, delta: 0 },
    ...steps.map((s, i) => ({ label: s.label, from: i === 0 ? start : after[i - 1], to: after[i], kind: s.delta >= 0 ? ('up' as const) : ('down' as const), delta: s.rounded ?? s.delta })),
    { label: 'Base', from: 0, to: end, kind: 'total' as const, delta: 0 },
  ];
  return (
    <div>
      <div className="flex h-56 items-end gap-1.5" role="img" aria-label={`Waterfall from ${start} to ${Math.round(end)}`}>
        {bars.map((b, i) => {
          const a = b.kind === 'total' ? lo : Math.min(b.from, b.to);
          const z = b.kind === 'total' ? b.to : Math.max(b.from, b.to);
          const color = b.kind === 'total' ? (i === 0 ? 'var(--ink-3)' : 'var(--ink)') : b.kind === 'up' ? 'var(--bangle)' : 'var(--lac)';
          const text = b.kind === 'total' ? num(b.to) : `${b.delta > 0 ? '+' : '−'}${num(Math.abs(b.delta))}`;
          return (
            <div key={i} className="relative flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="absolute inset-x-0 rounded-[4px]" style={{ bottom: `${y(a)}%`, height: `${Math.max(1, y(z) - y(a))}%`, background: color }} title={`${b.label}: ${text}`} />
              <div className="num absolute inset-x-0 text-center text-[0.75rem] font-semibold text-ink" style={{ bottom: `calc(${y(z)}% + 3px)` }}>
                {text}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {bars.map((b, i) => (
          <div key={i} className="min-w-0 flex-1 text-center text-[0.7rem] leading-tight text-ink-3" title={b.label}>
            {shortLabel(b.label)}
          </div>
        ))}
      </div>
    </div>
  );
}
function shortLabel(l: string) {
  if (/^2025|^Base$/.test(l)) return l;
  if (/paid social/i.test(l)) return 'Paid cut';
  if (/creators/i.test(l)) return 'Creators cut';
  if (/grid/i.test(l) && !/reserve/i.test(l)) return 'College grid';
  if (/squad|referral/i.test(l)) return 'Squad Pass';
  if (/reserve/i.test(l)) return 'Reserve';
  if (/engine/i.test(l)) return 'Show-up engine';
  if (/compete/i.test(l)) return 'Competitions';
  if (/walk/i.test(l)) return 'Walk-ins';
  return l.split(/[ (]/).slice(0, 2).join(' ');
}

/* ------------------------------------------------------------------ bets */
function BetRow({ idea, live, open, onToggle, onAsk }: { idea: Idea; live?: Initiative; open: boolean; onToggle: () => void; onAsk: () => void }) {
  const ice = (idea.ice.I + idea.ice.C + idea.ice.E) / 3;
  const [saving, setSaving] = useState(false);
  const setStatus = async (status: string) => {
    if (!live) return;
    setSaving(true);
    try {
      await mutate(`/api/initiatives/${live.id}`, 'PATCH', { status });
      toast.success(`${live.name}: ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="py-3.5">
      <div className="grid grid-cols-1 items-center gap-3 md:grid-cols-[2.2rem_minmax(0,1fr)_8.5rem_10rem_12rem]">
        <span className="type-display text-[1.4rem] text-ink-3 num">{idea.rank}</span>
        <button onClick={onToggle} aria-expanded={open} className="min-w-0 text-left">
          <div className="font-semibold leading-snug text-ink">{live?.name ?? idea.name}</div>
          <div className="mt-0.5 line-clamp-2 text-[0.83rem] text-ink-2">{idea.concept}</div>
        </button>
        <div className="num text-[0.85rem]">
          <div>
            {Math.round(idea.incremental_visitors_base) !== 0 ? (
              <>
                <span className="font-semibold text-bangle">+{num(idea.incremental_visitors_base)}</span> <span className="text-ink-3">base</span>
              </>
            ) : (
              <span className="text-ink-3" title="Gated on a pilot or a sponsor, so the base counts nothing for it">none in base</span>
            )}
          </div>
          <div>
            <span className="font-semibold text-lac">+{num(idea.incremental_visitors_stretch)}</span> <span className="text-ink-3">stretch</span>
          </div>
          {idea.incremental_visitors_sponsor_band ? <div className="text-[0.75rem] text-ink-3">+{num(idea.incremental_visitors_sponsor_band)} if sponsored</div> : null}
        </div>
        <div className="text-[0.82rem]">
          <div className="num font-semibold text-ink">{inr(idea.budget_inr)}</div>
          <div className="text-ink-3">{live?.owner_name ?? idea.owner.split('(')[0]}, {idea.person_weeks} person-weeks</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="num rounded-md bg-paper-2 px-2 py-1 text-[0.82rem] font-semibold text-ink" title={`I ${idea.ice.I}, C ${idea.ice.C}, E ${idea.ice.E}`}>
            ICE {ice.toFixed(2)}
          </span>
          {live ? (
            <Select aria-label={`Status of ${live.name}`} value={live.status} disabled={saving} onChange={(e) => setStatus(e.target.value)} className="h-8 w-[7.6rem] text-[0.8rem]">
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>
      {open ? (
        <div className="mt-3 grid gap-4 rounded-[var(--radius-panel)] bg-paper px-4 py-4 md:ml-[2.2rem] lg:grid-cols-3">
          <div className="space-y-2 text-[0.84rem]">
            <Label>How we test it</Label>
            <p className="text-ink-2">{idea.test_design}</p>
            <Label>Leading indicator</Label>
            <p className="text-ink-2">{idea.leading_indicator}</p>
          </div>
          <div className="space-y-2 text-[0.84rem]">
            <Rule tone="bangle" title="Scale when">{idea.thresholds.scale}</Rule>
            <Rule tone="zari" title="Change when">{idea.thresholds.change}</Rule>
            <Rule tone="lac" title="Stop when">{idea.thresholds.stop}</Rule>
          </div>
          <div className="space-y-2 text-[0.84rem]">
            <Label>Biggest risk</Label>
            <p className="text-ink-2">{idea.biggest_risk}</p>
            <Label>2025 evidence in this app</Label>
            {live?.evidence ? (
              <p className="num text-ink-2">
                {live.evidence.campaigns.join(', ')}: {num(live.evidence.registrations)} registrations, {live.evidence.visitors != null ? `${num(live.evidence.visitors)} visitors, ` : ''}
                {live.evidence.costPerVisitor != null ? `${inr(live.evidence.costPerVisitor)} per visitor, ` : ''}
                {live.evidence.showRate != null ? `${pct(live.evidence.showRate)} show rate` : ''}
              </p>
            ) : (
              <p className="text-ink-3">New mechanism: no 2025 channel to compare, so it is tested before money scales.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={`/execute`} className="inline-flex h-8 items-center rounded-[var(--radius-control)] border border-line-2 bg-surface px-2.5 text-[0.82rem] font-medium hover:bg-paper">
                {live ? `${live.tasks_done} of ${live.task_count} tasks done` : 'Tasks'}
              </Link>
              <Button size="sm" variant="ghost" onClick={onAsk}>
                Ask the copilot
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[0.78rem] font-semibold text-ink-3">{children}</div>;
function Rule({ tone, title, children }: { tone: 'bangle' | 'zari' | 'lac'; title: string; children: React.ReactNode }) {
  return (
    <div className={cx('rounded-lg border-l-[3px] bg-surface px-3 py-2', tone === 'bangle' && 'border-bangle', tone === 'zari' && 'border-zari-bright', tone === 'lac' && 'border-lac')}>
      <div className="text-[0.78rem] font-semibold" style={{ color: `var(--${tone === 'zari' ? 'zari' : tone})` }}>
        {title}
      </div>
      <div className="text-ink-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ funnel / budget / timeline / sensitivities / capacity / inputs */
function FunnelTable({ p }: { p: Plan }) {
  const stretch = new Map(p.funnel.stretch.map((s) => [s.stage, s]));
  return (
    <Table>
      <thead>
        <tr>
          <Th>Stage</Th>
          <Th align="right">Base</Th>
          <Th align="right">Rate</Th>
          <Th align="right">Stretch</Th>
        </tr>
      </thead>
      <tbody>
        {p.funnel.base.map((s) => (
          <tr key={s.stage}>
            <Td className="text-[0.85rem]" title={s.basis}>
              {s.stage}
            </Td>
            <Td align="right" className="font-semibold">
              {num(s.count)}
            </Td>
            <Td align="right" className="text-ink-3">
              {s.rate != null ? pct(s.rate) : ''}
            </Td>
            <Td align="right">{num(stretch.get(s.stage)?.count)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function BudgetBars({ lines, total }: { lines: Plan['budget']['lines']; total: number }) {
  const sorted = [...lines].sort((a, b) => b.inr - a.inr);
  const max = sorted[0]?.inr ?? 1;
  return (
    <ul className="space-y-2">
      {sorted.map((l) => (
        <li key={l.key} className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3">
          <div className="min-w-0">
            <div className="truncate text-[0.84rem] text-ink" title={l.line}>
              {l.line}
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-paper-2">
              <div className="h-full rounded-full bg-ink" style={{ width: `${(l.inr / max) * 100}%` }} />
            </div>
          </div>
          <div className="num text-right text-[0.85rem] font-semibold">
            {inrShort(l.inr)}
            <span className="ml-1 text-[0.75rem] font-normal text-ink-3">{pct(l.inr / total, 0)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Timeline({ items }: { items: Plan['timeline'] }) {
  return (
    <ol className="relative space-y-4 border-l border-line-2 pl-5">
      {items.map((t) => {
        const gate = t.items.some((i) => /GATE \d|LOCK/i.test(i));
        return (
          <li key={t.phase} className="relative">
            <span className={cx('absolute -left-[27px] top-1 size-3 rounded-full border-2 border-surface', gate ? 'bg-lac' : 'bg-ink-3')} aria-hidden />
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-semibold text-ink">{t.phase.replace(/^\d+\.\s*/, '')}</span>
              <span className="num text-[0.8rem] text-ink-3">{t.dates}</span>
            </div>
            <ul className="mt-1 space-y-0.5 text-[0.82rem] text-ink-2">
              {t.items.slice(0, 4).map((i) => (
                <li key={i} className={cx(/GATE \d|LOCK/i.test(i) && 'font-medium text-ink')}>
                  {i.replace(/\s*\[[^\]]+\]/g, '')}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function Tornado({ rows }: { rows: Plan['sensitivities']['base'] }) {
  const sorted = [...rows].sort((a, b) => Math.abs(b.delta_visitors) - Math.abs(a.delta_visitors)).slice(0, 7);
  const max = Math.max(...sorted.map((r) => Math.abs(r.delta_visitors)), 1);
  return (
    <ul className="space-y-2">
      {sorted.map((r) => (
        <li key={r.sensitivity} title={r.basis}>
          <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
            <span className="text-ink-2">{r.sensitivity.replace(/\s*\[[^\]]+\]/g, '')}</span>
            <span className="num font-semibold" style={{ color: r.delta_visitors < 0 ? 'var(--lac)' : 'var(--bangle)' }}>
              {r.delta_visitors > 0 ? '+' : '−'}
              {num(Math.abs(r.delta_visitors))}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-paper-2">
            <div className="h-full rounded-full" style={{ width: `${(Math.abs(r.delta_visitors) / max) * 100}%`, background: r.delta_visitors < 0 ? 'var(--lac)' : 'var(--bangle)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Capacity({ p }: { p: Plan }) {
  const c = p.capacity;
  const peakB = c.base.on_site_peak ?? c.base.peak_on_site ?? Object.values(c.base).find((v) => typeof v === 'number' && v > 1500 && v < 4000);
  const peakS = c.stretch.on_site_peak ?? c.stretch.peak_on_site ?? Object.values(c.stretch).find((v) => typeof v === 'number' && v > 1500 && v < 4000);
  return (
    <div className="space-y-2 text-[0.85rem] text-ink-2">
      <p>
        Base peak on site <span className="num font-semibold text-ink">{num(peakB as number)}</span>, stretch <span className="num font-semibold text-ink">{num(peakS as number)}</span>, against a police permit asked for 5,000 concurrent and 6,000 daily at HITEX (Cyberabad CPPMS).
      </p>
      <p>Passes are capped at 4,500 and walk-ins at 300 a day, so even the worst case stays under the permit. Fallback venue with a different owner: G.M.C. Balayogi Indoor Stadium.</p>
    </div>
  );
}

function Inputs({ inputs }: { inputs: Plan['inputs'] }) {
  const [show, setShow] = useState<'all' | 'fact' | 'assumption'>('all');
  const [expanded, setExpanded] = useState(false);
  const rows = Object.entries(inputs)
    .map(([k, v]) => ({ k, ...(v as { value: unknown; flag: string; basis: string; source?: string }) }))
    .filter((r) => r && r.flag && (show === 'all' || (show === 'fact' ? r.flag.startsWith('fact') : r.flag !== 'fact' && !r.flag.startsWith('fact'))));
  const fmt = (v: unknown) => (typeof v === 'number' ? (Math.abs(v) < 2 && !Number.isInteger(v) ? String(Math.round(v * 1000) / 1000) : num(v)) : typeof v === 'string' ? v : 'see model');
  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(['all', 'fact', 'assumption'] as const).map((s) => (
          <button key={s} onClick={() => setShow(s)} className={cx('h-7 rounded-full px-3 text-[0.8rem] font-medium', show === s ? 'bg-ink text-white' : 'bg-paper-2 text-ink-2')}>
            {s === 'all' ? 'All inputs' : s === 'fact' ? 'Sourced facts' : 'Assumptions and decisions'}
          </button>
        ))}
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Input</Th>
            <Th>Value</Th>
            <Th>Type</Th>
            <Th>Basis</Th>
          </tr>
        </thead>
        <tbody>
          {(expanded ? rows : rows.slice(0, 12)).map((r) => (
            <tr key={r.k}>
              <Td className="whitespace-nowrap text-[0.8rem] text-ink-2">{r.k.replace(/_/g, ' ')}</Td>
              <Td className="num max-w-[10rem] truncate text-[0.82rem]">{fmt(r.value)}</Td>
              <Td>
                <Chip fg={r.flag.startsWith('fact') ? 'var(--bangle)' : r.flag === 'decision' ? 'var(--sagar)' : 'var(--zari)'} bg={r.flag.startsWith('fact') ? 'var(--bangle-soft)' : r.flag === 'decision' ? 'var(--sagar-soft)' : 'var(--zari-soft)'}>
                  {r.flag}
                </Chip>
              </Td>
              <Td className="text-[0.8rem] text-ink-2">{r.basis}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length > 12 ? (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${rows.length} inputs`}
        </Button>
      ) : null}
    </div>
  );
}
