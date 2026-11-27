import { asOfParam, body, ctx, handle } from '@/server/api';
import { computeSnapshot } from '@/server/engine/snapshot';
import { computeDecisions } from '@/server/engine/decide';
import { createCampaign, type CampaignInput } from '@/server/mutations';

export const GET = handle(async (req: Request) => {
  const { ds } = await ctx();
  const asOf = asOfParam(req, ds);
  const snapshot = computeSnapshot(ds, asOf);
  const decisions = computeDecisions(ds, asOf, snapshot);
  return { asOf, phase: snapshot.phase, campaigns: snapshot.campaigns, totals: snapshot.totals, decisions };
});

export const POST = handle(async (req: Request) => {
  const { db } = await ctx();
  const id = await createCampaign(db, await body<CampaignInput>(req));
  return { id };
});
