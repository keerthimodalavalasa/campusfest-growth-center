'use client';
import { useEffect, useId, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/components/ui';
import { tipProps, type TipContent } from '@/components/tooltip';

/*
  Hand-written SVG marks for the Bento system (Recharts is kept for the pace line only).
  Every mark animates once, on mount, as part of the page's orchestrated load; scrubbing the as-of tape
  re-renders values without replaying motion. Reduced motion keeps short fades only (see globals.css).
*/

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const v = (o: Record<string, string | number>) => o as CSSProperties;

/* ------------------------------------------------------------------ motion helpers */

const RM = '(prefers-reduced-motion: reduce)';
function subscribeRM(cb: () => void) {
  const m = window.matchMedia(RM);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
}
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => false);
}

/** Numerals count up once on mount (ease-out cubic, ~700 ms). Later value changes render immediately. */
export function CountUp({ value, format, duration = 700, delay = 0 }: { value: number; format: (n: number) => string; duration?: number; delay?: number }) {
  const [p, setP] = useState(1);
  useEffect(() => {
    if (window.matchMedia(RM).matches) return;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t;
      const k = Math.min(1, Math.max(0, (t - t0 - delay) / duration));
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [delay, duration]);
  return <>{format(value * p)}</>;
}

/** Width of an element, tracked with a ResizeObserver (callback ref + state, no refs read in render). */
export function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w] as const;
}

/* ------------------------------------------------------------------ ring */

/**
 * Attainment ring. `value` is the share of goal (may exceed 1: a dot marks the overflow);
 * `ghost` is the projected share, drawn as a lighter arc beyond the actual one.
 */
export function Ring({
  value,
  ghost,
  track,
  arc,
  ink,
  ghostColor,
  label,
  className,
  delay = 160,
}: {
  value: number;
  ghost?: number | null;
  track: string;
  arc: string;
  ink: string;
  ghostColor?: string;
  label: string;
  className?: string;
  delay?: number;
}) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const f = clamp01(value);
  const g = ghost != null ? clamp01(ghost) : null;
  return (
    <svg viewBox="0 0 76 76" role="img" aria-label={label} className={className}>
      <circle cx="38" cy="38" r={r} fill="none" stroke={track} strokeWidth="8" />
      {g != null && g > f ? (
        <circle className="anim-fade" style={v({ '--d': '700ms' })} cx="38" cy="38" r={r} fill="none" stroke={ghostColor ?? track} strokeWidth="8" transform="rotate(-90 38 38)" strokeDasharray={`0 ${c * f} ${c * (g - f)} ${c}`} />
      ) : null}
      {f > 0 ? (
        <circle
          className="anim-arc"
          style={v({ '--len': c, '--d': `${delay}ms` })}
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={arc}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform="rotate(-90 38 38)"
        />
      ) : null}
      {value > 1 ? <circle cx="38" cy="7" r="5.5" fill={arc} stroke={track} strokeWidth="2" /> : null}
      <text x="38" y="38" textAnchor="middle" dominantBaseline="central" fill={ink} style={{ fontStretch: '75%', fontWeight: 780, fontSize: 19 }}>
        {Number.isFinite(value) ? `${Math.round(value * 100)}%` : '–'}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ gauge */

/** Half-ring gauge for a rate. `assumed` hatches the arc: assumptions look different from observations. */
export function Gauge({ value, assumed, color = 'var(--lac)', hatch = 'var(--lac-soft)', track = 'var(--stone-2)', className, label }: { value: number; assumed?: boolean; color?: string; hatch?: string; track?: string; className?: string; label?: string }) {
  const pid = `hatch${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const r = 38;
  const cx = 46;
  const cy = 48;
  const len = Math.PI * r;
  const f = clamp01(value);
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg viewBox="0 0 92 54" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <pattern id={pid} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={hatch} />
          <rect width="3" height="6" fill={color} />
        </pattern>
      </defs>
      <path d={path} fill="none" stroke={track} strokeWidth="10" strokeLinecap="round" />
      {f > 0 ? <path className="anim-arc" style={v({ '--len': len })} d={path} fill="none" stroke={assumed ? `url(#${pid})` : color} strokeWidth="10" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - f)} /> : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ waffle */

/**
 * Waffle of unit dots (one dot = `unit` people): solid = counted, ringed = projected, dashed hollow = short of goal.
 * Drawn for a coloured field; pass the inks for the field.
 */
export function Waffle({ total, filled, projected = 0, cols, ink = '#fff', hollow = 'var(--lac-pale)', className }: { total: number; filled: number; projected?: number; cols: number; ink?: string; hollow?: string; className?: string }) {
  const rows = Math.max(1, Math.ceil(total / cols));
  const cell = 20;
  const rr = 6.6;
  const dots: ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const x = (i % cols) * cell + cell / 2;
    const y = Math.floor(i / cols) * cell + cell / 2;
    const d = v({ '--d': `${Math.round((i / total) * 520)}ms` });
    if (i < filled) dots.push(<circle key={i} className="anim-fade" style={d} cx={x} cy={y} r={rr + 0.6} fill={ink} />);
    else if (i < filled + projected)
      dots.push(
        <g key={i} className="anim-fade" style={d}>
          <circle cx={x} cy={y} r={rr} fill="none" stroke={ink} strokeWidth="1.6" />
          <circle cx={x} cy={y} r="3" fill={ink} />
        </g>,
      );
    else dots.push(<circle key={i} className="anim-fade" style={d} cx={x} cy={y} r={rr} fill="none" stroke={hollow} strokeWidth="1.6" strokeDasharray="2.4 2.6" />);
  }
  return (
    <svg viewBox={`0 0 ${cols * cell} ${rows * cell}`} aria-hidden className={cx('block h-auto w-full', className)}>
      {dots}
    </svg>
  );
}

/** Legend glyphs that match the waffle's three dot kinds. */
export function WaffleKey({ kind, ink = '#fff', hollow = 'var(--lac-pale)' }: { kind: 'filled' | 'projected' | 'hollow'; ink?: string; hollow?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="size-3 shrink-0">
      {kind === 'filled' ? <circle cx="6" cy="6" r="5.5" fill={ink} /> : null}
      {kind === 'projected' ? (
        <>
          <circle cx="6" cy="6" r="5" fill="none" stroke={ink} strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2.2" fill={ink} />
        </>
      ) : null}
      {kind === 'hollow' ? <circle cx="6" cy="6" r="5" fill="none" stroke={hollow} strokeWidth="1.5" strokeDasharray="2 2" /> : null}
    </svg>
  );
}

/* ------------------------------------------------------------------ stepped funnel */

export type StepField = 'pista' | 'nizami' | 'nizami2' | 'lac';
const STEP_FIELD: Record<StepField, { bg: string; fg: string; k2: string; hatch: string }> = {
  pista: { bg: 'var(--pista)', fg: 'var(--ink)', k2: 'var(--pista-ink)', hatch: 'var(--pista-track)' },
  nizami: { bg: 'var(--nizami)', fg: '#fff', k2: 'var(--nizami-soft)', hatch: 'var(--nizami-track)' },
  nizami2: { bg: 'var(--nizami-2)', fg: 'var(--ink)', k2: '#1d2e5e', hatch: 'var(--nizami-track)' },
  lac: { bg: 'var(--lac)', fg: '#fff', k2: 'var(--lac-soft)', hatch: 'var(--lac-track)' },
};

export interface FunnelStage {
  key: string;
  label: string;
  sub: ReactNode;
  value: number;
  field: StepField;
  /** an assumption, not an observation: hatched */
  assumed?: boolean;
  /** a sandstone cap inside the top of the block (e.g. walk-ins included in the count) */
  cap?: { value: number; tip: TipContent; label: string };
}
export interface FunnelLeak {
  value: number;
  label: string;
  tip: TipContent;
}

/**
 * Stepped funnel: solid family blocks on limestone, each step's loss shown as the hatched ghost of the step before,
 * with a pill naming how many people leaked. Heights are proportional to the first stage.
 */
export function StepFunnel({ stages, leaks, format }: { stages: FunnelStage[]; leaks: FunnelLeak[]; format: (n: number) => string }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="grid flex-1 grid-cols-4 gap-2.5 pt-[18px] max-[720px]:gap-1.5" role="list">
      {stages.map((s, i) => {
        const f = STEP_FIELD[s.field];
        const prev = i ? stages[i - 1].value : s.value;
        const hb = (Math.max(0, s.value) / max) * 100;
        const hg = (Math.max(0, prev) / max) * 100;
        const leak = i ? leaks[i - 1] : null;
        const low = hb < 17; // too short to hold its numeral: print it above the block
        const capH = s.cap ? (Math.max(0, s.cap.value) / max) * 100 : 0;
        const delay = 80 + i * 70;
        return (
          <div key={s.key} role="listitem" className="flex min-w-0 flex-col" aria-label={`${s.label}: ${format(s.value)}`}>
            <div className="relative min-h-[200px] flex-1 max-[720px]:h-[180px] max-[720px]:min-h-0 max-[720px]:flex-none">
              {i ? (
                <div
                  aria-hidden
                  className="anim-grow-y absolute inset-x-0 bottom-0 rounded-t-[4px] shadow-[inset_0_0_0_1.5px_var(--stone-2)]"
                  style={{ height: `${hg}%`, background: 'repeating-linear-gradient(135deg, var(--stone-2) 0 6px, transparent 6px 11px)', ...v({ '--d': `${delay}ms` }) }}
                />
              ) : null}
              <div
                className={cx('anim-grow-y absolute inset-x-0 bottom-0 flex flex-col rounded-[4px]', !low && 'px-3 py-2.5 max-[720px]:px-[7px] max-[720px]:py-2', hb <= 0 && 'hidden')}
                style={{
                  height: `${hb}%`,
                  background: s.assumed ? `repeating-linear-gradient(135deg, ${f.bg} 0 7px, ${f.hatch} 7px 12px)` : f.bg,
                  color: f.fg,
                  ...v({ '--d': `${delay}ms` }),
                }}
              >
                {!low ? <span className="num text-[34px] leading-[0.9] max-[720px]:text-[22px]">{format(s.value)}</span> : null}
              </div>
              {low ? (
                <span className="num absolute inset-x-0 px-1 text-[30px] leading-[0.9] text-ink max-[720px]:text-[20px]" style={{ bottom: `calc(${hb}% + 8px)` }}>
                  {format(s.value)}
                </span>
              ) : null}
              {s.cap && capH > 0 ? (
                <div
                  tabIndex={0}
                  aria-label={s.cap.label}
                  {...tipProps(s.cap.tip)}
                  className="anim-grow-y absolute inset-x-0 rounded-t-[4px] bg-sand"
                  style={{ height: `${capH}%`, bottom: `${hb - capH}%`, ...v({ '--d': '400ms' }) }}
                />
              ) : null}
              {leak && Math.round(leak.value) > 0 ? (
                <span
                  tabIndex={0}
                  aria-label={`${format(leak.value)} ${leak.label}`}
                  {...tipProps(leak.tip)}
                  className="anim-fade tab absolute left-1/2 z-[2] inline-flex h-[26px] -translate-x-1/2 translate-y-1/2 cursor-default items-center rounded-full bg-ground px-2.5 text-[12.5px] font-[700] whitespace-nowrap text-ink shadow-[0_0_0_1.5px_var(--stone-3)] max-[720px]:h-6 max-[720px]:px-[7px] max-[720px]:text-[11.5px]"
                  style={{ bottom: low ? `max(${(hg + hb) / 2}%, calc(${hb}% + 52px))` : `${(hg + hb) / 2}%`, ...v({ '--d': `${420 + i * 60}ms` }) }}
                >
                  −{format(leak.value)}
                </span>
              ) : null}
            </div>
            <div className="mt-2.5 text-[13px] leading-[1.3] font-[650] max-[720px]:text-[12px]">
              {s.label}
              <small className="flex items-center gap-1.5 text-[12.5px] font-[550] text-ink-2 max-[720px]:text-[11.5px]">{s.sub}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ sparkline and mini bars */

/** Inline trend line (optionally with a faint area), for small multiples and table cells. */
export function Sparkline({ values, color = 'var(--nizami)', width = 120, height = 32, area = false, strokeWidth = 2, label }: { values: number[]; color?: string; width?: number; height?: number; area?: boolean; strokeWidth?: number; label?: string }) {
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = strokeWidth;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2));
  const y = (n: number) => (hi === lo ? height / 2 : pad + (1 - (n - lo) / (hi - lo)) * (height - pad * 2));
  const d = values.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join('');
  const last = values.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block overflow-visible">
      {area ? <path d={`${d} L${x(last)} ${height} L${x(0)} ${height}Z`} fill={color} opacity={0.12} /> : null}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={strokeWidth + 1} fill={color} />
    </svg>
  );
}

/** Tiny column chart: rounded data ends anchored to the baseline, 2px gaps. */
export function MiniBars({ values, color = 'var(--nizami)', width = 120, height = 32, gap = 2, highlightLast = false, label }: { values: number[]; color?: string; width?: number; height?: number; gap?: number; highlightLast?: boolean; label?: string }) {
  if (!values.length) return null;
  const hi = Math.max(1, ...values);
  const bw = Math.max(1, (width - gap * (values.length - 1)) / values.length);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="block">
      {values.map((n, i) => {
        const h = Math.max(n > 0 ? 2 : 0, (n / hi) * height);
        return <rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={color} opacity={highlightLast && i !== values.length - 1 ? 0.45 : 1} />;
      })}
    </svg>
  );
}

/** Small progress ring for inline use (e.g. "78.6% came"): 4px stroke, no label. */
export function MicroRing({ value, color, track = 'var(--stone-2)', size = 22 }: { value: number; color: string; track?: string; size?: number }) {
  const r = 9;
  const len = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 22 22" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx="11" cy="11" r={r} fill="none" stroke={track} strokeWidth="4" />
      <circle cx="11" cy="11" r={r} fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${len * clamp01(value)} ${len}`} transform="rotate(-90 11 11)" />
    </svg>
  );
}
