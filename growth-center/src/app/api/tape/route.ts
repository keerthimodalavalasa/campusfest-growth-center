import { ctx, handle } from '@/server/api';
import { latestDataDate } from '@/server/engine/snapshot';
import { computeDaily } from '@/server/engine/timeseries';
import { istDate } from '@/server/engine/time';

/** Lightweight series for the global time-travel tape: new registrations, visitors and spend per day. */
export const GET = handle(async () => {
  const { ds } = await ctx();
  const end = latestDataDate(ds);
  const s = computeDaily(ds, end);
  return {
    start: ds.event.historyStart,
    end,
    eventStart: istDate(ds.event.startsAt),
    eventEnd: istDate(ds.event.endsAt),
    targetChanges: ds.targets.map((t) => ({ date: istDate(t.effectiveAt), version: t.version })),
    days: s.points.map((p) => ({ date: p.date, regs: p.newRegistrations, visitors: p.newVisitors, spend: p.spend })),
  };
});
