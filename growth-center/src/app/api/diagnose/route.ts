import { asOfParam, ctx, handle } from '@/server/api';
import { computeDiagnosis } from '@/server/engine/diagnose';

export const GET = handle(async (req: Request) => {
  const { ds } = await ctx();
  return computeDiagnosis(ds, asOfParam(req, ds));
});
