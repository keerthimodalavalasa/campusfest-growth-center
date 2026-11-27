import { asOfParam, ctx, handle } from '@/server/api';
import { computeDecisions } from '@/server/engine/decide';
import { computeSnapshot } from '@/server/engine/snapshot';

export const GET = handle(async (req: Request) => {
  const { ds } = await ctx();
  const asOf = asOfParam(req, ds);
  const snapshot = computeSnapshot(ds, asOf);
  return { ...computeDecisions(ds, asOf, snapshot), campaigns: snapshot.campaigns, settings: ds.settings };
});
