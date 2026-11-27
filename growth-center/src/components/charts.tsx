'use client';
import type { ReactNode } from 'react';
import { campaignColor } from '@/lib/colors';
import { TipBody } from '@/components/tooltip';

/** Shared Recharts styling: recessive stone grid and axes, tabular text in the text inks. */
export const axisProps = {
  stroke: 'var(--stone-3)',
  tick: { fill: 'var(--ink-2)', fontSize: 11.5, fontWeight: 550, style: { fontVariantNumeric: 'tabular-nums' } },
  tickLine: false,
  axisLine: { stroke: 'var(--stone-3)' },
} as const;
export const gridProps = { stroke: 'var(--stone-2)', strokeDasharray: '0', vertical: false } as const;
/** Hairline crosshair for line and area charts. */
export const cursorProps = { stroke: 'var(--ink)', strokeWidth: 1 } as const;
/** Column hover wash for bar charts. */
export const barCursorProps = { fill: 'var(--stone-2)', radius: 6 } as const;

interface TipRow {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number | ((d: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/** Dark tooltip body for Recharts' <Tooltip content={...}>: bidri with a hairline, tabular values. */
export function ChartTip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TipRow[]; label?: string | number; format?: (v: number, name: string) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] max-w-[280px] rounded-[12px] bg-bidri px-3 py-2.5 text-[12.5px] text-white shadow-[inset_0_0_0_1px_var(--bidri-3),0_10px_30px_rgba(26,29,35,0.22)]">
      <TipBody
        title={label != null ? (labelFormat ? labelFormat(String(label)) : label) : undefined}
        rows={payload
          .filter((p) => p.value != null)
          .map((p) => ({ color: p.color, label: p.name, value: format ? format(Number(p.value), String(p.name)) : String(p.value) }))}
      />
    </div>
  );
}

/** Chart keys: line or square swatches in the series colour, labels in text ink. */
export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean; dotted?: boolean; line?: boolean; thin?: boolean; bar?: boolean }[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] font-[550] text-ink-2 ${className ?? ''}`}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5 whitespace-nowrap">
          <Swatch color={i.color} kind={i.bar ? 'bar' : i.dotted ? 'dotted' : i.dashed ? 'dashed' : i.line ? 'line' : 'square'} thin={i.thin} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function Swatch({ color, kind = 'square', thin }: { color: string; kind?: 'square' | 'line' | 'dashed' | 'dotted' | 'bar'; thin?: boolean }) {
  if (kind === 'square') return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
  if (kind === 'bar') return <span aria-hidden className="inline-block h-3 w-[3px] shrink-0 rounded-[1px]" style={{ background: color }} />;
  return (
    <span
      aria-hidden
      className="inline-block h-0 w-3.5 shrink-0 rounded-[2px]"
      style={{ borderTop: `${kind === 'dotted' ? 3 : thin ? 1.5 : 2.5}px ${kind === 'dotted' ? 'dotted' : kind === 'dashed' ? 'dashed' : 'solid'} ${color}` }}
    />
  );
}

export function CampaignDot({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block size-2.5 shrink-0 rounded-[3px]" style={{ background: campaignColor(id) }} aria-hidden />
      {children}
    </span>
  );
}
