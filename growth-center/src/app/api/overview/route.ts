import { asOfParam, ctx, handle } from '@/server/api';
import { computeSnapshot } from '@/server/engine/snapshot';
import { computeDaily, toWeekly } from '@/server/engine/timeseries';
import { addDays } from '@/server/engine/time';

export const GET = handle(async (req: Request) => {
  const { ds } = await ctx();
  const asOf = asOfParam(req, ds);
  const snapshot = computeSnapshot(ds, asOf);
  const daily = computeDaily(ds, asOf);
  // the same snapshot 7 days earlier, for "vs last week" deltas
  const prevDate = addDays(asOf, -7);
  const prev = computeSnapshot(ds, prevDate);
  const previous = {
    asOf: prevDate,
    phase: prev.phase,
    identified: prev.totals.identified,
    registrations: prev.totals.registrations,
    confirmed: prev.totals.confirmed,
    visitors: prev.totals.visitors,
    spend: prev.totals.spend,
    costPerRegistration: prev.totals.costs.perRegistration,
    costPerVisitor: prev.totals.costs.perVisitor,
    costPerExpectedVisitor: prev.totals.costs.perExpectedVisitor,
    regToVisit: prev.totals.rates.regToVisit,
    regToConfirmed: prev.totals.rates.regToConfirmed,
  };
  return { snapshot, previous, daily: daily.points, weekly: toWeekly(daily), byCampaign: daily.byCampaign };
});
