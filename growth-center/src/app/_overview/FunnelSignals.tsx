'use client';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ActivityDuotone,
  AlarmClockDuotone,
  ArrowDownRightDuotone,
  ArrowUpRightDuotone,
  BellOffDuotone,
  ChartLineDuotone,
  FunnelDuotone,
  HistoryDuotone,
  IndianRupeeDuotone,
  MessageSquareTextDuotone,
  UserMinusDuotone,
  UsersDuotone,
  XDuotone,
} from 'runeicons-react';
import type { Diagnosis, Signal } from '@/server/engine/diagnose';
import { useApp } from '@/lib/app-state';
import { campaignColor, type FamilyKey } from '@/lib/colors';
import { dateLabel, inrShort, num, pct } from '@/lib/format';
import { cx, Ico, Pips, Skeleton, Tile, type IconComponent } from '@/components/ui';
import { StepFunnel, type FunnelLeak, type FunnelStage } from '@/components/viz';
import { tipProps } from '@/components/tooltip';
import { pctTidy, type Ctx } from './model';

/* ------------------------------------------------------------------ funnel */

export function FunnelTile({ c }: { c: Ctx }) {
  const { s, mode } = c;
  const t = s.totals;
  const pre = mode === 'campaign';
  const walkIns = s.excluded.walkInVisitors;
  const last = pre ? t.expectedVisitors : t.visitors;
  const ratio = (a: number, b: number) => (b > 0 ? pct(a / b, 0) : '–');
  const stages: FunnelStage[] = [
    { key: 'identified', label: 'Identified', sub: 'distinct people', value: t.identified, field: 'pista' },
    { key: 'registered', label: 'Registered', sub: `${ratio(t.registrations, t.identified)} of identified`, value: t.registrations, field: 'nizami' },
    { key: 'confirmed', label: 'Confirmed', sub: `${ratio(t.confirmed, t.registrations)} of registered`, value: t.confirmed, field: 'nizami2' },
    pre
      ? { key: 'visitors', label: 'Expected visitors', sub: `${pct(t.showRateAssumption, 0)} show rate assumed`, value: last, field: 'lac', assumed: true }
      : {
          key: 'visitors',
          label: mode === 'event' ? `Visitors, day ${c.eventDay}` : 'Verified visitors',
          sub: (
            <>
              <i aria-hidden className="block size-2.5 shrink-0 rounded-[3px] bg-sand" />
              {num(walkIns)} walk-ins on top
            </>
          ),
          value: last,
          field: 'lac',
          cap: walkIns > 0 ? { value: walkIns, label: `${num(walkIns)} walk-ins`, tip: { title: 'Walk-ins', rows: [{ color: 'var(--sand)', label: 'Came without registering', value: num(walkIns), swatch: 'square' }] } } : undefined,
        },
  ];
  const lostTotal = (n: number) => ({ label: 'Lost at this step', value: num(n), total: true });
  const leaks: FunnelLeak[] = [
    { value: Math.max(0, t.identified - t.registrations), label: 'never registered', tip: { title: 'Identified but never registered', rows: [lostTotal(Math.max(0, t.identified - t.registrations))] } },
    {
      value: Math.max(0, t.registrations - t.confirmed),
      label: 'not confirmed',
      tip: {
        title: 'Registered but not confirmed',
        rows: [{ label: 'Cancelled', value: num(t.cancelled) }, { label: 'Waitlisted', value: num(t.waitlisted) }, { label: 'Still interested', value: num(t.interested) }, lostTotal(Math.max(0, t.registrations - t.confirmed))],
      },
    },
    pre
      ? {
          value: Math.max(0, t.confirmed - t.expectedVisitors),
          label: 'assumed no-shows',
          tip: { title: 'Confirmed, assumed not to come', rows: [lostTotal(Math.max(0, t.confirmed - t.expectedVisitors))], notes: [`Planning assumption: ${pct(t.showRateAssumption, 0)} of confirmed registrants attend.`] },
        }
      : {
          value: Math.max(0, t.confirmed - t.registeredVisitors),
          label: mode === 'event' ? 'not arrived yet' : 'confirmed, never came',
          tip: { title: mode === 'event' ? 'Confirmed, not through the gate yet' : 'Confirmed but did not come', rows: [lostTotal(Math.max(0, t.confirmed - t.registeredVisitors))] },
        },
  ];
  const biggest = leaks.reduce((a, b) => (b.value > a.value ? b : a), leaks[0]);
  return (
    <Tile field="stone" delay={240} data-area="fun" aria-label="Funnel to the gate" className="flex flex-col">
      <div className="flex items-center gap-2">
        <Ico icon={FunnelDuotone} size={20} ia="var(--ink)" ib="var(--stone-3)" />
        <h2 className="text-[14px] leading-[1.3] font-[650]">Funnel to the gate</h2>
        {biggest.value > 0 ? (
          <span className="ml-auto truncate pl-2 text-[12.5px] font-[550] text-ink-2">
            Biggest leak: {num(biggest.value)} {biggest.label}
          </span>
        ) : null}
      </div>
      <StepFunnel stages={stages} leaks={leaks} format={num} />
    </Tile>
  );
}

/* ------------------------------------------------------------------ signals */

interface SigView {
  fam: FamilyKey;
  icon: IconComponent;
  label: string;
  value: string;
  sub: string;
}

/** Map an engine signal to a tile: family hue, glyph, the one number it is about, and its comparison. */
function sigView(sig: Signal, c: Ctx, maxOptOut: number): SigView {
  const { s } = c;
  const T = s.totals;
  const P = s.projection;
  const tg = s.target;
  const m = sig.campaignId ? s.campaigns.find((x) => x.campaignId === sig.campaignId) : undefined;
  const id = sig.id;
  if (id.startsWith('showrate-') && m) return { fam: 'lac', icon: UserMinusDuotone, label: 'Show rate', value: pctTidy(m.rates.regToVisit), sub: `vs ${pct(T.rates.regToVisit)} overall` };
  if (id.startsWith('optout-') && m) return { fam: 'pista', icon: BellOffDuotone, label: 'Opt‑outs', value: pctTidy(m.rates.optOutRate), sub: `limit ${pctTidy(maxOptOut)}` };
  if (id.startsWith('cancel-') && m) return { fam: 'nizami', icon: XDuotone, label: 'Cancellations', value: pctTidy(m.rates.cancelRate), sub: `vs ${pct(T.rates.cancelRate)} overall` };
  if (id.startsWith('momentum-') && m) {
    const mo = m.momentum;
    const ch = mo.regsPrev7 > 0 ? mo.regsLast7 / mo.regsPrev7 - 1 : 0;
    return { fam: 'nizami', icon: ArrowDownRightDuotone, label: 'Weekly registrations', value: `${ch < 0 ? '−' : '+'}${pct(Math.abs(ch), 0)}`, sub: `${num(mo.regsLast7)} vs ${num(mo.regsPrev7)}` };
  }
  if (id.startsWith('spend-noresult-') && m) return { fam: 'haldi', icon: IndianRupeeDuotone, label: 'Spend, no registrations', value: inrShort(m.momentum.spendLast7), sub: 'last 7 days' };
  if (id === 'waitlist') return { fam: 'nizami', icon: HistoryDuotone, label: 'Waitlisted', value: num(T.waitlisted), sub: 'none came last time' };
  if (id === 'stale-interested') return { fam: 'nizami', icon: AlarmClockDuotone, label: 'Stuck in interested', value: (sig.title.match(/\d[\d,]*/) ?? ['–'])[0], sub: '3+ days' };
  if (id === 'pace-registrations' && P) return { fam: 'nizami', icon: ChartLineDuotone, label: 'Registrations on pace', value: num(P.registrations), sub: tg ? `goal ${num(tg.registrationGoal)}` : 'no goal set' };
  if (id === 'pace-visitors' && P) return { fam: 'lac', icon: UsersDuotone, label: 'Visitors on pace', value: num(P.visitors), sub: tg ? `goal ${num(tg.visitorsGoal)}` : 'no goal set' };
  if (id === 'budget-over' && P) return { fam: 'haldi', icon: IndianRupeeDuotone, label: 'Spend on pace', value: inrShort(P.spend), sub: tg ? `budget ${inrShort(tg.budget)}` : 'no budget set' };
  return { fam: 'nizami', icon: ActivityDuotone, label: sig.title.split(':')[0], value: '', sub: '' };
}

const SEV = { high: 3, medium: 2, low: 1 } as const;
const darkFam = (f: FamilyKey) => f === 'lac' || f === 'nizami';
const MAX_SIGNALS = 7;

export function SignalsTiles({ c, diag }: { c: Ctx; diag: Diagnosis | null }) {
  const { askCopilot, meta, campaignName } = useApp();
  const maxOptOut = Number(meta?.settings?.maxOptOutRate ?? 0.08);
  const date = dateLabel(c.asOf, true);
  const all = diag?.signals ?? [];
  const shown = all.slice(0, MAX_SIGNALS);
  const counts = ([3, 2, 1] as const).map((l) => [l, all.filter((x) => SEV[x.severity] === l).length] as const).filter(([, n]) => n > 0);
  const names = { 3: 'high', 2: 'medium', 1: 'low' } as const;

  return (
    <section data-area="sig" aria-label="What needs attention" className="flex min-w-0 flex-col gap-2.5">
      <div className="anim-settle flex min-h-[26px] flex-wrap items-center gap-x-2 gap-y-1.5 px-1 pt-0.5 font-[650]" style={{ '--d': '240ms' } as CSSProperties}>
        <h2 className="text-[14px]">Needs attention</h2>
        <span className="tab inline-grid h-[22px] min-w-6 place-items-center rounded-full bg-ink px-[7px] text-[12px] font-[700] text-white">{diag ? all.length : '…'}</span>
        <span className="ml-2 inline-flex gap-3.5 text-[12.5px] font-[600] text-ink-2 max-[720px]:ml-0 max-[720px]:basis-full">
          {counts.map(([l, n]) => (
            <span key={l} className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Pips level={l} className="text-ink" />
              {n} {names[l]}
            </span>
          ))}
        </span>
        {all.length > MAX_SIGNALS ? (
          <Link href="/diagnose" className="ml-auto text-[12.5px] font-[600] text-ink-2 underline decoration-stone-3 underline-offset-2 hover:text-ink">
            {all.length - MAX_SIGNALS} more in Diagnose
          </Link>
        ) : null}
      </div>
      <div className="sig-grid flex-1">
        {!diag
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="min-h-[76px] rounded-tile-m bg-stone" />)
          : null}
        {diag && shown.length === 0 ? (
          <div className="field-stone flex items-center gap-3 rounded-tile-m px-3.5 py-3 text-[13.5px] font-[650]">
            Nothing flagged at this date
            <span className="block text-[12px] font-[550] text-ink-2">No rule fired as of {dateLabel(c.asOf)}</span>
          </div>
        ) : null}
        {diag
          ? shown.map((sig, i) => {
              const v = sigView(sig, c, maxOptOut);
              const lvl = SEV[sig.severity];
              const solid = lvl === 3;
              const who = sig.campaignId ? campaignName(sig.campaignId) : 'All campaigns';
              const dark = darkFam(v.fam);
              const inkA = solid ? (dark ? '#fff' : 'var(--ink)') : dark ? '#fff' : 'var(--ink)';
              const inkB = solid ? (dark ? 'rgba(255,255,255,0.5)' : 'rgba(26,29,35,0.4)') : dark ? 'rgba(255,255,255,0.5)' : 'rgba(26,29,35,0.38)';
              return (
                <button
                  key={sig.id}
                  type="button"
                  onClick={() =>
                    askCopilot(`Why is "${v.label.toLowerCase()}" flagged for ${who} as of ${date}? Explain the evidence and what you would do. Signal: ${sig.title}. Evidence: ${sig.evidence}`)
                  }
                  {...tipProps({ title: sig.title, notes: [sig.evidence, <><b>Suggested:</b> {sig.suggestedAction}</>] })}
                  aria-label={`${sig.severity} severity. ${v.label}, ${who}: ${v.value}, ${v.sub}. Ask the copilot why.`}
                  className={cx(
                    'anim-settle grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-tile-m py-3 pr-3.5 pl-3 text-left transition-[transform,filter] duration-150 ease-out active:scale-[0.98]',
                    solid ? `field-${v.fam} hover:brightness-[1.08]` : 'field-stone hover:brightness-[0.96]',
                  )}
                  style={{ '--d': `${260 + i * 45}ms` } as CSSProperties}
                >
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
                </button>
              );
            })
          : null}
        {diag ? (
          <button
            type="button"
            onClick={() => askCopilot(`Summarise what needs attention as of ${date}: why these ${all.length} signals fired, which matters most, and the one action you would take first.`)}
            className={cx(
              'sig-ask anim-settle field-bidri grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-tile-m py-3 pr-3.5 pl-3 text-left transition-[transform,background-color] duration-150 ease-out hover:bg-[#2b3037] active:scale-[0.98]',
              (shown.length || 1) % 2 === 0 ? 'sig-wide' : '',
            )}
            style={{ '--d': `${260 + shown.length * 45}ms` } as CSSProperties}
          >
            <span className="grid size-10 place-items-center rounded-icon bg-bidri-2">
              <Ico icon={MessageSquareTextDuotone} size={22} ia="var(--lac-pale)" ib="var(--bidri-2)" />
            </span>
            <span className="min-w-0 text-[13.5px] leading-[1.25] font-[650]">
              Ask why these happened
              <small className="mt-[3px] block text-[12px] font-[550] text-silver-2">Copilot reads this view</small>
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-ground">
              <Ico icon={ArrowUpRightDuotone} size={16} ia="var(--ink)" ib="var(--ink)" />
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

