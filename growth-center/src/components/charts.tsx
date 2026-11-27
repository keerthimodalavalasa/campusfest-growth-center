'use client';
import type { ReactNode } from 'react';
import { campaignColor } from '@/lib/colors';

/** Shared Recharts styling: recessive grid and axes, text in text inks. */
export const axisProps = {
  stroke: 'var(--line-2)',
  tick: { fill: 'var(--ink-3)', fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: 'var(--line-2)' },
} as const;
export const gridProps = { stroke: 'var(--line)', strokeDasharray: '0', vertical: false } as const;

interface TipRow {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number | ((d: unknown) => unknown);
  payload?: Record<string, unknown>;
}

/** Tooltip body for Recharts' <Tooltip content={...}>. */
export function ChartTip({ active, payload, label, format, labelFormat }: { active?: boolean; payload?: TipRow[]; label?: string | number; format?: (v: number, name: string) => string; labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[0.8rem] shadow-[0_6px_24px_-12px_rgba(27,36,48,0.35)]">
      {label != null ? <div className="mb-1 font-semibold text-ink">{labelFormat ? labelFormat(String(label)) : label}</div> : null}
      {payload
        .filter((p) => p.value != null)
        .map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-ink-2">
            <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="num ml-auto pl-3 font-semibold text-ink">{format ? format(Number(p.value), String(p.name)) : String(p.value)}</span>
          </div>
        ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.dashed ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} /> : <span className="inline-block size-2.5 rounded-[3px]" style={{ background: i.color }} />}
          {i.label}
        </li>
      ))}
    </ul>
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
