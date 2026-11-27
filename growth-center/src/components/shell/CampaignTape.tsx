'use client';
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useApi } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { addDays, dateLabel, daysBetween, inr, num } from '@/lib/format';
import { cx, Segmented, Skeleton } from '@/components/ui';
import { hideTip, showTip } from '@/components/tooltip';
import { useElementWidth } from '@/components/viz';

interface Tape {
  start: string;
  end: string;
  eventStart: string;
  eventEnd: string;
  targetChanges: { date: string; version: string }[];
  days: { date: string; regs: number; visitors: number; spend: number }[];
}

const BAR_H = 42;
type Preset = 'mid' | 'day1' | 'latest';

/**
 * The as-of tape: a limestone tile under the top bar. Each bar is a campaign day (registrations; event days show
 * first entries). Drag, click or use the arrow keys to rewind every page to the end of any day (IST);
 * the presets on the right jump to the three reference dates. The choice lives in the URL (?asOf=).
 */
export function CampaignTape() {
  const { asOf, setAsOf, meta } = useApp();
  const { data } = useApi<Tape>('/api/tape');
  const barsRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  // measured, so labels hide by real pixels (not by a day count that collides on narrow screens)
  const [labelsRef, labelsW] = useElementWidth<HTMLDivElement>();

  const n = data ? data.days.length : 0;
  const maxRegs = useMemo(() => (data ? Math.max(1, ...data.days.map((d) => d.regs)) : 1), [data]);
  const maxVis = useMemo(() => (data ? Math.max(1, ...data.days.map((d) => d.visitors)) : 1), [data]);

  if (!data || !asOf) return <Skeleton className="mb-3 h-[90px] rounded-tile-l bg-stone max-[1200px]:h-[132px]" />;

  const idx = Math.max(0, Math.min(n - 1, daysBetween(data.start, asOf)));
  const pos = (i: number) => ((i + 0.5) / n) * 100;
  const evI = daysBetween(data.start, data.eventStart);
  const evJ = daysBetween(data.start, data.eventEnd);
  const revisions = data.targetChanges.slice(1);
  const cut = Date.parse(`${asOf}T23:59:59.999+05:30`);
  const version = meta?.targets.filter((t) => t.effectiveAt <= cut).pop()?.version ?? 'No target set yet';

  const indexAt = (clientX: number) => {
    const el = barsRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
  };
  const tipFor = (i: number, x: number, y: number) => {
    const d = data.days[i];
    if (!d) return;
    showTip(
      {
        title: dateLabel(d.date, true),
        rows: d.visitors
          ? [{ color: 'var(--lac-bright)', label: 'First entries', value: num(d.visitors), swatch: 'square' }]
          : [
              { color: 'var(--nizami-2)', label: 'Registrations', value: num(d.regs), swatch: 'square' },
              { label: 'Net spend', value: inr(d.spend) },
            ],
      },
      x,
      y,
    );
  };

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1;
    if (e.key === 'ArrowLeft') setAsOf(addDays(asOf, -step) < data.start ? data.start : addDays(asOf, -step));
    else if (e.key === 'ArrowRight') setAsOf(addDays(asOf, step) > data.end ? data.end : addDays(asOf, step));
    else if (e.key === 'Home') setAsOf(data.start);
    else if (e.key === 'End') setAsOf(data.end);
    else return;
    e.preventDefault();
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag(true);
    hideTip();
    const i = indexAt(e.clientX);
    if (i != null) setAsOf(data.days[i].date);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const i = indexAt(e.clientX);
    if (i == null) return;
    if (drag) {
      if (data.days[i].date !== asOf) setAsOf(data.days[i].date);
    } else if (e.pointerType !== 'touch') tipFor(i, e.clientX, e.clientY);
  };

  const presets: { value: Preset; label: string; date: string }[] = [
    { value: 'mid' as const, label: 'Mid-campaign', date: '2025-03-09' },
    { value: 'day1' as const, label: 'Event day 1', date: data.eventStart },
    { value: 'latest' as const, label: 'Latest', date: data.end },
  ].filter((p) => p.date >= data.start && p.date <= data.end);
  const activePreset = presets.find((p) => p.date === asOf)?.value ?? null;

  return (
    <section
      aria-label="Time travel"
      className="field-stone mb-3 grid grid-cols-[220px_minmax(0,1fr)_auto] items-center gap-7 rounded-tile-l py-3.5 pr-4 pl-6 max-[1200px]:grid-cols-[190px_minmax(0,1fr)] max-[1200px]:gap-x-7 max-[1200px]:gap-y-3 max-[720px]:grid-cols-1 max-[720px]:gap-3.5 max-[720px]:p-4"
    >
      <div className="min-w-0">
        <div className="text-[12.5px] font-[550] text-ink-2">Data as of</div>
        <div className="num mt-[3px] mb-1.5 text-[30px] leading-none">{dateLabel(asOf, true)}</div>
        <div className="flex items-center gap-1.5 text-[12.5px] font-[600] text-ink">
          <i aria-hidden className="block size-2 rounded-[2px] bg-haldi" />
          <span className="truncate">{version}</span>
        </div>
      </div>

      <div className="relative h-[62px] min-w-0">
        <div
          ref={barsRef}
          role="slider"
          tabIndex={0}
          aria-label="As-of date"
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={idx}
          aria-valuetext={dateLabel(asOf, true)}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
          onPointerLeave={() => {
            hideTip();
            setDrag(false);
          }}
          onBlur={() => hideTip()}
          className="absolute inset-x-0 top-0 flex cursor-ew-resize touch-none items-end gap-px select-none"
          style={{ height: BAR_H }}
        >
          {data.days.map((d, i) => {
            const h = d.visitors ? Math.max(4, (d.visitors / maxVis) * BAR_H) : Math.max(1, (d.regs / maxRegs) * (BAR_H - 4));
            const future = i > idx;
            const bg = d.visitors ? (future ? 'var(--lac-pale)' : 'var(--lac)') : future ? 'var(--stone-3)' : 'var(--nizami)';
            return <span key={d.date} className="block min-w-0 flex-1 rounded-t-[1.5px]" style={{ height: h, background: bg }} />;
          })}
        </div>
        {revisions.map((t) => (
          <div key={t.date} aria-hidden className="pointer-events-none absolute -top-1 h-[50px] w-0.5 rounded-[1px] bg-haldi" style={{ left: `${pos(daysBetween(data.start, t.date))}%` }} />
        ))}
        <div
          aria-hidden
          className={cx(
            'pointer-events-none absolute -top-1.5 -ml-px h-[54px] w-0.5 rounded-[1px] bg-ink after:absolute after:-top-1 after:-left-1 after:size-2.5 after:rounded-full after:bg-ink after:shadow-[0_0_0_2px_var(--stone)] after:content-[""]',
            !drag && 'transition-[left] duration-[260ms] ease-out motion-reduce:transition-none',
          )}
          style={{ left: `${pos(idx)}%` }}
        />
        <div ref={labelsRef} aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3 text-[11.5px] leading-none font-[600] whitespace-nowrap text-ink-2">
          <span className="absolute left-0">{dateLabel(data.start)}</span>
          {revisions.map((t) => (
            <span key={t.date} className="absolute -translate-x-1/2 text-haldi-ink" style={{ left: `${pos(daysBetween(data.start, t.date))}%` }}>
              Targets revised
            </span>
          ))}
          <span className="absolute -translate-x-1/2 text-lac" style={{ left: `${pos((evI + evJ) / 2)}%` }}>
            Event
          </span>
          {/* the end date shows only when it clears the "Event" label: half of "Event" (~20px) + "20 Apr" (~44px) + a gap */}
          {labelsW > 0 && labelsW * (1 - pos((evI + evJ) / 2) / 100) > 76 ? <span className="absolute right-0">{dateLabel(data.end)}</span> : null}
        </div>
      </div>

      <Segmented
        label="Jump to date"
        value={activePreset}
        onChange={(k) => {
          const p = presets.find((x) => x.value === k);
          if (p) setAsOf(p.date);
        }}
        options={presets.map((p) => ({ value: p.value, label: p.label }))}
        className="max-[1200px]:col-span-2 max-[1200px]:justify-self-start max-[720px]:col-span-1 max-[720px]:justify-self-stretch"
      />
    </section>
  );
}
