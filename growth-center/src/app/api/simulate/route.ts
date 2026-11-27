import { body, ctx, handle } from '@/server/api';
import { computeSnapshot, latestDataDate } from '@/server/engine/snapshot';
import { simulateReallocation, type Move } from '@/server/engine/simulate';
import { isIsoDate } from '@/server/engine/time';

export const POST = handle(async (req: Request) => {
  const { ds } = await ctx();
  const b = await body<{ asOf?: string; moves?: Move[] }>(req);
  const asOf = b.asOf && isIsoDate(b.asOf) ? b.asOf : latestDataDate(ds);
  return simulateReallocation(computeSnapshot(ds, asOf), Array.isArray(b.moves) ? b.moves : [], ds.settings);
});
