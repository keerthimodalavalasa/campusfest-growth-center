'use client';
import type { CSSProperties, ReactNode } from 'react';
import { ClipboardListDuotone, FlagDuotone, MapPinDuotone, UsersDuotone, WalletDuotone } from 'runeicons-react';
import { inr, inrShort, num, pct } from '@/lib/format';
import { cx, Delta, Ico, Tile } from '@/components/ui';
import { MetricTile } from '@/components/tiles';
import { tipProps } from '@/components/tooltip';
import { CountUp, Gauge, MiniBars, Ring } from '@/components/viz';
import type { Plan } from './model';

const chip = 'inline-flex h-[26px] shrink-0 items-center rounded-full px-2.5 text-[12.5px] leading-none font-[650] whitespace-nowrap';
/** Assumptions look different: a gated target is drawn hatched on the lac field. */
const HATCH = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 6px, transparent 6px 12px)';

export const inputValue = (p: Plan, k: string, dflt: number) => {
  const v = (p.inputs[k] as { value?: unknown } | undefined)?.value;
  return typeof v === 'number' ? v : dflt;
};

/**
 * The 2027 target ladder on the lac hero: 2025's actual, the stress-tested floor, the base we commit to (with the
 * sponsor band as a hatched cap) and the stretch aim (hatched: it unlocks only at its gates). One zero baseline,
 * so the rungs compare honestly, and a dotted line at 2025's level to show the climb.
 */
export function TargetHero({ p }: { p: Plan }) {
  const v2025 = inputValue(p, 'visitors_2025', 2050);
  const spend2025 = inputValue(p, 'spend_2025', 274000);
  const base = p.base.unique_verified_visitors;
  const stretch = p.stretch.unique_verified_visitors;
  const sponsor = p.sponsor_band.base_plus_band;
  const max = Math.max(stretch, sponsor, base) * 1.06;
  const h = (v: number) => `${(v / max) * 100}%`;
  const passed = p.checks.filter((c) => c.pass).length;

  const rungs: { key: string; label: string; value: number; cpv: number; kind: 'past' | 'floor' | 'commit' | 'aim'; note: string }[] = [
    { key: '2025', label: '2025 actual', value: v2025, cpv: spend2025 / v2025, kind: 'past', note: 'Verified at the gate, deduplicated by stable ID.' },
    { key: 'floor', label: 'Floor', value: p.floor.unique_verified_visitors, cpv: p.floor.cost_per_visitor_inr, kind: 'floor', note: 'Every channel 15% worse and the show-up engine at half strength.' },
    { key: 'base', label: 'Commit', value: base, cpv: p.base.cost_per_visitor_inr, kind: 'commit', note: `${pct(p.base.registrant_show)} of registrants show up. The number we commit to.` },
    { key: 'stretch', label: 'Aim', value: stretch, cpv: p.stretch.cost_per_visitor_inr, kind: 'aim', note: 'Each mechanism unlocks only when it passes its dated gate.' },
  ];

  return (
    <Tile field="lac" size="hero" delay={0} aria-label="Hyderabad 2027 targets" className="col-span-7 flex flex-col overflow-hidden max-[1200px]:col-span-12">
      <div className="flex flex-wrap items-center gap-2">
        <Ico icon={FlagDuotone} size={20} ia="#fff" ib="var(--lac-pale)" />
        <h2 className="text-[15px] leading-[1.3] font-[650]">Hyderabad 2027 target</h2>
        <span className={cx(chip, 'ml-auto bg-ground text-lac')}>13–14 Mar 2027, HITEX</span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="num text-[132px] leading-[0.8] font-[820] tracking-[-0.025em] max-[1200px]:text-[112px] max-[720px]:text-[88px]">
          <CountUp value={base} format={num} />
        </div>
        <div className="pb-1">
          <div className="num text-[30px] leading-none">commit</div>
          <div className="mt-1 text-[12.5px] font-[550] text-k2">unique verified visitors</div>
        </div>
        <div className="ml-auto pb-1 text-right max-[720px]:ml-0 max-[720px]:text-left">
          <div className="num text-[44px] leading-[0.9] max-[720px]:text-[34px]">aim {num(stretch)}</div>
          <div className="mt-1 text-[12.5px] font-[550] text-k2">
            +{pct(base / v2025 - 1, 0)} committed, +{pct(stretch / v2025 - 1, 0)} aimed on 2025
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid h-[200px] grid-cols-4 items-end gap-3 max-[720px]:h-[170px] max-[720px]:gap-2" role="list" aria-label="Target ladder">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-dotted border-lac-pale" style={{ bottom: h(v2025) }}>
          <span className="tab absolute -top-[19px] left-0 text-[11.5px] font-[650] text-lac-soft">2025 level</span>
        </div>
        {rungs.map((r, i) => {
          const style: CSSProperties =
            r.kind === 'past'
              ? { background: 'var(--lac-track)' }
              : r.kind === 'floor'
                ? { boxShadow: 'inset 0 0 0 2px var(--lac-pale)', backgroundImage: 'none' }
                : r.kind === 'commit'
                  ? { background: '#fff', color: 'var(--lac)' }
                  : { backgroundImage: HATCH, boxShadow: 'inset 0 0 0 2px #fff' };
          return (
            <div
              key={r.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${r.label}: ${num(r.value)} visitors, ${inr(r.cpv)} each`}
              {...tipProps({ title: r.label, rows: [{ label: 'Verified visitors', value: num(r.value) }, { label: 'Cost per visitor', value: inr(r.cpv) }, ...(r.kind === 'commit' ? [{ label: 'With a prize sponsor', value: `+${num(sponsor - base)}` }] : [])], notes: [r.note] })}
              className="relative h-full"
            >
              {r.kind === 'commit' && sponsor > base ? (
                <div
                  aria-hidden
                  className="anim-grow-y absolute inset-x-0 rounded-t-[6px]"
                  style={{ bottom: h(base), height: `calc(${h(sponsor - base)} + 2px)`, backgroundImage: HATCH, boxShadow: 'inset 0 0 0 2px #fff', '--d': '520ms' } as CSSProperties}
                />
              ) : null}
              <div
                className={cx('anim-grow-y absolute inset-x-0 bottom-0 flex flex-col px-3 py-2.5 max-[720px]:px-2', r.kind === 'commit' && sponsor > base ? 'rounded-b-[6px]' : 'rounded-[6px]')}
                style={{ height: h(r.value), ...style, '--d': `${120 + i * 80}ms` } as CSSProperties}
              >
                <span className="num text-[34px] leading-[0.9] max-[720px]:text-[22px]">{num(r.value)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-3 max-[720px]:gap-2">
        {rungs.map((r) => (
          <div key={r.key} className="min-w-0 text-[13px] leading-[1.3] font-[650]">
            {r.label}
            <small className="tab block text-[12px] font-[550] text-k2">{inr(r.cpv)} each</small>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 pt-3.5 text-[12.5px] font-[550] text-k2 shadow-[inset_0_1px_0_var(--rule)]">
        <Key swatch={{ background: '#fff' }}>commit</Key>
        <Key swatch={{ backgroundImage: HATCH, boxShadow: 'inset 0 0 0 1.5px #fff' }}>gated: sponsor +{num(sponsor - base)}, stretch</Key>
        <Key swatch={{ boxShadow: 'inset 0 0 0 1.5px var(--lac-pale)' }}>stress floor</Key>
        <span className={cx(chip, 'ml-auto bg-transparent text-white shadow-[inset_0_0_0_1.5px_var(--lac-soft)] max-[720px]:ml-0')}>
          {passed} of {p.checks.length} model checks pass
        </span>
      </div>
    </Tile>
  );
}

function Key({ swatch, children }: { swatch: CSSProperties; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <i aria-hidden className="block size-3 rounded-[3px]" style={swatch} />
      {children}
    </span>
  );
}

/** The plan's other key numbers: limestone tiles, each family hue as a mark (one solid tile per row is the hero). */
export function PlanKpis({ p }: { p: Plan }) {
  const total = p.budget.total;
  const reserve = p.budget.lines.filter((l) => l.idea === 'reserve').reduce((s, l) => s + l.inr, 0);
  const committed = total > 0 ? (total - reserve) / total : 0;
  const regs2025 = inputValue(p, 'registrations_2025', 2800);
  const regVisitors2025 = inputValue(p, 'registered_visitors_2025', 1925);
  const show2025 = regs2025 > 0 ? regVisitors2025 / regs2025 : null;
  const cpv2025 = inputValue(p, 'spend_2025', 274000) / inputValue(p, 'visitors_2025', 2050);
  const weekly = p.pacing?.base?.weekly ?? [];
  const peakI = weekly.reduce((bi, v, i) => (v > (weekly[bi] ?? -1) ? i : bi), 0);
  const peakWeek = p.pacing?.base?.weeks?.[peakI]?.split(' ')[0] ?? null;
  const cap = p.capacity;
  const permit = typeof cap.permit_ask === 'object' ? (cap.permit_ask.concurrent ?? null) : null;
  const peakB = cap.base.on_site_peak ?? null;
  const peakS = cap.stretch.on_site_peak ?? null;
  const cls = 'min-h-[184px]';

  return (
    <div className="col-span-5 grid grid-cols-2 gap-3 max-[1200px]:col-span-12 max-[1200px]:grid-cols-4 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
      <MetricTile
        icon={WalletDuotone}
        ia="var(--haldi-track)"
        ib="var(--haldi)"
        title="Budget, same as 2025"
        label="Budget"
        delay={60}
        className={cls}
        viz={<Ring value={committed} track="var(--stone-2)" arc="var(--haldi)" ink="var(--ink)" label={`${pct(committed, 0)} committed to bets, the rest held in reserve`} />}
        value={<CountUp value={total} format={inrShort} />}
        sub={`${inrShort(reserve)} held in reserve`}
        foot={
          <>
            <span className="whitespace-nowrap">{inr(p.base.cost_per_visitor_inr)} per visitor</span>
            <Delta now={p.base.cost_per_visitor_inr} prev={cpv2025} format={inr} lowerIsBetter colored label="vs 2025" />
          </>
        }
      />
      <MetricTile
        icon={ClipboardListDuotone}
        ia="var(--nizami)"
        ib="var(--nizami-2)"
        title="Registrations needed"
        label="Registrations needed"
        delay={100}
        className={cls}
        wideViz
        vizClass="!top-[20px] !h-[40px] !w-[92px] max-[720px]:!h-[40px] max-[720px]:!w-[92px]"
        viz={weekly.length ? <MiniBars values={weekly} color="var(--nizami)" width={92} height={40} gap={3} label="Weekly registrations the base plan needs" /> : null}
        value={<CountUp value={p.base.registrations} format={num} />}
        sub={`base plan, ${num(regs2025)} in 2025`}
        foot={weekly.length ? <span className="whitespace-nowrap">Peak {num(weekly[peakI])} in {peakWeek}</span> : null}
      />
      <MetricTile
        icon={UsersDuotone}
        ia="var(--lac)"
        ib="var(--lac-pale)"
        title="Registrant show-up"
        label="Registrant show-up"
        delay={140}
        className={cls}
        wideViz
        vizClass="!top-[18px] !h-[54px] !w-[92px] max-[720px]:!h-[47px] max-[720px]:!w-20"
        viz={<Gauge value={p.base.registrant_show} assumed label={`${pct(p.base.registrant_show)} planned show-up, modelled`} />}
        value={<CountUp value={p.base.registrant_show * 100} format={(n) => `${n.toFixed(1)}%`} />}
        sub={show2025 != null ? `planned, ${pct(show2025)} in 2025` : 'planned'}
        foot={<span className="whitespace-nowrap">Engine adds {num(p.base.engine?.total ?? 0)} visitors</span>}
      />
      <MetricTile
        icon={MapPinDuotone}
        ia="var(--ink)"
        ib="var(--stone-3)"
        title="Peak on site"
        label="Peak on site"
        delay={180}
        className={cls}
        viz={permit && peakB != null ? <Ring value={peakB / permit} ghost={peakS != null ? peakS / permit : null} track="var(--stone-2)" arc="var(--ink)" ink="var(--ink)" ghostColor="var(--stone-3)" label={`${pct(peakB / permit, 0)} of the permit asked`} /> : null}
        value={peakB != null ? <CountUp value={peakB} format={num} /> : '–'}
        sub={permit ? `of ${num(permit)} permit asked` : 'no permit set'}
        foot={peakS != null ? <span className="whitespace-nowrap">Stretch {num(peakS)}, still under</span> : null}
      />
    </div>
  );
}
