'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Snapshot } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { dateLabel, inr, num, pct, signed } from '@/lib/format';
import { ErrorNote, Panel, Skeleton } from '@/components/ui';

type Key = 'identified' | 'registrations' | 'confirmed' | 'cancelled' | 'visitors' | 'spend';

function pick(s: Snapshot): Record<Key, number> {
  const post = s.phase === 'event' || s.phase === 'post-event';
  return {
    identified: s.totals.identified,
    registrations: s.totals.registrations,
    confirmed: s.totals.confirmed,
    cancelled: s.totals.cancelled,
    visitors: post ? s.totals.visitors : s.totals.expectedVisitors,
    spend: s.totals.spend,
  };
}

/**
 * Headline numbers at the selected date, recomputed after every save.
 * After a write it shows the change from the numbers before that write, so the effect of an edit is visible here.
 */
export function LiveTotals() {
  const { meta } = useApp();
  const ov = useApi<{ snapshot: Snapshot }>(useAsOfUrl('/api/overview'));
  const prev = useRef<{ asOf: string; version: string; vals: Record<Key, number> } | null>(null);
  const [delta, setDelta] = useState<Partial<Record<Key, number>> | null>(null);
  const s = ov.data?.snapshot ?? null;

  useEffect(() => {
    if (!s) return;
    const vals = pick(s);
    const p = prev.current;
    if (p && p.asOf === s.asOf && p.version !== s.dataVersion) {
      const d: Partial<Record<Key, number>> = {};
      for (const k of Object.keys(vals) as Key[]) if (Math.abs(vals[k] - p.vals[k]) > 1e-9) d[k] = vals[k] - p.vals[k];
      setDelta(d);
    } else if (p && p.asOf !== s.asOf) setDelta(null);
    prev.current = { asOf: s.asOf, version: s.dataVersion, vals };
  }, [s]);

  if (ov.error) return <ErrorNote onRetry={ov.refresh}>Could not load the analytics for this date: {ov.error}</ErrorNote>;
  if (!s) return <Skeleton className="h-[104px]" />;

  const post = s.phase === 'event' || s.phase === 'post-event';
  const v = pick(s);
  const changedCount = delta ? Object.keys(delta).length : 0;
  const showRate = s.totals.showRateAssumption;
  const perCampaign = Object.keys((meta?.settings.showRateByCampaign as Record<string, number> | undefined) ?? {}).length > 0;

  const aside = delta ? (
    changedCount ? (
      <span className="text-sagar">Blue figures show what the latest data change did at this date.</span>
    ) : (
      <span>The latest data change moved none of these at {dateLabel(s.asOf)}. Its row may carry a later date.</span>
    )
  ) : (
    <span>Recomputed after every save</span>
  );

  return (
    <Panel tone="well" title={`Analytics as of ${dateLabel(s.asOf, true)}`} aside={aside} className="py-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
        <Stat label="Identified people" value={num(v.identified)} d={delta?.identified} />
        <Stat label="Registered people" value={num(v.registrations)} d={delta?.registrations} />
        <Stat label="Confirmed" value={num(v.confirmed)} d={delta?.confirmed} />
        <Stat label="Cancelled" value={num(v.cancelled)} d={delta?.cancelled} />
        <Stat
          label={post ? 'Verified visitors' : 'Expected visitors'}
          value={num(v.visitors)}
          d={delta?.visitors}
          note={post ? 'unique, external, admitted + verified' : perCampaign ? `confirmed × show-rate assumption (${pct(showRate)}, with campaign overrides)` : `confirmed × ${pct(showRate)} show-rate assumption`}
        />
        <Stat label="Net spend" value={inr(v.spend)} d={delta?.spend} money />
        <Stat label="Targets in force" value={s.target?.version ?? 'None yet'} small />
      </dl>
    </Panel>
  );
}

function Stat({ label, value, d, note, money, small }: { label: string; value: ReactNode; d?: number; note?: string; money?: boolean; small?: boolean }) {
  const changed = d != null;
  return (
    <div className="min-w-0">
      <dt className="text-[0.8rem] text-ink-3">{label}</dt>
      <dd className={small ? 'mt-1 truncate text-[0.92rem] font-semibold text-ink' : 'num type-title mt-0.5 text-[1.3rem]'} style={changed ? { color: 'var(--sagar)' } : undefined} title={typeof value === 'string' ? value : undefined}>
        {value}
      </dd>
      {changed ? (
        <dd className="num text-[0.78rem] font-semibold text-sagar">{signed(d, money ? inr : num)} from latest change</dd>
      ) : note ? (
        <dd className="text-[0.75rem] leading-snug text-ink-3">{note}</dd>
      ) : null}
    </div>
  );
}
