'use client';
import type { Snapshot } from '@/server/engine/snapshot';
import { num, pct } from '@/lib/format';

/**
 * The funnel to the gate: identified people -> registered -> confirmed -> verified visitors.
 * Widths are proportional to people; the gaps between stages name who was lost.
 * Before the event the last stage is an expectation (dashed), labelled with its assumption.
 */
export function FunnelRibbon({ snap }: { snap: Snapshot }) {
  const t = snap.totals;
  const post = snap.phase === 'event' || snap.phase === 'post-event';
  const visitors = post ? t.visitors : t.expectedVisitors;
  const stages = [
    { key: 'identified', label: 'Identified people', value: t.identified, note: 'distinct external people' },
    { key: 'registered', label: 'Registered', value: t.registrations, note: pct(t.rates.identToReg) + ' of identified' },
    { key: 'confirmed', label: 'Confirmed', value: t.confirmed, note: pct(t.rates.regToConfirmed) + ' of registered' },
    {
      key: 'visitors',
      label: post ? 'Verified visitors' : 'Expected visitors',
      value: visitors,
      note: post ? `${num(t.registeredVisitors)} registered + ${num(snap.excluded.walkInVisitors)} walk-ins` : `confirmed × ${pct(t.showRateAssumption, 0)} show-rate assumption`,
    },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));
  const losses = [
    { label: 'never registered', value: t.identified - t.registrations },
    { label: `cancelled ${num(t.cancelled)}, waitlisted ${num(t.waitlisted)}, unconfirmed ${num(t.interested)}`, value: t.registrations - t.confirmed },
    { label: post ? 'confirmed but did not come' : 'expected no-shows', value: post ? t.confirmed - t.registeredVisitors : t.confirmed - visitors },
  ];

  return (
    <div className="space-y-1" role="img" aria-label={stages.map((s) => `${s.label} ${Math.round(s.value)}`).join(', ')}>
      {stages.map((s, i) => {
        const w = Math.max(2, (s.value / max) * 100);
        const last = i === stages.length - 1;
        return (
          <div key={s.key}>
            <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-4">
              <div className="relative h-11">
                <div
                  className="absolute inset-y-0 left-0 rounded-r-[10px] rounded-l-[4px]"
                  style={{
                    width: `${w}%`,
                    background: last ? (post ? 'var(--lac)' : 'repeating-linear-gradient(135deg, var(--lac-soft) 0 6px, #f0d2dd 6px 12px)') : `color-mix(in oklab, var(--ink) ${92 - i * 18}%, var(--paper))`,
                    border: last && !post ? '1.5px dashed var(--lac)' : undefined,
                  }}
                />
                <div className="absolute inset-y-0 left-3 flex items-center gap-2">
                  <span className={`num type-title text-[1.2rem] ${last && !post ? 'text-lac' : 'text-white'}`} style={{ textShadow: last && !post ? undefined : '0 1px 0 rgba(0,0,0,.15)' }}>
                    {num(s.value)}
                  </span>
                </div>
              </div>
              <div className="leading-tight">
                <div className="text-[0.9rem] font-semibold text-ink">{s.label}</div>
                <div className="text-[0.76rem] text-ink-3">{s.note}</div>
              </div>
            </div>
            {i < losses.length ? (
              <div className="flex h-6 items-center pl-3 text-[0.78rem] text-ink-3">
                <span className="mr-2 inline-block h-3 w-px bg-line-2" aria-hidden />
                <span className="num font-semibold text-lac">−{num(Math.max(0, losses[i].value))}</span>
                <span className="ml-1.5">{losses[i].label}</span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
