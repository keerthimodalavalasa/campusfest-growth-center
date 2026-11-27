'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeftRightDuotone, ClipboardListDuotone, PlusDuotone, TriangleAlertDuotone, XDuotone } from 'runeicons-react';
import type { Simulation } from '@/server/engine/simulate';
import { api } from '@/lib/api';
import { dateLabel, inr, num, signed } from '@/lib/format';
import { Button, cx, Delta, ErrorNote, Ico, Select, Skeleton, Table, Td, TextInput, Th, Tile, TileHead } from '@/components/ui';
import { campaignColor } from '@/lib/colors';
import { ChartData } from '@/components/ChartData';
import { HowThisWorks } from '@/components/tiles';
import { tipProps } from '@/components/tooltip';
import { ResponseCurve } from './ResponseCurve';
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
export function BudgetSimulator({ data, onCreateTask, delay = 0 }: { data: DecideResponse; onCreateTask: (d: TaskDraft) => void; delay?: number }) {
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

  return (
    <Tile field="stone" id="simulator" delay={delay} className="scroll-mt-24" aria-label="Budget simulator">
      <TileHead icon={ArrowLeftRightDuotone} aside="a what-if, nothing is saved">
        Budget simulator
      </TileHead>
      <div className="mt-4 grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-x-8 gap-y-6 max-[1200px]:grid-cols-1">
        {/* moves editor */}
        <div className="min-w-0">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_2.5rem] gap-2 pb-1.5 text-[12.5px] font-[600] text-ink-2 sm:grid">
            <span>Move budget from</span>
            <span>To</span>
            <span className="text-right">Amount, ₹</span>
            <span />
          </div>
          <ol className="space-y-2.5">
            {rows.map((r, i) => {
              const e = showErrors ? rowError(r) : null;
              const w = rowWarning(r);
              const suggested = r.rationale && r.rationale.asOf === data.asOf ? r.rationale.text : null;
              return (
                <li key={r.key}>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8.5rem_2.5rem]">
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
                      className={cx('tab text-right', e && '!border-st-stop')}
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      aria-label={`Remove move ${i + 1}`}
                      className="grid size-10 place-items-center rounded-full transition-[background-color,transform] duration-150 hover:bg-stone-2 active:scale-[0.95]"
                    >
                      <Ico icon={XDuotone} size={18} ia="var(--ink-2)" ib="var(--ink-2)" />
                    </button>
                  </div>
                  {e ? (
                    <p id={`move-${r.key}-msg`} className="mt-1 text-[12.5px] font-[600] text-st-stop">
                      {e}
                    </p>
                  ) : null}
                  {!e && w ? (
                    <p id={`move-${r.key}-msg`} className="mt-1 flex items-center gap-1.5 text-[12.5px] font-[550] text-ink-2">
                      <Ico icon={TriangleAlertDuotone} size={14} ia="var(--ink)" ib="var(--stone-3)" />
                      {w}
                    </p>
                  ) : null}
                  {suggested ? (
                    <span
                      tabIndex={0}
                      {...tipProps({ title: 'Why this move', notes: [suggested] })}
                      className="mt-1.5 inline-flex h-[22px] cursor-default items-center rounded-full bg-stone-2 px-2 text-[11.5px] font-[650] text-ink-2"
                    >
                      Suggested by the rules
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" onClick={add} icon={<Ico icon={PlusDuotone} size={15} ia="var(--ink)" ib="var(--stone-3)" />}>
              Add a move
            </Button>
            <Button size="sm" variant="secondary" onClick={loadSuggested} disabled={!data.reallocations.length} title={data.reallocations.length ? undefined : 'No suggestion at this date'}>
              Load suggested moves
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>
              Clear
            </Button>
            <span className="tab ml-auto text-[12.5px] font-[600] text-ink-2">{totalMoved > 0 ? `${inr(totalMoved)} moved, total spend unchanged` : null}</span>
          </div>
          {!data.reallocations.length ? <p className="mt-2 text-[12.5px] text-ink-2">No suggested moves at this date: they need a Stop campaign with spend and a Scale campaign to receive it.</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={onRun} disabled={running}>
              {running ? 'Running…' : 'Run simulation'}
            </Button>
            {showErrors && !valid ? <span className="text-[12.5px] font-[600] text-st-stop">{active.length ? 'Fix the moves marked in red first.' : 'Add at least one move first.'}</span> : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-tile-m bg-stone-2/60 px-4 py-3.5">
            <ResponseCurve k={k} />
            <div className="min-w-0 flex-1 basis-[13rem]">
              <div className="text-[13.5px] font-[650]">Response curve, assumed</div>
              <p className="mt-0.5 text-[12.5px] leading-[1.4] font-[550] text-ink-2">
                Elasticity <span className="tab font-[700] text-ink">{k}</span>: doubling spend gives <span className="tab font-[700] text-ink">×{doubling.toFixed(2)}</span> the visitors.
              </p>
              <HowThisWorks className="mt-1.5">
                <p>{run ? tidy(run.sim.basis) : `${post ? 'Actual verified visitors' : 'Expected visitors (confirmed × show-rate assumption)'} as of ${dateLabel(data.asOf, true)}; response curve V = V0 × (spend ratio)^${k}.`}</p>
                <p>This is a planning assumption for diminishing returns, not a measured curve. The dashed diagonal is what no diminishing returns would look like.{post ? ' After the event this is a counterfactual: what the same total budget might have produced.' : ''}</p>
              </HowThisWorks>
            </div>
          </div>
        </div>

        {/* result */}
        <div className="min-w-0">
          {err ? <ErrorNote onRetry={run ? () => void simulate(run.moves) : onRun}>{err}</ErrorNote> : null}
          {running && !run ? <Skeleton className="h-56" /> : null}
          {run ? (
            <RunResult run={run} unit={unit} post={post} stale={run.stamp !== stamp} onTask={() => onCreateTask(planDraft(run))} />
          ) : !running ? (
            <div className="flex h-full min-h-48 flex-col justify-center rounded-tile-m border-[1.5px] border-dashed border-stone-3 px-5 py-6">
              <p className="text-[15px] font-[650] text-ink">No simulation yet</p>
              <p className="mt-1 text-[13px] text-ink-2">
                {data.reallocations.length ? 'Load the suggested moves, then run them' : 'Add a move, then run it'} to see the change in {unit}, campaign by campaign.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </Tile>
  );
}

/** The result: the net change as the numeral, then a before-to-after dumbbell per changed campaign. */
function RunResult({ run, unit, post, stale, onTask }: { run: Run; unit: string; post: boolean; stale: boolean; onTask: () => void }) {
  const { sim } = run;
  const changed = sim.rows.filter((r) => r.spendAfter !== r.spendBefore || Math.abs(r.delta) > 1e-9);
  const spendBefore = sim.rows.reduce((s, r) => s + r.spendBefore, 0);
  const spendAfter = sim.rows.reduce((s, r) => s + r.spendAfter, 0);
  const max = Math.max(1, ...changed.flatMap((r) => [r.visitorsBefore, r.visitorsAfter])) * 1.06;
  const unitCap = unit.charAt(0).toUpperCase() + unit.slice(1);
  const x = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const changePct = sim.totalBefore > 0 ? sim.delta / sim.totalBefore : null;

  return (
    <div className={cx('transition-opacity duration-200', stale && 'opacity-60')} aria-busy={stale}>
      <div className="text-[13.5px] font-[650]">
        Net change in {unit}
        {post ? ', had the budget moved' : ''}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="num text-[58px] leading-[0.85]">{signed(Math.round(sim.delta))}</span>
        <span className="pb-1 text-[13px] font-[600] text-ink-2">
          <span className="tab">
            {num(sim.totalBefore)} to {num(sim.totalAfter)}
          </span>
          {changePct != null ? <span className="tab ml-1.5 font-[700] text-ink">({signed(changePct * 100, (n) => `${n.toFixed(1)}%`)})</span> : null}
        </span>
      </div>
      <div className="mt-1.5 text-[12px] font-[550] text-ink-2">
        Run as of {dateLabel(run.asOf, true)}, elasticity <span className="tab">{sim.elasticity}</span>
        {stale ? ', inputs changed, updating' : ''}
      </div>

      {changed.length ? (
        <figure className="mt-4">
          <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] font-[550] text-ink-2">
            <span className="font-[650] text-ink">{unitCap}, before and after</span>
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                <circle cx="6" cy="6" r="4.4" fill="var(--stone)" stroke="var(--ink-2)" strokeWidth="1.8" />
              </svg>
              Before
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
                <circle cx="6" cy="6" r="5.5" fill="var(--ink-2)" />
              </svg>
              After
            </span>
          </figcaption>
          <ul className="grid gap-1">
            {changed.map((r, i) => {
              const color = campaignColor(r.campaignId);
              const a = Math.min(r.visitorsBefore, r.visitorsAfter);
              const b = Math.max(r.visitorsBefore, r.visitorsAfter);
              return (
                <li
                  key={r.campaignId}
                  tabIndex={0}
                  {...tipProps({
                    title: r.name,
                    rows: [
                      { label: 'Spend', value: `${inr(r.spendBefore)} to ${inr(r.spendAfter)}` },
                      { color, label: 'Before', value: num(r.visitorsBefore), swatch: 'square' },
                      { color, label: 'After', value: num(r.visitorsAfter), swatch: 'square' },
                      { label: 'Change', value: signed(Math.round(r.delta)), total: true },
                    ],
                    notes: r.note ? [r.note] : [],
                  })}
                  className="grid cursor-default grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.75rem] items-center gap-3 rounded-md py-1 text-[12.5px] font-[600]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
                    <span className="truncate">{r.name}</span>
                  </span>
                  <span className="relative h-5" aria-hidden>
                    <i className="absolute top-1/2 left-0 block h-px w-full -translate-y-1/2 bg-stone-3" />
                    <i className="anim-grow-x absolute top-1/2 block h-[3px] -translate-y-1/2 rounded-full" style={{ left: x(a), width: `calc(${x(b)} - ${x(a)})`, background: color, '--d': `${120 + i * 50}ms` } as CSSProperties} />
                    <i className="absolute top-1/2 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-stone" style={{ left: x(r.visitorsBefore), borderColor: color }} />
                    <i className="anim-fade absolute top-1/2 block size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_2px_var(--stone)]" style={{ left: x(r.visitorsAfter), background: color, '--d': `${300 + i * 50}ms` } as CSSProperties} />
                  </span>
                  <span className="text-right">
                    <Delta now={r.visitorsAfter} prev={r.visitorsBefore} format={num} colored label="from the moves" />
                  </span>
                </li>
              );
            })}
          </ul>
          <ChartData>
            <Table>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th align="right">Spend before</Th>
                  <Th align="right">Spend after</Th>
                  <Th align="right">Before</Th>
                  <Th align="right">After</Th>
                  <Th align="right">Change</Th>
                </tr>
              </thead>
              <tbody>
                {changed.map((r) => (
                  <tr key={r.campaignId}>
                    <Td>
                      {r.name}
                      {r.note ? <div className="text-[11.5px] text-ink-2">{r.note}</div> : null}
                    </Td>
                    <Td align="right">{inr(r.spendBefore)}</Td>
                    <Td align="right">{inr(r.spendAfter)}</Td>
                    <Td align="right">{num(r.visitorsBefore)}</Td>
                    <Td align="right">{num(r.visitorsAfter)}</Td>
                    <Td align="right">{signed(Math.round(r.delta))}</Td>
                  </tr>
                ))}
                <tr className="font-[650]">
                  <Td>All campaigns</Td>
                  <Td align="right">{inr(spendBefore)}</Td>
                  <Td align="right">{inr(spendAfter)}</Td>
                  <Td align="right">{num(sim.totalBefore)}</Td>
                  <Td align="right">{num(sim.totalAfter)}</Td>
                  <Td align="right">{signed(Math.round(sim.delta))}</Td>
                </tr>
              </tbody>
            </Table>
            <p className="mt-1.5 text-ink-2">
              {sim.rows.length - changed.length} other campaigns are unchanged. Spend after can be lower than before when a move was capped. Unattributed walk-ins are not modelled.
            </p>
          </ChartData>
        </figure>
      ) : (
        <p className="mt-4 text-[13px] text-ink-2">No campaign changed in this run. Check the warnings below.</p>
      )}

      {sim.warnings.length ? (
        <div className="mt-4 flex gap-2.5 rounded-tile-m bg-stone-2/60 px-3.5 py-3 text-[12.5px] text-ink">
          <Ico icon={TriangleAlertDuotone} size={18} ia="var(--ink)" ib="var(--stone-3)" />
          <div className="min-w-0">
            <p className="font-[650]">{sim.warnings.length === 1 ? 'One warning' : `${sim.warnings.length} warnings`}</p>
            <ul className="mt-0.5 space-y-0.5 text-ink-2">
              {sim.warnings.map((w, i) => (
                <li key={i}>{tidy(w)}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12.5px] font-[550] text-ink-2">No warnings: every move was within the source campaign&apos;s spend.</p>
      )}
      <Button variant="secondary" className="mt-4" onClick={onTask} icon={<Ico icon={ClipboardListDuotone} size={16} ia="var(--ink)" ib="var(--stone-3)" />}>
        Turn this plan into a task
      </Button>
    </div>
  );
}
