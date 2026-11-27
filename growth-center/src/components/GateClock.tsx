'use client';
import type { CSSProperties } from 'react';
import type { EventDays } from '@/server/engine/eventday';
import { num } from '@/lib/format';
import { tipProps } from '@/components/tooltip';

/*
  The gate clock, drawn for the Bidri tile (dark metal with silver inlay).
  Arrivals: one wedge per event day inside each opening hour on a 12-hour face, radius = sqrt(first entries)
  so area reads as people. Countdown: one tick per campaign day, weeks longer, the event as a lac dot.
*/

const S = 300;
const C = S / 2;
const DAY_COLORS = ['var(--lac-bright)', 'var(--lac-pale)', 'var(--silver)'];
export const gateDayColor = (i: number) => DAY_COLORS[Math.min(i, DAY_COLORS.length - 1)];
const v = (o: Record<string, string | number>) => o as CSSProperties;

function arcPath(r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0);
  const [x1, y1] = p(r1, a1);
  const [x2, y2] = p(r0, a1);
  const [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}

/** Radial gate clock: first entries by hour for each event day, unique visitors in the middle. */
export function GateClock({ data, className }: { data: EventDays; className?: string }) {
  const days = data.days;
  const open = [...new Set(days.flatMap((d) => d.hours.filter((h) => h.firstEntries > 0).map((h) => h.hour)))].sort((a, b) => a - b);
  const face = open.length && open[open.length - 1] - open[0] >= 12 ? 24 : 12;
  const slot = (Math.PI * 2) / face;
  const sub = slot / Math.max(1, days.length);
  const max = Math.max(1, ...days.flatMap((d) => d.hours.map((h) => h.firstEntries)));
  const r0 = 58;
  const rMax = 136;
  const angle = (h: number) => -Math.PI / 2 + ((h % face) / face) * Math.PI * 2;
  const peak = days[0];
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      role="img"
      aria-label={`First entries by hour. ${days
        .filter((d) => d.uniqueVisitors)
        .map((d, i) => `Day ${i + 1}: ${d.uniqueVisitors} visitors, peak ${d.peakHour}:00 with ${d.peakFirstEntries}`)
        .join('. ')}`}
      className={className}
      style={{ overflow: 'visible' }}
    >
      <circle cx={C} cy={C} r={r0 - 4} fill="var(--bidri-2)" />
      {Array.from({ length: 12 }, (_, k) => {
        const a = -Math.PI / 2 + (k / 12) * Math.PI * 2;
        return <line key={k} x1={C + 48 * Math.cos(a)} y1={C + 48 * Math.sin(a)} x2={C + 52 * Math.cos(a)} y2={C + 52 * Math.sin(a)} stroke="var(--bidri-3)" strokeWidth="2" strokeLinecap="round" />;
      })}
      {open.map((h, k) => {
        const a0 = angle(h);
        const mid = a0 + slot / 2;
        const label = face === 12 ? (h % 12 === 0 ? 12 : h % 12) : h;
        return (
          <g key={h}>
            <text x={C + 147 * Math.cos(mid)} y={C + 147 * Math.sin(mid)} textAnchor="middle" dominantBaseline="central" fill="var(--silver-2)" style={{ fontSize: 11.5, fontWeight: 600 }}>
              {label}
            </text>
            {days.map((d, j) => {
              const hr = d.hours.find((x) => x.hour === h);
              if (!hr || hr.firstEntries <= 0) return null;
              const s0 = a0 + j * sub + 0.03;
              const s1 = a0 + (j + 1) * sub - 0.03;
              const r1 = r0 + (rMax - r0) * Math.sqrt(hr.firstEntries / max);
              return (
                <path
                  key={d.date}
                  className="anim-fade"
                  style={v({ '--d': `${120 + k * 50 + j * 25}ms` })}
                  d={arcPath(r0, r1, s0, s1)}
                  fill={gateDayColor(j)}
                  {...tipProps({
                    title: `Day ${j + 1}, ${h}:00 to ${h + 1}:00`,
                    rows: [
                      { color: gateDayColor(j), label: 'First entries', value: num(hr.firstEntries), swatch: 'square' },
                      { label: 'All admissions', value: num(hr.admissions) },
                    ],
                  })}
                />
              );
            })}
          </g>
        );
      })}
      <text x={C} y={C - 4} textAnchor="middle" fill="#fff" style={{ fontStretch: '75%', fontWeight: 800, fontSize: 34 }}>
        {num(data.uniqueVisitors)}
      </text>
      <text x={C} y={C + 16} textAnchor="middle" fill="var(--silver)" style={{ fontSize: 11.5, fontWeight: 600 }}>
        unique visitors
      </text>
      {peak && !open.length ? (
        <text x={C} y={C + 96} textAnchor="middle" fill="var(--silver-2)" style={{ fontSize: 12, fontWeight: 600 }}>
          No admissions yet
        </text>
      ) : null}
    </svg>
  );
}

/** Countdown face before the event: a tick per campaign day (weeks longer), filled up to the as-of day. */
export function GateCountdown({ totalDays, doneDays, daysLeft, className }: { totalDays: number; doneDays: number; daysLeft: number; className?: string }) {
  const total = Math.max(1, totalDays);
  const ea = -Math.PI / 2 + (Math.PI * 2 * (total - 0.5)) / total;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label={`${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} until the gates open`} className={className} style={{ overflow: 'visible' }}>
      {Array.from({ length: total }, (_, i) => {
        const a = -Math.PI / 2 + (i / total) * Math.PI * 2;
        const r1 = i % 7 === 0 ? 128 : 118;
        const on = i < doneDays;
        return (
          <line
            key={i}
            className="anim-fade"
            style={v({ '--d': `${Math.round(i * 6)}ms` })}
            x1={C + 96 * Math.cos(a)}
            y1={C + 96 * Math.sin(a)}
            x2={C + r1 * Math.cos(a)}
            y2={C + r1 * Math.sin(a)}
            stroke={on ? 'var(--silver)' : 'var(--bidri-3)'}
            strokeWidth={on ? 2.6 : 2}
            strokeLinecap="round"
          />
        );
      })}
      <circle cx={C + 136 * Math.cos(ea)} cy={C + 136 * Math.sin(ea)} r="6" fill="var(--lac-bright)" />
      <text x={C} y={C - 6} textAnchor="middle" fill="#fff" style={{ fontStretch: '75%', fontWeight: 800, fontSize: 76 }}>
        {daysLeft}
      </text>
      <text x={C} y={C + 30} textAnchor="middle" fill="var(--silver)" style={{ fontSize: 13, fontWeight: 600 }}>
        {daysLeft === 1 ? 'day to the gate' : 'days to the gate'}
      </text>
    </svg>
  );
}
