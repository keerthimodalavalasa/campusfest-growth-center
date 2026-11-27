'use client';
import type { CSSProperties } from 'react';
import type { Diagnosis } from '@/server/engine/diagnose';
import { CampaignDot } from '@/components/charts';
import { ChartData } from '@/components/ChartData';
import { EmptyState, Table, Td, Th } from '@/components/ui';
import { tipProps } from '@/components/tooltip';
import { campaignColor } from '@/lib/colors';
import { inr, num, pct, signed } from '@/lib/format';
import { tidy } from './text';

/**
 * Change in registrations per campaign, last 7 days minus the 7 before, as diverging bars from a zero line.
 * One series (registrations, the nizami family), so one hue: direction carries the sign, the campaign dot
 * carries identity, the printed value sits at the bar end. The likely-driver read is in the tooltip and table.
 */
export function WeekDrivers({ drivers, post }: { drivers: Diagnosis['drivers']; post: boolean }) {
  const { rows, totalLast7, totalPrev7 } = drivers;
  if (!rows.length) {
    return (
      <div className="mt-3">
        <EmptyState title="No campaigns to compare yet">Week-over-week drivers appear once campaigns have registrations in the last 14 days.</EmptyState>
      </div>
    );
  }
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  const anyNeg = rows.some((r) => r.delta < 0);
  const anyPos = rows.some((r) => r.delta > 0);
  // the zero line sits where the data needs room: centred when both signs appear
  // (and leaves room past the longest bar for its printed value)
  const zero = anyNeg && anyPos ? 50 : anyNeg ? 84 : 16;
  const span = anyNeg && anyPos ? 36 : 64;
  const sorted = [...rows].sort((a, b) => a.delta - b.delta);

  return (
    <div className="mt-3">
      {post && totalLast7 === 0 ? <p className="mb-2 text-[12.5px] font-[550] text-ink-2">Registrations closed before the event, so every campaign falls to zero this week.</p> : null}
      {rows.some((r) => r.delta !== 0) ? (
        <ul className="grid gap-1" aria-label="Change in registrations by campaign, last 7 days minus the previous 7">
          {sorted.map((r, i) => {
            const w = (Math.abs(r.delta) / max) * span;
            const neg = r.delta < 0;
            return (
              <li
                key={r.campaignId}
                tabIndex={0}
                {...tipProps({
                  title: r.name,
                  rows: [
                    { label: 'Previous 7 days', value: num(r.regsPrev7) },
                    { color: 'var(--nizami-2)', label: 'Last 7 days', value: num(r.regsLast7) },
                    { label: 'Change', value: signed(r.delta), total: true },
                    ...(r.shareOfChange != null ? [{ label: 'Share of all movement', value: pct(Math.abs(r.shareOfChange)) }] : []),
                  ],
                  notes: [tidy(r.read)],
                })}
                className="grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 transition-colors duration-150 hover:bg-stone-2 max-[560px]:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)]"
              >
                <span className="min-w-0 truncate text-[13px] font-[600]">
                  <CampaignDot id={r.campaignId}>
                    <span className="truncate">{r.name}</span>
                  </CampaignDot>
                </span>
                <span className="relative h-6">
                  <i aria-hidden className="absolute -inset-y-1 block w-px bg-ink" style={{ left: `${zero}%` }} />
                  {r.delta !== 0 ? (
                    <i
                      aria-hidden
                      className="anim-grow-x absolute inset-y-[5px] block bg-nizami"
                      style={{
                        left: neg ? `${zero - w}%` : `${zero}%`,
                        width: `${w}%`,
                        borderRadius: neg ? '4px 0 0 4px' : '0 4px 4px 0',
                        transformOrigin: neg ? 'right' : 'left',
                        '--d': `${240 + i * 40}ms`,
                      } as CSSProperties}
                    />
                  ) : null}
                  <span
                    className="tab absolute top-1/2 -translate-y-1/2 text-[12.5px] font-[700] whitespace-nowrap"
                    style={neg ? { right: `calc(${100 - (zero - w)}% + 6px)` } : { left: `calc(${zero + w}% + 6px)` }}
                  >
                    {signed(r.delta)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-[12px] bg-stone-2 px-3.5 py-3 text-[13px] text-ink-2">
          No campaign changed: {totalLast7 === 0 && totalPrev7 === 0 ? 'there were no registrations in either week.' : 'each one registered the same number of people in both weeks.'} Move the as-of date to compare weeks with activity.
        </p>
      )}
      <ChartData>
        <Table>
          <thead>
            <tr>
              <Th>Campaign and likely driver</Th>
              <Th align="right">Prev 7</Th>
              <Th align="right">Last 7</Th>
              <Th align="right">Change</Th>
              <Th align="right">Identified</Th>
              <Th align="right">Net spend</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaignId} className="align-top">
                <Td className="min-w-[16rem]">
                  <span className="font-[600]">
                    <i aria-hidden className="mr-1.5 inline-block size-2.5 rounded-[3px] align-[-1px]" style={{ background: campaignColor(r.campaignId) }} />
                    {r.name}
                  </span>
                  <div className="mt-0.5 leading-snug text-ink-2">{tidy(r.read)}</div>
                </Td>
                <Td align="right">{num(r.regsPrev7)}</Td>
                <Td align="right">{num(r.regsLast7)}</Td>
                <Td align="right" className="font-[650]">
                  {signed(r.delta)}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {num(r.identPrev7)} to {num(r.identLast7)}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {inr(r.spendPrev7)} to {inr(r.spendLast7)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ChartData>
    </div>
  );
}
