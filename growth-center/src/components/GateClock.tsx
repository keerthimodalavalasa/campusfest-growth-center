'use client';
import { useState } from 'react';
import type { EventDays } from '@/server/engine/eventday';
import { dateLabel, num, pct } from '@/lib/format';

/**
 * Gate clock: arrivals at the gate by IST hour around a 24-hour face (idea after Bklit UI's radial dot bars, MIT).
 * Each hour holds two dot columns, one per event day; one dot = DOT people (first entries that day).
 * The gate is closed outside the scanned hours, which stay as faint ticks, so the shape itself shows opening hours.
 */
const DOT = 20;
/** Rotation: 12:00 sits at the top so the gate's daytime hours read as an arc over the face. */
const ROT = Math.PI;
const COLORS = ['var(--lac)', 'var(--ink)'];

export function GateClock({ data, size = 380 }: { data: EventDays; size?: number }) {
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);
  const c = size / 2;
  const r0 = size * 0.2; // inner radius
  const days = data.days.slice(0, 2);
  const maxDots = Math.max(1, ...days.flatMap((d) => d.hours.map((h) => Math.round(h.firstEntries / DOT))));
  const avail = size * 0.43 - (r0 + 6);
  const step = Math.min(size * 0.0155, avail / maxDots); // radial spacing between dots, fitted to the busiest hour
  const dotR = Math.max(1.6, step * 0.36);
  const totalByHour = (h: number) => days.reduce((s, d) => s + d.hours[h].firstEntries, 0);
  const angle = (h: number, offset: number) => ((h + 0.5 + offset) / 24) * Math.PI * 2 - Math.PI / 2 + ROT;

  const hovered = hover ? days[hover.day]?.hours[hover.hour] : null;

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Arrivals by hour. ${days.map((d, i) => `Day ${i + 1}: ${d.uniqueVisitors} visitors, peak ${d.peakHour}:00`).join('. ')}`} className="max-w-full" onMouseLeave={() => setHover(null)}>
        <circle cx={c} cy={c} r={r0 - 4} fill="var(--paper)" />
        {Array.from({ length: 24 }, (_, h) => {
          const a = (h / 24) * Math.PI * 2 - Math.PI / 2 + ROT;
          const major = h % 6 === 0;
          const x1 = c + Math.cos(a) * (r0 - 10);
          const y1 = c + Math.sin(a) * (r0 - 10);
          const x2 = c + Math.cos(a) * (r0 - (major ? 2 : 6));
          const y2 = c + Math.sin(a) * (r0 - (major ? 2 : 6));
          return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-2)" strokeWidth={major ? 1.5 : 1} />;
        })}
        {[0, 6, 12, 18].map((h) => {
          // keep labels clear of the dot columns around noon
          const a = (h / 24) * Math.PI * 2 - Math.PI / 2 + ROT;
          const rr = size * 0.47;
          return (
            <text key={h} x={c + Math.cos(a) * rr} y={c + Math.sin(a) * rr} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="var(--ink-3)" className="num">
              {String(h).padStart(2, '0')}
            </text>
          );
        })}
        {days.map((d, di) =>
          d.hours.map((hr) => {
            const n = Math.round(hr.firstEntries / DOT);
            if (!n) return null;
            const a = angle(hr.hour, di === 0 ? -0.2 : 0.2);
            const active = hover && hover.day === di && hover.hour === hr.hour;
            return (
              <g key={`${di}-${hr.hour}`} onMouseEnter={() => setHover({ day: di, hour: hr.hour })} style={{ cursor: 'default' }}>
                {Array.from({ length: n }, (_, k) => (
                  <circle key={k} cx={c + Math.cos(a) * (r0 + 6 + k * step)} cy={c + Math.sin(a) * (r0 + 6 + k * step)} r={dotR} fill={COLORS[di]} opacity={hover && !active ? 0.35 : 1} />
                ))}
                {/* generous hit target along the column */}
                <line x1={c + Math.cos(a) * r0} y1={c + Math.sin(a) * r0} x2={c + Math.cos(a) * (r0 + 6 + n * step)} y2={c + Math.sin(a) * (r0 + 6 + n * step)} stroke="transparent" strokeWidth={step * 1.6} />
              </g>
            );
          }),
        )}
        <text x={c} y={c - 26} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
          {hovered ? `${String(hover!.hour).padStart(2, '0')}:00, day ${hover!.day + 1}` : 'unique visitors'}
        </text>
        <text x={c} y={c + 4} textAnchor="middle" fontSize={26} fontWeight={760} fill="var(--ink)" className="num" style={{ fontStretch: '115%' }}>
          {num(hovered ? hovered.firstEntries : data.uniqueVisitors)}
        </text>
        <text x={c} y={c + 24} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
          {hovered ? `first entries, ${num(hovered.admissions)} scans` : `${num(data.bothDays)} came both days`}
        </text>
      </svg>
      <div className="min-w-[13rem] space-y-3 text-[0.85rem]">
        {days.map((d, i) => (
          <div key={d.date}>
            <div className="flex items-center gap-2 font-semibold text-ink">
              <span className="inline-block size-2.5 rounded-full" style={{ background: COLORS[i] }} />
              Day {i + 1}, {dateLabel(d.date)}
            </div>
            <div className="num mt-0.5 pl-[18px] text-ink-2">
              {num(d.uniqueVisitors)} visitors{i > 0 ? `, ${num(d.newVisitors)} new` : ''}
              <br />
              peak {d.peakHour != null ? `${String(d.peakHour).padStart(2, '0')}:00` : '–'} with {num(d.peakFirstEntries)} first entries
              <br />
              manual scans {pct(d.manualShare)}
            </div>
          </div>
        ))}
        <p className="text-[0.75rem] text-ink-3">One dot = {DOT} first entries. Hover a column for the hour.</p>
        {days.every((d) => totalByHour(0) === 0 && d.uniqueVisitors === 0) ? <p className="text-ink-3">No admissions yet at this date.</p> : null}
      </div>
    </div>
  );
}
