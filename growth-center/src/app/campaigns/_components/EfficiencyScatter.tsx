'use client';
import { CartesianGrid, DefaultZIndexes, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ZIndexLayer, usePlotArea, useXAxisScale, useYAxisScale } from 'recharts';
import { axisProps, ChartTip, cursorProps } from '@/components/charts';
import { campaignColor } from '@/lib/colors';
import { inr, inrShort, num } from '@/lib/format';
import { CHART_RESIZE_DEBOUNCE, niceTicks } from './shared';

export interface ScatterPoint {
  id: string;
  name: string;
  /** cost per (expected) visitor, INR */
  x: number;
  /** (expected) visitors */
  y: number;
  spend: number;
}

const DOT_R = 6;
const FONT = 12;
const CHAR_W = 6.7; // Mona Sans at 12px, generous so boxes never undercount
const LABEL_H = 14;

/** 1-2-5 ticks for a log axis between lo and hi. */
function logTicks(lo: number, hi: number) {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) {
    const v = m * 10 ** e;
    if (v >= lo && v <= hi) out.push(v);
  }
  return out;
}

export function EfficiencyScatter({ points: all, scaleAt, stopAt, post }: { points: ScatterPoint[]; scaleAt: number | null; stopAt: number | null; post: boolean }) {
  const xName = post ? 'Cost per visitor' : 'Cost per expected visitor';
  const yName = post ? 'Visitors' : 'Expected visitors';
  // When costs span more than 12x (e.g. after a data edit adds a huge spend), a linear axis crushes every
  // other campaign against zero, so switch to a log axis. Campaigns at or below zero net spend cannot sit on it.
  const positive = all.filter((p) => p.x > 0);
  const spread = positive.length > 1 ? Math.max(...positive.map((p) => p.x)) / Math.min(...positive.map((p) => p.x)) : 1;
  const log = spread > 12;
  const points = log ? positive : all;
  const offScale = log ? all.filter((p) => p.x <= 0) : [];
  const xLo = log ? Math.min(...positive.map((p) => p.x), scaleAt ?? Infinity) * 0.7 : 0;
  const xTicks = log ? logTicks(xLo, Math.max(...positive.map((p) => p.x), stopAt ?? 0) * 1.4) : niceTicks(0, Math.max(...points.map((p) => p.x), stopAt ?? 0, scaleAt ?? 0) * 1.1, 5, true);
  const yTicks = niceTicks(0, Math.max(...points.map((p) => p.y), 1) * 1.12, 5, true);
  const xMax = log ? Math.max(...positive.map((p) => p.x), stopAt ?? 0) * 1.4 : xTicks[xTicks.length - 1];
  const yMax = yTicks[yTicks.length - 1];

  return (
    <div>
      <div className="mt-2 h-[340px] max-[720px]:h-[300px]">
      {/* trailing-edge debounce: a momentary resize (window snapshots, devtools) does not re-render the chart at a throwaway size */}
      <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE}>
        <ScatterChart margin={{ top: 34, right: 16, bottom: 18, left: 4 }}>
          <CartesianGrid stroke="var(--stone-2)" strokeDasharray="0" />
          {/* the two decision zones are neutral washes; the status colour lives only on the boundary line and its labelled pill */}
          {scaleAt != null ? <ReferenceArea x1={xLo} x2={scaleAt} fill="var(--stone-2)" fillOpacity={0.75} stroke="none" ifOverflow="hidden" /> : null}
          {stopAt != null ? <ReferenceArea x1={stopAt} x2={xMax} fill="var(--stone-2)" fillOpacity={0.75} stroke="none" ifOverflow="hidden" /> : null}
          {scaleAt != null ? <ReferenceLine x={scaleAt} stroke="var(--st-scale)" strokeWidth={1.5} /> : null}
          {stopAt != null ? <ReferenceLine x={stopAt} stroke="var(--st-stop)" strokeWidth={1.5} /> : null}
          <XAxis
            type="number"
            dataKey="x"
            name={xName}
            scale={log ? 'log' : 'auto'}
            domain={[xLo, xMax]}
            allowDataOverflow
            ticks={xTicks}
            {...axisProps}
            tickFormatter={(v: number) => inrShort(v)}
            label={{ value: `${xName}${log ? ', log scale' : ''}`, position: 'insideBottom', offset: -10, fill: 'var(--ink-2)', fontSize: 12, fontWeight: 550 }}
          />
          <YAxis type="number" dataKey="y" name={yName} domain={[0, yMax]} ticks={yTicks} {...axisProps} tickFormatter={(v: number) => num(v)} width={56} label={{ value: yName, angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--ink-2)', fontSize: 12, fontWeight: 550, style: { textAnchor: 'middle' } }} />
          <ZAxis range={[DOT_R * DOT_R * 3.4, DOT_R * DOT_R * 3.4]} />
          <Tooltip
            cursor={cursorProps}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const p = (payload?.[0]?.payload ?? null) as ScatterPoint | null;
              if (!active || !p) return null;
              const color = campaignColor(p.id);
              return (
                <ChartTip
                  active
                  label={p.name}
                  payload={[
                    { name: xName, value: p.x, color },
                    { name: yName, value: p.y, color },
                    { name: 'Net spend', value: p.spend, color },
                  ]}
                  format={(v, n) => (n === yName ? num(v) : inr(v))}
                />
              );
            }}
          />
          {points.map((p) => (
            <Scatter key={p.id} name={p.name} data={[p]} fill={campaignColor(p.id)} stroke="var(--stone)" strokeWidth={2} isAnimationActive={false} />
          ))}
          <DotLabels points={points} scaleAt={scaleAt} stopAt={stopAt} />
        </ScatterChart>
      </ResponsiveContainer>
      </div>
      {log ? (
        <p className="mt-1 text-[12.5px] text-ink-2">
          Log scale: costs span {Math.round(spread)}×, so equal steps mean equal ratios.
          {offScale.length ? ` Not on this scale (net spend ≤ ₹0): ${offScale.map((p) => p.name).join(', ')}.` : ''}
        </p>
      ) : null}
    </div>
  );
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/**
 * Direct labels on every dot plus the threshold captions, placed greedily so that no label
 * covers another label, a dot or a threshold caption. Falls back to a short leader line.
 */
function DotLabels({ points, scaleAt, stopAt }: { points: ScatterPoint[]; scaleAt: number | null; stopAt: number | null }) {
  const xs = useXAxisScale();
  const ys = useYAxisScale();
  const area = usePlotArea();
  if (!xs || !ys || !area) return null;

  const px = points.map((p) => ({ p, x: xs(p.x) ?? 0, y: ys(p.y) ?? 0 }));
  const obstacles: Box[] = px.map((d) => ({ x0: d.x - DOT_R - 2, y0: d.y - DOT_R - 2, x1: d.x + DOT_R + 2, y1: d.y + DOT_R + 2 }));
  const bounds: Box = { x0: area.x, y0: area.y, x1: area.x + area.width, y1: area.y + area.height };

  // threshold captions sit just above the plot, beside their line
  // threshold captions: a status pill (glyph + word + value) above the plot, hung off its boundary line
  const captions: { text: string; glyph: string; x: number; w: number; color: string }[] = [];
  const pill = (glyph: string, text: string, at: number, side: 'end' | 'start', color: string) => {
    const w = (text.length + 2) * 6.3 + 16;
    const x = side === 'end' ? at - w + 10 : at - 10;
    captions.push({ text, glyph, x: Math.max(area.x - 8, Math.min(x, area.x + area.width - w)), w, color });
  };
  if (scaleAt != null) {
    const x = xs(scaleAt);
    if (x != null) pill('↗', `Scale ≤ ${inr(scaleAt)}`, x, 'end', 'var(--st-scale)');
  }
  if (stopAt != null) {
    const x = xs(stopAt);
    if (x != null) pill('■', `Stop ≥ ${inr(stopAt)}`, x, 'start', 'var(--st-stop)');
  }
  for (const c of captions) obstacles.push({ x0: c.x, y0: area.y - 30, x1: c.x + c.w, y1: area.y - 8 });
  // the threshold lines themselves: labels may cross them, but only when nothing better exists
  for (const v of [scaleAt, stopAt]) {
    const x = v == null ? null : xs(v);
    if (x != null) obstacles.push({ x0: x - 3, y0: area.y, x1: x + 3, y1: area.y + area.height });
  }

  // place labels for the most crowded dots first
  const crowd = (i: number) => px.reduce((s, o, j) => (j === i ? s : s + 1 / (1 + Math.hypot(o.x - px[i].x, o.y - px[i].y))), 0);
  const order = px.map((_, i) => i).sort((a, b) => crowd(b) - crowd(a));

  const placed: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; text: string; lead?: [number, number, number, number] }[] = [];
  for (const i of order) {
    const d = px[i];
    const text = d.p.name;
    const w = text.length * CHAR_W;
    const cands: { dx: number; dy: number; anchor: 'start' | 'middle' | 'end'; far: boolean }[] = [];
    for (const r of [1, 2.6]) {
      const far = r > 1;
      const o = (DOT_R + 4) * r;
      cands.push(
        { dx: o, dy: 4, anchor: 'start', far },
        { dx: -o, dy: 4, anchor: 'end', far },
        { dx: 0, dy: -o - 2, anchor: 'middle', far },
        { dx: 0, dy: o + 10, anchor: 'middle', far },
        { dx: o * 0.8, dy: -o * 0.8, anchor: 'start', far },
        { dx: o * 0.8, dy: o * 0.8 + 8, anchor: 'start', far },
        { dx: -o * 0.8, dy: -o * 0.8, anchor: 'end', far },
        { dx: -o * 0.8, dy: o * 0.8 + 8, anchor: 'end', far },
      );
    }
    let best: { c: (typeof cands)[number]; box: Box; cost: number } | null = null;
    for (const [k, c] of cands.entries()) {
      const tx = d.x + c.dx;
      const ty = d.y + c.dy;
      const x0 = c.anchor === 'start' ? tx : c.anchor === 'end' ? tx - w : tx - w / 2;
      const box: Box = { x0: x0 - 2, y0: ty - LABEL_H + 3, x1: x0 + w + 2, y1: ty + 3 };
      let cost = obstacles.reduce((s, o) => s + overlap(box, o), 0);
      const outside = (box.x0 < bounds.x0 ? bounds.x0 - box.x0 : 0) + (box.x1 > bounds.x1 ? box.x1 - bounds.x1 : 0) + (box.y0 < bounds.y0 ? bounds.y0 - box.y0 : 0) + (box.y1 > bounds.y1 ? box.y1 - bounds.y1 : 0);
      cost += outside * 40 + k * 0.01; // prefer earlier (closer, right-hand) candidates on ties
      if (!best || cost < best.cost) best = { c, box, cost };
      if (cost < 1) break;
    }
    if (!best) continue;
    obstacles.push(best.box);
    const tx = d.x + best.c.dx;
    const ty = d.y + best.c.dy;
    let lead: [number, number, number, number] | undefined;
    if (best.c.far) {
      // from the dot's edge to the nearest point of the label box
      const ex = Math.max(best.box.x0, Math.min(d.x, best.box.x1));
      const ey = Math.max(best.box.y0, Math.min(d.y, best.box.y1));
      const len = Math.hypot(ex - d.x, ey - d.y) || 1;
      lead = [d.x + ((ex - d.x) / len) * (DOT_R + 1), d.y + ((ey - d.y) / len) * (DOT_R + 1), ex, ey];
    }
    placed.push({ x: tx, y: ty, anchor: best.c.anchor, text, lead });
  }

  return (
    // labels render above the dots and the shaded bands
    <ZIndexLayer zIndex={DefaultZIndexes.label}>
      <g aria-hidden>
        {captions.map((c) => (
          <g key={c.text}>
            <rect x={c.x} y={area.y - 30} width={c.w} height={22} rx={11} fill={c.color} />
            <text x={c.x + 9} y={area.y - 15} fontSize={12} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tspan fontSize={11}>{c.glyph}</tspan> {c.text}
            </text>
          </g>
        ))}
        {placed.map((l) => (l.lead ? <line key={`${l.text}-lead`} x1={l.lead[0]} y1={l.lead[1]} x2={l.lead[2]} y2={l.lead[3]} stroke="var(--ink-2)" strokeWidth={0.75} /> : null))}
        {placed.map((l) => (
          <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} fontSize={FONT} fontWeight={600} fill="var(--ink)" stroke="var(--stone)" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke">
            {l.text}
          </text>
        ))}
      </g>
    </ZIndexLayer>
  );
}
