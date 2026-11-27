'use client';
import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useApi } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { addDays, dateLabel, daysBetween, num } from '@/lib/format';
import { cx } from '@/components/ui';

interface Tape {
  start: string;
  end: string;
  eventStart: string;
  eventEnd: string;
  targetChanges: { date: string; version: string }[];
  days: { date: string; regs: number; visitors: number; spend: number }[];
}

const H = 40;

/**
 * The campaign tape: a scrubbable timeline of the whole campaign. Bar height = registrations that day;
 * event days show verified visitors. Moving the handle rewinds every page to the end of that day (IST).
 */
export function CampaignTape() {
  const { asOf, setAsOf } = useApp();
  const { data } = useApi<Tape>('/api/tape');
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const n = data ? data.days.length : 0;
  // registrations and event-day entries are scaled separately so campaign days stay readable
  const maxRegs = useMemo(() => (data ? Math.max(1, ...data.days.map((d) => d.regs)) : 1), [data]);
  const maxVis = useMemo(() => (data ? Math.max(1, ...data.days.map((d) => d.visitors)) : 1), [data]);

  const dateAt = useCallback(
    (clientX: number) => {
      if (!data || !ref.current) return null;
      const r = ref.current.getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.floor(((clientX - r.left) / r.width) * n)));
      return data.days[i]?.date ?? null;
    },
    [data, n],
  );

  if (!data || !asOf) return <div className="h-[58px] flex-1 animate-pulse rounded-lg bg-paper-2" aria-label="Loading timeline" />;

  const idx = Math.max(0, Math.min(n - 1, daysBetween(data.start, asOf)));
  const bw = 100 / n;
  const shown = hover ?? asOf;
  const shownDay = data.days.find((d) => d.date === shown);
  const evI = daysBetween(data.start, data.eventStart);
  const evJ = daysBetween(data.start, data.eventEnd);

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 7 : 1;
    if (e.key === 'ArrowLeft') setAsOf(addDays(asOf, -step) < data.start ? data.start : addDays(asOf, -step));
    else if (e.key === 'ArrowRight') setAsOf(addDays(asOf, step) > data.end ? data.end : addDays(asOf, step));
    else if (e.key === 'Home') setAsOf(data.start);
    else if (e.key === 'End') setAsOf(data.end);
    else return;
    e.preventDefault();
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag(true);
    const d = dateAt(e.clientX);
    if (d) setAsOf(d);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = dateAt(e.clientX);
    if (drag && d && d !== asOf) setAsOf(d);
    setHover(drag ? null : d);
  };

  const presets = [
    { label: 'Mid-campaign', date: '2025-03-09' },
    { label: 'Event day 1', date: data.eventStart },
    { label: 'Latest', date: data.end },
  ].filter((p) => p.date >= data.start && p.date <= data.end);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <div className="w-[9.5rem] shrink-0 leading-tight">
        <div className="text-[0.75rem] text-ink-3">{hover ? 'Hovering' : 'Data as of'}</div>
        <div className="type-title num text-[1.05rem]">{dateLabel(shown, true)}</div>
        <div className="num text-[0.75rem] text-ink-3">
          {shownDay ? (shownDay.visitors ? `${num(shownDay.visitors)} first entries that day` : shownDay.regs ? `${num(shownDay.regs)} registrations that day` : 'no new registrations') : ''}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <svg
          ref={ref}
          role="slider"
          tabIndex={0}
          aria-label="Time travel: choose the as-of date"
          aria-valuemin={0}
          aria-valuemax={n - 1}
          aria-valuenow={idx}
          aria-valuetext={dateLabel(asOf, true)}
          onKeyDown={onKey}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => setDrag(false)}
          onPointerLeave={() => {
            setHover(null);
            setDrag(false);
          }}
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="block h-[46px] w-full cursor-ew-resize touch-none select-none"
        >
          <rect x={evI * bw} y={0} width={(evJ - evI + 1) * bw} height={H} fill="var(--lac-soft)" />
          {data.days.map((d, i) => {
            const h = d.visitors ? Math.max(4, (d.visitors / maxVis) * (H - 2)) : Math.max(0.8, (d.regs / maxRegs) * (H - 4));
            const future = i > idx;
            return (
              <rect
                key={d.date}
                x={i * bw + bw * 0.14}
                width={bw * 0.72}
                y={H - h}
                height={h}
                fill={d.visitors ? 'var(--lac)' : future ? 'var(--line-2)' : 'var(--ink)'}
                opacity={future ? 0.7 : 1}
              />
            );
          })}
          {data.targetChanges.slice(1).map((t) => {
            const i = daysBetween(data.start, t.date);
            return <rect key={t.date} x={i * bw} y={0} width={0.18} height={H} fill="var(--zari-bright)" />;
          })}
          <rect x={(idx + 1) * bw - 0.25} y={0} width={0.5} height={H} fill="var(--sagar)" />
        </svg>
        <div className="relative mt-0.5 h-4 text-[0.7rem] text-ink-3" aria-hidden>
          <span className="absolute left-0">{dateLabel(data.start)}</span>
          {data.targetChanges.slice(1).map((t) => (
            <span key={t.date} className="absolute -translate-x-1/2 text-zari" style={{ left: `${daysBetween(data.start, t.date) * bw}%` }}>
              targets revised
            </span>
          ))}
          <span className="absolute -translate-x-1/2 text-lac" style={{ left: `${(evI + 1) * bw}%` }}>
            event
          </span>
          {n - evI > 12 ? <span className="absolute right-0">{dateLabel(data.end)}</span> : null}
        </div>
      </div>
      <div className="hidden shrink-0 gap-1 xl:flex">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setAsOf(p.date)}
            className={cx('h-7 rounded-full px-2.5 text-[0.75rem] font-medium', asOf === p.date ? 'bg-ink text-white' : 'bg-paper-2 text-ink-2 hover:text-ink')}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
