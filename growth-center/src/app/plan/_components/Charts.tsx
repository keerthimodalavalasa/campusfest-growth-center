'use client';
import type { CSSProperties } from 'react';
import { ArrowUpDownDuotone, ChartBarDuotone, FunnelDuotone, IndianRupeeDuotone } from 'runeicons-react';
import { inr, inrShort, num, pct } from '@/lib/format';
import { cx, Table, Td, Th, Tile, TileHead } from '@/components/ui';
import { ChartData } from '@/components/ChartData';
import { tipProps } from '@/components/tooltip';
import { StepFunnel, type FunnelLeak, type FunnelStage } from '@/components/viz';
import { HowThisWorks } from '@/components/tiles';
import { betName, clean, stepLabel, stepsOf, type Initiative, type Plan } from './model';
import { inputValue } from './Hero';

const v = (o: Record<string, string | number>) => o as CSSProperties;
/** A removed amount is the hatched ghost of what was there (as in the stepped funnel). */
const GHOST = 'repeating-linear-gradient(135deg, var(--stone-3) 0 5px, transparent 5px 10px)';
const signedNum = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;

/* ------------------------------------------------------------------ waterfall (visitors, lac) */

export function WaterfallTile({ p }: { p: Plan }) {
  const start = inputValue(p, 'visitors_2025', 2050);
  const end = p.base.unique_verified_visitors;
  const steps = stepsOf(p.waterfall.base);
  const after = steps.map((_, i) => start + steps.slice(0, i + 1).reduce((t, s) => t + s.delta, 0));
  const lo = Math.min(start, ...after) * 0.84;
  const hi = Math.max(start, end, ...after) * 1.04;
  const y = (x: number) => ((x - lo) / (hi - lo)) * 100;
  const bars = [
    { key: 'start', label: '2025', from: lo, to: start, kind: 'total' as const, delta: 0, full: '2025 actual' },
    ...steps.map((s, i) => ({ key: s.key, label: stepLabel(s), from: i === 0 ? start : after[i - 1], to: after[i], kind: s.delta >= 0 ? ('up' as const) : ('down' as const), delta: s.rounded ?? s.delta, full: clean(s.label) })),
    { key: 'end', label: '2027 base', from: lo, to: end, kind: 'total' as const, delta: 0, full: 'Hyderabad 2027 base' },
  ];
  const g = p.growth_split_base;
  const split = [
    { key: 'regs', label: 'More registrations', value: g.from_more_registrations, bg: 'var(--lac-bright)' },
    { key: 'engine', label: 'Show-up engine', value: g.of_which_engine, bg: 'var(--lac)' },
    { key: 'mix', label: 'Mix to high-show channels', value: g.of_which_mix_shift, bg: 'var(--lac-track)' },
  ];

  return (
    <Tile field="stone" delay={220} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="Why the base holds">
      <TileHead icon={ChartBarDuotone} aside={`${num(start)} to ${num(end)}`}>
        Why {num(end)} holds
      </TileHead>
      <div className="relative mt-4 flex h-[220px] items-end gap-2 max-[720px]:gap-1" role="img" aria-label={`Waterfall from ${num(start)} visitors in 2025 to ${num(end)} in the 2027 base. The table under the chart lists every step.`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <i key={f} aria-hidden className="absolute inset-x-0 block h-px bg-stone-2" style={{ bottom: `${f * 100}%` }} />
        ))}
        {bars.map((b, i) => {
          const a = Math.min(b.from, b.to);
          const z = Math.max(b.from, b.to);
          const text = b.kind === 'total' ? num(b.to) : signedNum(b.delta);
          const next = bars[i + 1];
          return (
            <div
              key={b.key}
              tabIndex={0}
              {...tipProps({ title: b.full, rows: b.kind === 'total' ? [{ label: 'Verified visitors', value: num(b.to) }] : [{ label: 'Change', value: signedNum(b.delta) }, { label: 'Running total', value: num(b.to), total: true }] })}
              className="relative h-full min-w-0 flex-1 rounded-md"
            >
              <div
                aria-hidden
                className="anim-grow-y absolute inset-x-0 rounded-[4px]"
                style={{
                  bottom: `${y(a)}%`,
                  height: `${Math.max(0.8, y(z) - y(a))}%`,
                  ...(b.kind === 'down' ? { backgroundImage: GHOST, boxShadow: 'inset 0 0 0 1.5px var(--stone-3)' } : { background: b.kind === 'total' ? 'var(--lac)' : 'var(--lac-bright)' }),
                  ...v({ '--d': `${200 + i * 50}ms` }),
                }}
              />
              {next && b.kind !== 'total' ? <i aria-hidden className="absolute -right-2 left-full block h-px bg-ink-2 max-[720px]:-right-1" style={{ bottom: `${y(b.to)}%` }} /> : null}
              {i === 0 ? <i aria-hidden className="absolute -right-2 left-full block h-px bg-ink-2 max-[720px]:-right-1" style={{ bottom: `${y(b.to)}%` }} /> : null}
              <span className={cx('tab absolute inset-x-0 text-center text-[12px] font-[700] max-[720px]:text-[10.5px]', b.kind === 'total' && 'text-[13px]')} style={{ bottom: `calc(${y(z)}% + 4px)` }}>
                {text}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2 max-[720px]:gap-1">
        {bars.map((b) => (
          <span key={b.key} className={cx('min-w-0 flex-1 text-center text-[11.5px] leading-[1.2] font-[600] text-ink-2 max-[720px]:text-[10px]', b.kind === 'total' && 'text-ink')}>
            {b.label}
          </span>
        ))}
      </div>

      <div className="mt-5" aria-label="Where the growth comes from">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] font-[650]">
            <span className="num mr-1.5 text-[22px] leading-none">+{num(g.growth)}</span>
            visitors of growth
          </span>
          <span className="tab text-[12.5px] font-[600] text-ink-2">{pct(g.from_better_show_up / g.growth, 0)} from better show-up</span>
        </div>
        <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
          {split.map((s, i) => (
            <i key={s.key} tabIndex={0} {...tipProps({ title: s.label, rows: [{ color: s.bg, label: 'Visitors', value: `+${num(s.value)}`, swatch: 'square' }] })} className="anim-grow-x block h-full" style={{ width: `${(s.value / g.growth) * 100}%`, background: s.bg, ...v({ '--d': `${560 + i * 60}ms` }) }} />
          ))}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-[550] text-ink-2">
          {split.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <i aria-hidden className="block size-2.5 rounded-[3px]" style={{ background: s.bg }} />
              {s.label} <b className="tab font-[700] text-ink">+{num(s.value)}</b>
            </li>
          ))}
        </ul>
      </div>

      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Step</Th>
              <Th align="right">Change</Th>
              <Th align="right">Running total</Th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.key}>
                <Td>{b.full}</Td>
                <Td align="right">{b.kind === 'total' ? '' : signedNum(b.delta)}</Td>
                <Td align="right">{num(b.to)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </Tile>
  );
}

/* ------------------------------------------------------------------ budget (money, haldi) */

const RESERVE = 'repeating-linear-gradient(135deg, var(--haldi) 0 5px, color-mix(in srgb, var(--haldi) 30%, var(--stone)) 5px 10px)';

export function BudgetTile({ p, byKey }: { p: Plan; byKey: Map<string, Initiative> }) {
  const total = p.budget.total;
  const groups = [
    ...p.ideas.map((idea) => ({ key: idea.key, rank: idea.rank as number | null, label: betName(idea, byKey.get(idea.key)), kind: 'bet' as const })),
    { key: 'maintain', rank: null, label: 'Organic and community', kind: 'maintain' as const },
    { key: 'reserve', rank: null, label: 'Reserve, released at gates', kind: 'reserve' as const },
  ]
    .map((g) => ({ ...g, lines: p.budget.lines.filter((l) => l.idea === g.key) }))
    .map((g) => ({ ...g, inr: g.lines.reduce((s, l) => s + l.inr, 0) }))
    .filter((g) => g.inr > 0);
  const fill = (k: 'bet' | 'maintain' | 'reserve') => (k === 'bet' ? { background: 'var(--haldi)' } : k === 'maintain' ? { background: 'var(--haldi-track)' } : { backgroundImage: RESERVE });

  return (
    <Tile field="stone" delay={260} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="Where the budget goes">
      <TileHead icon={IndianRupeeDuotone} aside={inr(total)}>
        Where ₹3 lakh goes
      </TileHead>
      <div className="mt-4 flex h-14 gap-[2px] overflow-hidden rounded-[10px]" role="img" aria-label={groups.map((g) => `${g.label} ${inrShort(g.inr)}`).join(', ')}>
        {groups.map((g, i) => (
          <div
            key={g.key}
            tabIndex={0}
            {...tipProps({ title: g.label, rows: [...g.lines.map((l) => ({ label: clean(l.line).split(':')[0], value: inrShort(l.inr) })), { label: 'Share of budget', value: pct(g.inr / total, 0), total: true }] })}
            className="anim-grow-x flex min-w-0 items-end px-2 pb-1.5 text-ink"
            style={{ width: `${(g.inr / total) * 100}%`, ...fill(g.kind), ...v({ '--d': `${300 + i * 50}ms` }) }}
          >
            {g.rank != null && g.inr / total > 0.04 ? <span className="num text-[22px] leading-none">{g.rank}</span> : null}
          </div>
        ))}
      </div>
      <ul className="mt-4 grid gap-y-2 text-[12.5px]">
        {groups.map((g) => (
          <li key={g.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2">
            <span aria-hidden className="grid h-4 w-[18px] place-items-center rounded-[4px] text-[10.5px] font-[800]" style={fill(g.kind)}>
              {g.rank ?? ''}
            </span>
            <span className="truncate font-[600]">{g.label}</span>
            <span className="tab text-right font-[700]">
              {inrShort(g.inr)} <span className="font-[550] text-ink-2">{pct(g.inr / total, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
      <CostPerVisitor p={p} />
      <ChartData className="mt-auto pt-3">
        <Table>
          <thead>
            <tr>
              <Th>Line</Th>
              <Th align="right">Amount</Th>
              <Th align="right">Share</Th>
            </tr>
          </thead>
          <tbody>
            {[...p.budget.lines]
              .sort((a, b) => b.inr - a.inr)
              .map((l) => (
                <tr key={l.key}>
                  <Td className="min-w-[16rem]">{clean(l.line)}</Td>
                  <Td align="right">{inr(l.inr)}</Td>
                  <Td align="right">{pct(l.inr / total, 0)}</Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </ChartData>
    </Tile>
  );
}

/** What one verified visitor costs in each scenario: money, so haldi bars on one scale from zero. */
function CostPerVisitor({ p }: { p: Plan }) {
  const c2025 = inputValue(p, 'spend_2025', 274000) / inputValue(p, 'visitors_2025', 2050);
  const rows = [
    { key: '2025', label: '2025 actual', value: c2025 },
    { key: 'floor', label: 'Floor', value: p.floor.cost_per_visitor_inr },
    { key: 'base', label: 'Commit', value: p.base.cost_per_visitor_inr },
    { key: 'stretch', label: 'Aim', value: p.stretch.cost_per_visitor_inr },
  ];
  const max = Math.max(...rows.map((r) => r.value)) * 1.05;
  return (
    <div className="mt-5 pt-4 shadow-[inset_0_1px_0_var(--stone-2)]">
      <h3 className="text-[13.5px] font-[650]">What one visitor costs</h3>
      <ul className="mt-2.5 grid gap-1.5">
        {rows.map((r, i) => (
          <li key={r.key} className="grid grid-cols-[86px_minmax(0,1fr)_52px] items-center gap-2.5 text-[12.5px]">
            <span className={cx('font-[600]', r.key === 'base' ? 'text-ink' : 'text-ink-2')}>{r.label}</span>
            <span className="relative h-3">
              <i
                className="anim-grow-x absolute inset-y-0 left-0 block rounded-r-[4px]"
                style={{ width: `${(r.value / max) * 100}%`, ...(r.key === 'stretch' ? { backgroundImage: RESERVE } : { background: r.key === '2025' ? 'var(--haldi-track)' : 'var(--haldi)' }), ...v({ '--d': `${420 + i * 50}ms` }) }}
              />
            </span>
            <span className="tab text-right font-[700]">{inr(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ tornado (visitors, lac) */

export function TornadoTile({ p }: { p: Plan }) {
  const all = [...p.sensitivities.base].sort((a, b) => Math.abs(b.delta_visitors) - Math.abs(a.delta_visitors));
  const rows = all.slice(0, 8);
  const max = Math.max(...rows.map((r) => Math.abs(r.delta_visitors)), 1);
  return (
    <Tile field="stone" delay={380} className="col-span-7 flex flex-col max-[1200px]:col-span-12" aria-label="What could move the base">
      <TileHead icon={ArrowUpDownDuotone} aside={`visitors vs ${num(p.base.unique_verified_visitors)}`}>
        What could move the base
      </TileHead>
      <ul className="mt-3 grid gap-1">
        {rows.map((r, i) => {
          const w = (Math.abs(r.delta_visitors) / max) * 40;
          const neg = r.delta_visitors < 0;
          const label = clean(r.sensitivity);
          return (
            <li
              key={r.sensitivity}
              tabIndex={0}
              {...tipProps({ title: label, rows: [{ label: 'Visitors vs base', value: signedNum(r.delta_visitors) }], notes: r.basis ? [clean(r.basis)] : [] })}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-3 rounded-md px-1 py-1 transition-colors duration-150 hover:bg-stone-2 max-[720px]:grid-cols-1 max-[720px]:gap-1"
            >
              <span className="truncate text-[12.5px] font-[600]">{label}</span>
              <span className="relative h-5">
                <i aria-hidden className="absolute -inset-y-1 left-1/2 block w-px bg-ink" />
                <i
                  aria-hidden
                  className="anim-grow-x absolute inset-y-[3px] block bg-lac"
                  style={{ left: neg ? `${50 - w}%` : '50%', width: `${w}%`, borderRadius: neg ? '4px 0 0 4px' : '0 4px 4px 0', transformOrigin: neg ? 'right' : 'left', ...v({ '--d': `${400 + i * 40}ms` }) }}
                />
                <span className="tab absolute top-1/2 -translate-y-1/2 text-[12px] font-[700]" style={neg ? { right: `calc(${50 + w}% + 5px)` } : { left: `calc(${50 + w}% + 5px)` }}>
                  {signedNum(r.delta_visitors)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between pl-[calc(46%+12px)] text-[12px] font-[600] text-ink-2 max-[720px]:pl-0">
        <span>fewer visitors</span>
        <span>more</span>
      </div>
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Sensitivity</Th>
              <Th align="right">Visitors vs base</Th>
              <Th>Basis</Th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.sensitivity}>
                <Td className="min-w-[14rem]">{clean(r.sensitivity)}</Td>
                <Td align="right">{signedNum(r.delta_visitors)}</Td>
                <Td className="text-ink-2">{clean(r.basis)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </Tile>
  );
}

/* ------------------------------------------------------------------ funnel, base plan */

export function PlanFunnelTile({ p }: { p: Plan }) {
  const find = (rows: Plan['funnel']['base'], prefix: string) => rows.find((s) => s.stage.startsWith(prefix))?.count ?? 0;
  const B = (k: string) => find(p.funnel.base, k);
  const S = (k: string) => find(p.funnel.stretch, k);
  const ident = B('Identified');
  const reg = B('Registered');
  const live = B('Live pass');
  const fromRegs = B('Verified visitors from registrants');
  const walk = B('Walk-ins');
  const ns = B('Unique verified');
  const lost = (n: number) => ({ label: 'Lost at this step', value: num(n), total: true });
  const stages: FunnelStage[] = [
    { key: 'ident', label: 'Identified', sub: `stretch ${num(S('Identified'))}`, value: ident, field: 'pista' },
    { key: 'reg', label: 'Registered', sub: `stretch ${num(S('Registered'))}`, value: reg, field: 'nizami' },
    { key: 'live', label: 'Live pass at T-0', sub: `stretch ${num(S('Live pass'))}`, value: live, field: 'nizami2' },
    {
      key: 'ns',
      label: 'Verified visitors',
      sub: (
        <>
          <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px] bg-sand" />
          {num(walk)} walk-ins
        </>
      ),
      value: ns,
      field: 'lac',
      cap: walk > 0 ? { value: walk, label: `${num(walk)} walk-ins`, tip: { title: 'Walk-ins verified at the gate', rows: [{ color: 'var(--sand)', label: 'Planned walk-ins', value: num(walk), swatch: 'square' }] } } : undefined,
    },
  ];
  const leaks: FunnelLeak[] = [
    { value: Math.max(0, ident - reg), label: 'never register', tip: { title: 'Identified, never register', rows: [lost(Math.max(0, ident - reg))] } },
    { value: Math.max(0, reg - live), label: 'leak before T-0', tip: { title: 'Registered, no live pass at T-0', rows: [lost(Math.max(0, reg - live))], notes: ['Net of the passes the show-up engine recovers.'] } },
    { value: Math.max(0, live - fromRegs), label: 'no-shows', tip: { title: 'Live pass, did not come', rows: [lost(Math.max(0, live - fromRegs))] } },
  ];
  const reach = [
    { k: 'Priority pool', label: 'Priority pool' },
    { k: 'Unique students reached', label: 'Reached' },
    { k: 'Landing-page', label: 'Sessions' },
  ];
  return (
    <Tile field="stone" delay={420} className="col-span-5 flex flex-col max-[1200px]:col-span-12" aria-label="The base plan funnel">
      <TileHead icon={FunnelDuotone} aside="base plan, modelled">
        From reach to the gate
      </TileHead>
      <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[12px] bg-stone-2 p-1.5">
        {reach.map((r) => (
          <div key={r.k} className="min-w-0 px-2 py-1.5">
            <div className="num truncate text-[18px] leading-none">{num(B(r.k))}</div>
            <div className="mt-1 truncate text-[11.5px] font-[600] text-ink-2">{r.label}</div>
          </div>
        ))}
      </div>
      <div className="flex min-h-[250px] flex-1 flex-col max-[720px]:min-h-0">
        <StepFunnel stages={stages} leaks={leaks} format={num} />
      </div>
      <ChartData>
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
                <Td className="min-w-[14rem]" title={s.basis}>
                  {s.stage}
                </Td>
                <Td align="right">{num(s.count)}</Td>
                <Td align="right">{s.rate != null ? pct(s.rate) : ''}</Td>
                <Td align="right">{num(p.funnel.stretch.find((x) => x.stage === s.stage)?.count)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
      <HowThisWorks>
        <p>Every number here is modelled, not observed: it comes from analysis/model.py and its sourced inputs.</p>
        <p>The base keeps 2025&apos;s channel rates where they were measured and counts nothing for mechanisms still gated on a pilot or a sponsor.</p>
      </HowThisWorks>
    </Tile>
  );
}
