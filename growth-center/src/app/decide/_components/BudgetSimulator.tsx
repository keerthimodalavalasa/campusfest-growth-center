'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, X } from 'lucide-react';
import type { Simulation } from '@/server/engine/simulate';
import { api } from '@/lib/api';
import { dateLabel, inr, num, pct, signed } from '@/lib/format';
import { Button, ErrorNote, Panel, Select, Skeleton, Table, Td, TextInput, Th, cx } from '@/components/ui';
import { axisProps, CampaignDot, ChartTip, gridProps, Legend } from '@/components/charts';
import type { TaskDraft } from '@/components/TaskDialog';
import { isPost, tidy, type DecideResponse } from './types';

interface MoveRow {
  key: number;
  from: string;
  to: string;
  amount: string;
  /** why the engine suggested this move, and the as-of date that reasoning was computed for */
  rationale?: { text: string; asOf: string };
}

interface Run {
  sim: Simulation;
  moves: { from: string; to: string; amount: number }[];
  /** asOf + elasticity the run used; a mismatch means the inputs moved underneath it */
  stamp: string;
  asOf: string;
}

const parseAmount = (s: string) => {
  const n = Number(s.replace(/[,₹\s]/g, ''));
  return s.trim() === '' || !Number.isFinite(n) ? null : n;
};

/** Move budget between campaigns and model the effect on (expected) visitors. Nothing is saved. */
export function BudgetSimulator({ data, onCreateTask }: { data: DecideResponse; onCreateTask: (d: TaskDraft) => void }) {
  const seq = useRef(1);
  const [rows, setRows] = useState<MoveRow[]>([{ key: 0, from: '', to: '', amount: '' }]);
  const [run, setRun] = useState<Run | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const post = isPost(data.phase);
  const unit = post ? 'verified visitors' : 'expected visitors';
  const k = data.settings.spendElasticity;
  const camps = useMemo(() => data.campaigns.filter((c) => c.campaignId !== 'UNATTRIBUTED'), [data.campaigns]);
  // anything the simulation depends on: the date, the elasticity and each campaign's spend and (expected) visitors,
  // so a data edit or a show-rate change anywhere in the app also re-runs the last plan
  const stamp = `${data.asOf}|${k}|${camps.map((c) => `${c.campaignId}:${c.spend}:${c.expectedVisitors}`).join(',')}`;
  const byId = useMemo(() => new Map(camps.map((c) => [c.campaignId, c])), [camps]);

  const rowError = (r: MoveRow): string | null => {
    if (!r.from || !r.to) return 'Choose both campaigns.';
    if (r.from === r.to) return 'From and to must be different campaigns.';
    const a = parseAmount(r.amount);
    if (a == null) return 'Enter an amount in rupees.';
    if (a <= 0) return 'The amount must be more than ₹0.';
    return null;
  };
  const rowWarning = (r: MoveRow): string | null => {
    const a = parseAmount(r.amount);
    const f = byId.get(r.from);
    if (f && a != null && a > f.spend) return `${f.name} spent ${inr(f.spend)} by this date; the model caps the move there.`;
    const t = byId.get(r.to);
    if (t && t.spend <= 0) return `${t.name} has no paid baseline; the model uses 1.5× the portfolio average cost per visitor.`;
    return null;
  };
  const active = rows.filter((r) => r.from || r.to || r.amount);
  const errors = active.map(rowError);
  const valid = active.length > 0 && errors.every((e) => !e);
  const totalMoved = active.reduce((s, r) => s + Math.max(0, parseAmount(r.amount) ?? 0), 0);

  const simulate = async (moves: Run['moves']) => {
    setRunning(true);
    setErr(null);
    try {
      const sim = await api<Simulation>('/api/simulate', { method: 'POST', json: { asOf: data.asOf, moves } });
      setRun({ sim, moves, stamp, asOf: data.asOf });
    } catch (e) {
      setErr(`The simulation failed: ${(e as Error).message}. Check the moves and run it again.`);
    } finally {
      setRunning(false);
    }
  };

  const onRun = () => {
    setShowErrors(true);
    if (!valid) return;
    void simulate(active.map((r) => ({ from: r.from, to: r.to, amount: parseAmount(r.amount)! })));
  };

  // re-run the last plan when the as-of date, the assumptions or the data change, so results never go stale.
  // Waits for an in-flight run to finish, and tries each new stamp once so a failing request cannot loop.
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (!run || running || run.stamp === stamp || attempted.current === stamp) return;
    attempted.current = stamp;
    void simulate(run.moves);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, running, run]);

  const loadSuggested = () => {
    setRows(data.reallocations.map((m) => ({ key: seq.current++, from: m.from, to: m.to, amount: String(m.amount), rationale: { text: tidy(m.rationale), asOf: data.asOf } })));
    setShowErrors(false);
  };
  const update = (key: number, patch: Partial<MoveRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, rationale: undefined } : r)));
  const remove = (key: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [{ key: seq.current++, from: '', to: '', amount: '' }]));
  const add = () => setRows((rs) => [...rs, { key: seq.current++, from: '', to: '', amount: '' }]);
  const clear = () => {
    setRows([{ key: seq.current++, from: '', to: '', amount: '' }]);
    setRun(null);
    setShowErrors(false);
    setErr(null);
  };

  const planDraft = (r: Run): TaskDraft => {
    const lines = r.moves.map((m) => `Move ${inr(m.amount)} from ${byId.get(m.from)?.name ?? m.from} to ${byId.get(m.to)?.name ?? m.to}.`);
    const moved = r.moves.reduce((s, m) => s + m.amount, 0);
    const perCampaign = r.sim.rows
      .filter((x) => x.spendAfter !== x.spendBefore || Math.abs(x.delta) > 1e-9)
      .map((x) => `${x.name} ${inr(x.spendBefore)} to ${inr(x.spendAfter)}, ${signed(Math.round(x.delta))}`)
      .join('; ');
    return {
      title: `Reallocate ${inr(moved)} across ${r.moves.length} ${r.moves.length === 1 ? 'move' : 'moves'}`,
      description: lines.join('\n'),
      priority: 'medium',
      source: 'insight',
      evidence: `Simulated net change ${signed(Math.round(r.sim.delta))} ${unit} (${num(r.sim.totalBefore)} to ${num(r.sim.totalAfter)}) as of ${dateLabel(r.asOf, true)}. By campaign: ${perCampaign}. ${tidy(r.sim.basis)} Spend elasticity ${r.sim.elasticity} is a planning assumption, not a measured curve.${r.sim.warnings.length ? ` Warnings: ${r.sim.warnings.map(tidy).join(' ')}` : ''}`,
    };
  };

  const doubling = Math.pow(2, k);
  const halving = Math.pow(0.5, k);

  return (
    <Panel title="Budget simulator" aside="Models a what-if. Nothing is saved." id="simulator">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* moves editor */}
        <div className="min-w-0">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem] gap-2 pb-1 text-[0.8rem] font-medium text-ink-2 sm:grid">
            <span>Move budget from</span>
            <span>To</span>
            <span>Amount (₹)</span>
            <span />
          </div>
          <ol className="space-y-2.5">
            {rows.map((r, i) => {
              const e = showErrors ? rowError(r) : null;
              const w = rowWarning(r);
              return (
                <li key={r.key}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_2rem]">
                    <Select aria-label={`Move ${i + 1}: from campaign`} value={r.from} onChange={(ev) => update(r.key, { from: ev.target.value })}>
                      <option value="">Choose a campaign</option>
                      {camps.map((c) => (
                        <option key={c.campaignId} value={c.campaignId}>
                          {c.name} ({inr(c.spend)})
                        </option>
                      ))}
                    </Select>
                    <Select aria-label={`Move ${i + 1}: to campaign`} value={r.to} onChange={(ev) => update(r.key, { to: ev.target.value })}>
                      <option value="">Choose a campaign</option>
                      {camps.map((c) => (
                        <option key={c.campaignId} value={c.campaignId} disabled={c.campaignId === r.from}>
                          {c.name} ({inr(c.spend)})
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      aria-label={`Move ${i + 1}: amount in rupees`}
                      aria-invalid={!!e}
                      aria-describedby={e || w ? `move-${r.key}-msg` : undefined}
                      inputMode="numeric"
                      placeholder="e.g. 15000"
                      value={r.amount}
                      onChange={(ev) => update(r.key, { amount: ev.target.value })}
                      className={cx('num text-right', e && 'border-lac')}
                    />
                    <button type="button" onClick={() => remove(r.key)} aria-label={`Remove move ${i + 1}`} className="grid size-9 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-paper-2 hover:text-ink">
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  {e ? (
                    <p id={`move-${r.key}-msg`} className="mt-1 text-[0.8rem] text-lac">
                      {e}
                    </p>
                  ) : null}
                  {!e && w ? (
                    <p id={`move-${r.key}-msg`} className="mt-1 text-[0.8rem] text-zari">
                      {w}
                    </p>
                  ) : null}
                  {r.rationale && r.rationale.asOf === data.asOf ? <p className="num mt-1 text-[0.78rem] text-ink-3">Suggested because {r.rationale.text}</p> : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={add} icon={<Plus size={15} aria-hidden />}>
              Add a move
            </Button>
            <Button size="sm" variant="secondary" onClick={loadSuggested} disabled={!data.reallocations.length} title={data.reallocations.length ? undefined : 'No suggestion at this date'}>
              Load suggested moves
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
            <span className="num ml-auto text-[0.82rem] text-ink-2">{totalMoved > 0 ? `${inr(totalMoved)} moved, total spend unchanged` : null}</span>
          </div>
          {!data.reallocations.length ? <p className="mt-2 text-[0.8rem] text-ink-3">No suggested moves at this date: they need at least one Stop campaign with spend and one Scale campaign to receive it.</p> : null}
          <div className="mt-4 flex items-center gap-3">
            <Button variant="primary" onClick={onRun} disabled={running}>
              {running ? 'Running…' : 'Run simulation'}
            </Button>
            {showErrors && !valid ? <span className="text-[0.82rem] text-lac">{active.length ? 'Fix the moves marked in red first.' : 'Add at least one move first.'}</span> : null}
          </div>

          <div className="mt-5 rounded-[var(--radius-control)] bg-paper-2 px-3.5 py-3 text-[0.82rem] text-ink-2">
            <p className="font-medium text-ink">Assumptions</p>
            <p className="num mt-1">{run ? tidy(run.sim.basis) : `${post ? 'Actual verified visitors' : 'Expected visitors (confirmed × show-rate assumption)'} as of ${dateLabel(data.asOf, true)}; response curve V = V0 × (spend ratio)^${k}.`}</p>
            <p className="num mt-1">
              Spend elasticity {k}: doubling a campaign&apos;s spend multiplies its visitors by {doubling.toFixed(2)}, halving it by {halving.toFixed(2)}. This is a planning assumption for diminishing returns, not a measured curve.
              {post ? ' After the event this is a counterfactual: what the same total budget might have produced.' : ''}
            </p>
          </div>
        </div>

        {/* result summary */}
        <div className="min-w-0">
          {err ? <ErrorNote onRetry={run ? () => void simulate(run.moves) : onRun}>{err}</ErrorNote> : null}
          {running && !run ? <Skeleton className="h-40" /> : null}
          {run ? (
            <RunSummary run={run} unit={unit} post={post} stale={run.stamp !== stamp} onTask={() => onCreateTask(planDraft(run))} />
          ) : !running ? (
            <div className="flex h-full min-h-40 flex-col justify-center rounded-[var(--radius-panel)] border border-dashed border-line-2 px-5 py-6">
              <p className="font-semibold text-ink">No simulation yet</p>
              <p className="mt-1 text-[0.88rem] text-ink-2">
                {data.reallocations.length ? 'Load the suggested moves or add your own, then run the simulation to see the change in ' : 'Add a move, then run the simulation to see the change in '}
                {unit}, campaign by campaign.
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {run ? <RunDetail run={run} unit={unit} /> : null}
    </Panel>
  );
}

function RunSummary({ run, unit, post, stale, onTask }: { run: Run; unit: string; post: boolean; stale: boolean; onTask: () => void }) {
  const { sim } = run;
  const tone = sim.delta > 0.5 ? 'var(--bangle)' : sim.delta < -0.5 ? 'var(--lac)' : 'var(--ink)';
  const changePct = sim.totalBefore > 0 ? sim.delta / sim.totalBefore : null;
  return (
    <div className={cx('space-y-4', stale && 'opacity-60')}>
      <div>
        <div className="text-[0.85rem] text-ink-2">Net change in {unit}{post ? ', had the budget moved' : ''}</div>
        <div className="num type-display mt-1 text-[2.6rem] leading-none" style={{ color: tone }}>
          {signed(Math.round(sim.delta))}
        </div>
        <div className="num mt-1.5 text-[0.88rem] text-ink-2">
          {num(sim.totalBefore)} to {num(sim.totalAfter)} {unit}
          {changePct != null ? <span className="ml-1.5 font-semibold" style={{ color: tone }}>({changePct >= 0 ? '+' : '−'}{pct(Math.abs(changePct))})</span> : null}
        </div>
        <div className="mt-0.5 text-[0.8rem] text-ink-3">Run as of {dateLabel(run.asOf, true)}, elasticity {sim.elasticity}</div>
      </div>
      {sim.warnings.length ? (
        <div className="rounded-[var(--radius-control)] border border-zari-bright/50 bg-zari-soft px-3 py-2 text-[0.82rem] text-zari">
          <p className="font-semibold">{sim.warnings.length === 1 ? 'Warning' : `${sim.warnings.length} warnings`}</p>
          <ul className="mt-0.5 list-disc pl-4">
            {sim.warnings.map((w, i) => (
              <li key={i}>{tidy(w)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[0.82rem] text-ink-3">No warnings: every move was within the source campaign&apos;s spend.</p>
      )}
      <Button variant="secondary" onClick={onTask}>
        Turn this plan into a task
      </Button>
    </div>
  );
}

function RunDetail({ run, unit }: { run: Run; unit: string }) {
  const { sim } = run;
  const changed = sim.rows.filter((r) => r.spendAfter !== r.spendBefore || Math.abs(r.delta) > 1e-9);
  const spendBefore = sim.rows.reduce((s, r) => s + r.spendBefore, 0);
  const spendAfter = sim.rows.reduce((s, r) => s + r.spendAfter, 0);
  const chart = changed.map((r) => ({ id: r.campaignId, name: r.name, before: r.visitorsBefore, after: r.visitorsAfter, delta: r.delta }));
  const unitCap = unit.charAt(0).toUpperCase() + unit.slice(1);

  if (!changed.length) return <p className="mt-5 border-t border-line pt-4 text-[0.88rem] text-ink-2">No campaign changed in this run. Check the warnings above.</p>;

  return (
    <div className="mt-6 grid gap-6 border-t border-line pt-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h3 className="mb-2 text-[0.9rem] font-semibold text-ink">Before and after, changed campaigns</h3>
        <Table>
          <thead>
            <tr>
              <Th className="text-left">Campaign</Th>
              <Th align="right">Spend before</Th>
              <Th align="right">Spend after</Th>
              <Th align="right">{unitCap} before</Th>
              <Th align="right">After</Th>
              <Th align="right">Change</Th>
            </tr>
          </thead>
          <tbody>
            {changed.map((r) => (
              <tr key={r.campaignId}>
                <Td>
                  <CampaignDot id={r.campaignId}>
                    <span className="whitespace-nowrap font-medium">{r.name}</span>
                  </CampaignDot>
                  {r.note ? <div className="pl-[18px] text-[0.75rem] text-ink-3">{r.note}</div> : null}
                </Td>
                <Td align="right">{inr(r.spendBefore)}</Td>
                <Td align="right">{inr(r.spendAfter)}</Td>
                <Td align="right">{num(r.visitorsBefore)}</Td>
                <Td align="right">{num(r.visitorsAfter)}</Td>
                <Td align="right" className="font-semibold">
                  <span style={{ color: r.delta > 0 ? 'var(--bangle)' : r.delta < 0 ? 'var(--lac)' : undefined }}>{signed(Math.round(r.delta))}</span>
                </Td>
              </tr>
            ))}
            <tr className="bg-paper">
              <Td className="font-semibold">All campaigns</Td>
              <Td align="right">{inr(spendBefore)}</Td>
              <Td align="right">{inr(spendAfter)}</Td>
              <Td align="right">{num(sim.totalBefore)}</Td>
              <Td align="right">{num(sim.totalAfter)}</Td>
              <Td align="right" className="font-semibold">
                {signed(Math.round(sim.delta))}
              </Td>
            </tr>
          </tbody>
        </Table>
        <p className="mt-2 text-[0.78rem] text-ink-3">
          <span className="num">{sim.rows.length - changed.length}</span> other campaigns are unchanged. Spend after can be lower than before when a move was capped. Unattributed walk-ins are not modelled.
        </p>
      </div>
      <figure className="min-w-0">
        <figcaption className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.9rem] font-semibold text-ink">{unitCap}, before and after</span>
          <Legend
            items={[
              { label: 'Before', color: 'color-mix(in srgb, var(--ink-3) 45%, transparent)' },
              { label: 'After, gain', color: 'var(--bangle)' },
              { label: 'After, loss', color: 'var(--lac)' },
            ]}
          />
        </figcaption>
        <div style={{ height: chart.length * 56 + 36 }}>
          <ResponsiveContainer debounce={250} width="100%" height="100%">
            <BarChart data={chart} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
              <CartesianGrid {...gridProps} vertical horizontal={false} />
              <XAxis type="number" {...axisProps} tickFormatter={(v: number) => num(v)} />
              <YAxis type="category" dataKey="name" {...axisProps} width={140} interval={0} />
              <Tooltip
                cursor={{ fill: 'var(--paper-2)' }}
                content={(p) => {
                  const row = (p.payload?.[0]?.payload ?? null) as (typeof chart)[number] | null;
                  if (!p.active || !row) return null;
                  const tone = row.delta >= 0 ? 'var(--bangle)' : 'var(--lac)';
                  return (
                    <ChartTip
                      active
                      label={row.name}
                      payload={[
                        { name: 'Before', value: row.before, color: 'var(--ink-3)' },
                        { name: 'After', value: row.after, color: tone },
                        { name: 'Change', value: row.delta, color: tone },
                      ]}
                      format={(v, name) => (name === 'Change' ? signed(Math.round(v)) : num(v))}
                    />
                  );
                }}
              />
              <Bar dataKey="before" name="Before" fill="var(--ink-3)" fillOpacity={0.45} radius={[0, 3, 3, 0]} isAnimationActive={false} />
              <Bar dataKey="after" name="After" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                {chart.map((c) => (
                  <Cell key={c.id} fill={c.delta >= 0 ? 'var(--bangle)' : 'var(--lac)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
