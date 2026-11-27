import { asOfParam, ctx, handle } from '@/server/api';
import { computeEventDays } from '@/server/engine/eventday';

export const GET = handle(async (req: Request) => {
  const { ds } = await ctx();
  return computeEventDays(ds, asOfParam(req, ds));
});
