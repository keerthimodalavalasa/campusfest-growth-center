'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ClipboardListDuotone, IndianRupeeDuotone, UserPlusDuotone, UsersDuotone } from 'runeicons-react';
import type { Snapshot } from '@/server/engine/snapshot';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { dateLabel, inr, inrShort, num, pct } from '@/lib/format';
import { Delta, ErrorNote, Skeleton } from '@/components/ui';
import { MetricTile } from '@/components/tiles';
import { CountUp, Ring } from '@/components/viz';

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

const share = (x: number, goal: number | null | undefined) => (goal ? x / goal : NaN);

/**
 * Headline numbers at the selected date as the page's header row, recomputed after every save. After a write,
 * each tile's footer shows what that write changed at this date, so the effect of an edit is visible here.
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
  if (!s) return <TotalsSkeleton />;

  const post = s.phase === 'event' || s.phase === 'post-event';
  const v = pick(s);
  const tg = s.target;
  const changedCount = delta ? Object.keys(delta).length : 0;
  const showRate = s.totals.showRateAssumption;
  const perCampaign = Object.keys((meta?.settings.showRateByCampaign as Record<string, number> | undefined) ?? {}).length > 0;

  /** The tile footer: what the latest save did here, or the tile's standing note. */
  const foot = (keys: Key[], format: (n: number) => string, note: ReactNode) => {
    const hit = keys.find((k) => delta?.[k] != null);
    if (!hit) return note;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5">
        <Delta now={v[hit]} prev={v[hit] - delta![hit]!} format={format} label="from the latest change" />
        <span>from the latest change</span>
      </span>
    );
  };
  const ringLabel = (f: number, what: string) => (Number.isFinite(f) ? `${pct(f, 0)} of ${what}` : `No ${what} set`);

  return (
    <>
      <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1" aria-live="polite">
        <MetricTile
          field="lac"
          icon={UsersDuotone}
          ia="#fff"
          ib="var(--lac-pale)"
          title={post ? 'Verified visitors' : 'Expected visitors'}
          label={post ? 'Verified visitors' : 'Expected visitors'}
          delay={0}
          className="min-h-[180px]"
          viz={<Ring value={share(v.visitors, tg?.visitorsGoal)} track="var(--lac-track)" arc="#fff" ink="#fff" label={ringLabel(share(v.visitors, tg?.visitorsGoal), 'goal')} />}
          value={<CountUp value={v.visitors} format={num} />}
          sub={tg ? `of ${num(tg.visitorsGoal)} goal` : 'no goal set'}
          foot={foot(['visitors'], num, <span className="text-k2">{post ? 'Unique, external, admitted and verified' : perCampaign ? 'Confirmed × show rate, with overrides' : `Confirmed × ${pct(showRate, 0)} show rate, assumed`}</span>)}
        />
        <MetricTile
          icon={UserPlusDuotone}
          ia="var(--pista-track)"
          ib="var(--pista)"
          title="Identified people"
          label="Identified people"
          delay={40}
          className="min-h-[180px]"
          viz={<Ring value={share(v.identified, tg?.identifiedGoal)} track="var(--stone-2)" arc="var(--pista-track)" ink="var(--ink)" label={ringLabel(share(v.identified, tg?.identifiedGoal), 'goal')} />}
          value={<CountUp value={v.identified} format={num} />}
          sub={tg ? `of ${num(tg.identifiedGoal)} goal` : 'no goal set'}
          foot={foot(['identified'], num, <span className="text-ink-2">External people only</span>)}
        />
        <MetricTile
          icon={ClipboardListDuotone}
          ia="var(--nizami)"
          ib="var(--nizami-2)"
          title="Registered people"
          label="Registered people"
          delay={80}
          className="min-h-[180px]"
          viz={<Ring value={share(v.registrations, tg?.registrationGoal)} track="var(--stone-2)" arc="var(--nizami)" ink="var(--ink)" label={ringLabel(share(v.registrations, tg?.registrationGoal), 'goal')} />}
          value={<CountUp value={v.registrations} format={num} />}
          sub={tg ? `of ${num(tg.registrationGoal)} goal` : 'no goal set'}
          foot={foot(
            ['registrations', 'confirmed', 'cancelled'],
            num,
            <span className="tab text-ink-2">
              {num(v.confirmed)} confirmed, {num(v.cancelled)} cancelled
            </span>,
          )}
        />
        <MetricTile
          icon={IndianRupeeDuotone}
          ia="var(--haldi-track)"
          ib="var(--haldi)"
          title="Net spend"
          label="Net spend"
          delay={120}
          className="min-h-[180px]"
          viz={<Ring value={share(v.spend, tg?.budget)} track="var(--stone-2)" arc="var(--haldi)" ink="var(--ink)" label={ringLabel(share(v.spend, tg?.budget), 'budget')} />}
          value={<CountUp value={v.spend} format={inrShort} />}
          sub={tg ? `of ${inrShort(tg.budget)} budget` : 'no budget set'}
          foot={foot(['spend'], inr, <span className="truncate text-ink-2">Targets: {tg?.version ?? 'none yet'}</span>)}
        />
      </div>
      {delta && changedCount === 0 ? <p className="mt-2 px-1 text-[12.5px] font-[550] text-ink-2">The latest data change moved none of these at {dateLabel(s.asOf)}. Its row may carry a later date.</p> : null}
    </>
  );
}

function TotalsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-3 max-[1200px]:grid-cols-2 max-[560px]:grid-cols-1" aria-busy="true" aria-label="Loading the totals">
      {[0, 1, 2, 3].map((k) => (
        <Skeleton key={k} className="h-[180px] rounded-tile-s bg-stone" />
      ))}
    </div>
  );
}
