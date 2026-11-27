'use client';
import type { CSSProperties, ReactNode } from 'react';
import {
  ActivityDuotone,
  AlarmClockDuotone,
  ArrowDownRightDuotone,
  BellOffDuotone,
  ChartLineDuotone,
  HistoryDuotone,
  IndianRupeeDuotone,
  UserMinusDuotone,
  UsersDuotone,
  XDuotone,
} from 'runeicons-react';
import type { Signal } from '@/server/engine/diagnose';
import type { CampaignMetrics, Snapshot } from '@/server/engine/snapshot';
import { campaignColor, type FamilyKey } from '@/lib/colors';
import { inrShort, num, pct } from '@/lib/format';
import { cx, Ico, Pips, type IconComponent } from '@/components/ui';
import { tipProps } from '@/components/tooltip';

/*
  Signal tiles (promoted from the Overview). Each engine signal becomes one tile: its family hue, a glyph,
  the one number it is about and its comparison. Severity is fill weight: high is a solid family tile,
  medium and low stay limestone with a family-coloured icon block. Pips repeat the severity as weight.
*/

export interface SigView {
  fam: FamilyKey;
  icon: IconComponent;
  label: string;
  value: string;
  sub: string;
}

/** What a signal tile needs from the snapshot. Pages without a full snapshot pass what they have. */
export type SignalContext = Pick<Snapshot, 'campaigns' | 'totals' | 'projection' | 'target'>;

/** "50%" when the rate is whole at one decimal, otherwise "12.2%". */
const pctTidy = (x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return '–';
  const t = (x * 100).toFixed(1);
  return `${t.endsWith('.0') ? t.slice(0, -2) : t}%`;
};

/** Map an engine signal to a tile: family hue, glyph, the one number it is about, and its comparison. */
export function signalView(sig: Signal, s: SignalContext | null, maxOptOut: number): SigView {
  const id = sig.id;
  const m: CampaignMetrics | undefined = sig.campaignId && s ? s.campaigns.find((x) => x.campaignId === sig.campaignId) : undefined;
  const T = s?.totals;
  const P = s?.projection ?? null;
  const tg = s?.target ?? null;
  if (id.startsWith('showrate-') && m && T) return { fam: 'lac', icon: UserMinusDuotone, label: 'Show rate', value: pctTidy(m.rates.regToVisit), sub: `vs ${pct(T.rates.regToVisit)} overall` };
  if (id.startsWith('optout-') && m) return { fam: 'pista', icon: BellOffDuotone, label: 'Opt‑outs', value: pctTidy(m.rates.optOutRate), sub: `limit ${pctTidy(maxOptOut)}` };
  if (id.startsWith('cancel-') && m && T) return { fam: 'nizami', icon: XDuotone, label: 'Cancellations', value: pctTidy(m.rates.cancelRate), sub: `vs ${pct(T.rates.cancelRate)} overall` };
  if (id.startsWith('momentum-') && m) {
    const mo = m.momentum;
    const ch = mo.regsPrev7 > 0 ? mo.regsLast7 / mo.regsPrev7 - 1 : 0;
    return { fam: 'nizami', icon: ArrowDownRightDuotone, label: 'Weekly registrations', value: `${ch < 0 ? '−' : '+'}${pct(Math.abs(ch), 0)}`, sub: `${num(mo.regsLast7)} vs ${num(mo.regsPrev7)}` };
  }
  if (id.startsWith('spend-noresult-') && m) return { fam: 'haldi', icon: IndianRupeeDuotone, label: 'Spend, no registrations', value: inrShort(m.momentum.spendLast7), sub: 'last 7 days' };
  if (id === 'waitlist' && T) return { fam: 'nizami', icon: HistoryDuotone, label: 'Waitlisted', value: num(T.waitlisted), sub: 'none came last time' };
  if (id === 'stale-interested') return { fam: 'nizami', icon: AlarmClockDuotone, label: 'Stuck in interested', value: (sig.title.match(/\d[\d,]*/) ?? ['–'])[0], sub: '3+ days' };
  if (id === 'pace-registrations' && P) return { fam: 'nizami', icon: ChartLineDuotone, label: 'Registrations on pace', value: num(P.registrations), sub: tg ? `goal ${num(tg.registrationGoal)}` : 'no goal set' };
  if (id === 'pace-visitors' && P) return { fam: 'lac', icon: UsersDuotone, label: 'Visitors on pace', value: num(P.visitors), sub: tg ? `goal ${num(tg.visitorsGoal)}` : 'no goal set' };
  if (id === 'budget-over' && P) return { fam: 'haldi', icon: IndianRupeeDuotone, label: 'Spend on pace', value: inrShort(P.spend), sub: tg ? `budget ${inrShort(tg.budget)}` : 'no budget set' };
  return { fam: 'nizami', icon: ActivityDuotone, label: sig.title.split(':')[0], value: '', sub: '' };
}

export const SEV_LEVEL = { high: 3, medium: 2, low: 1 } as const;
const darkFam = (f: FamilyKey) => f === 'lac' || f === 'nizami';

/**
 * One signal as a tile. With `onSelect` and no `actions` the whole tile is a button (Overview: it opens the
 * copilot). With `actions` it is an article whose footer carries the buttons (Diagnose, campaign detail).
 * The evidence and suggested action travel in the shared dark tooltip and in the accessible name.
 */
export function SignalTile({
  sig,
  view: v,
  who,
  delay,
  onSelect,
  actions,
  className,
}: {
  sig: Signal;
  view: SigView;
  who: string;
  delay?: number;
  onSelect?: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  const lvl = SEV_LEVEL[sig.severity];
  const solid = lvl === 3;
  const dark = darkFam(v.fam);
  const inkA = dark ? '#fff' : 'var(--ink)';
  const inkB = solid ? (dark ? 'rgba(255,255,255,0.5)' : 'rgba(26,29,35,0.4)') : dark ? 'rgba(255,255,255,0.5)' : 'rgba(26,29,35,0.38)';
  const style = delay != null ? ({ '--d': `${delay}ms` } as CSSProperties) : undefined;
  const tip = tipProps({ title: sig.title, notes: [sig.evidence, <><b>Suggested:</b> {sig.suggestedAction}</>] });

  const body = (
    <>
      <span
        className="flex h-[50px] w-10 flex-col items-center justify-center gap-1.5 rounded-icon"
        style={{ background: solid ? (dark ? 'rgba(255,255,255,0.16)' : 'rgba(26,29,35,0.1)') : `var(--${v.fam})`, color: inkA }}
      >
        <Ico icon={v.icon} size={22} ia={inkA} ib={inkB} />
        <Pips level={lvl} />
      </span>
      <span className="min-w-0 text-[13.5px] leading-[1.25] font-[650]">
        {v.label}
        <small className={cx('mt-[3px] flex min-w-0 items-center gap-1.5 text-[12px] font-[550]', solid ? 'opacity-[0.86]' : 'text-ink-2')}>
          {sig.campaignId ? <i aria-hidden className="block size-2 shrink-0 rounded-full shadow-[0_0_0_1.5px_var(--ground)]" style={{ background: campaignColor(sig.campaignId) }} /> : null}
          <span className="truncate">{who}</span>
        </small>
      </span>
      <span className="text-right">
        <span className="num block text-[28px] leading-[0.9]">{v.value}</span>
        <small className={cx('mt-[3px] block text-[11.5px] font-[600] whitespace-nowrap', solid ? 'opacity-[0.86]' : 'text-ink-2')}>{v.sub}</small>
      </span>
    </>
  );
  const grid = 'grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3';

  if (!actions)
    return (
      <button
        type="button"
        onClick={onSelect}
        {...tip}
        aria-label={`${sig.severity} severity. ${v.label}, ${who}: ${v.value}, ${v.sub}. Ask the copilot why.`}
        className={cx(
          'anim-settle rounded-tile-m py-3 pr-3.5 pl-3 text-left transition-[transform,filter] duration-150 ease-out active:scale-[0.98]',
          grid,
          solid ? `field-${v.fam} hover:brightness-[1.08]` : 'field-stone hover:brightness-[0.96]',
          className,
        )}
        style={style}
      >
        {body}
      </button>
    );

  return (
    <article
      aria-label={`${sig.severity} severity. ${v.label}, ${who}`}
      className={cx('anim-settle flex min-w-0 flex-col rounded-tile-m py-3 pr-3.5 pl-3', solid ? `field-${v.fam}` : 'field-stone', className)}
      style={style}
    >
      <div className={grid} tabIndex={0} {...tip}>
        {body}
      </div>
      <p className="sr-only">
        {sig.title}. {sig.evidence} Suggested: {sig.suggestedAction}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2.5 shadow-[inset_0_1px_0_var(--rule)]">{actions}</div>
    </article>
  );
}
