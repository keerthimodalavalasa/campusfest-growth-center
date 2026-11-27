import { asOfParam, body, ctx, handle } from '@/server/api';
import { computeSnapshot } from '@/server/engine/snapshot';
import { computeDiagnosis } from '@/server/engine/diagnose';
import { computeDecisions } from '@/server/engine/decide';
import { computeDaily, toWeekly } from '@/server/engine/timeseries';
import { deleteCampaign, listTasks, updateCampaign, type CampaignInput } from '@/server/mutations';

type P = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { ds, db } = await ctx();
  const asOf = asOfParam(req, ds);
  const snapshot = computeSnapshot(ds, asOf);
  const metrics = snapshot.campaigns.find((c) => c.campaignId === id) ?? null;
  const campaign = ds.campaigns.find((c) => c.campaignId === id) ?? null;
  if (!metrics && !campaign) return Response.json({ error: `Campaign ${id} not found` }, { status: 404 });
  const diagnosis = computeDiagnosis(ds, asOf, snapshot);
  const decision = computeDecisions(ds, asOf, snapshot).recommendations.find((r) => r.campaignId === id) ?? null;
  const daily = computeDaily(ds, asOf, id);
  const tasks = await listTasks(db, { campaign_id: id });
  return {
    asOf,
    phase: snapshot.phase,
    campaign,
    metrics,
    totals: snapshot.totals,
    decision,
    stageGaps: diagnosis.allStageGaps.filter((g) => g.campaignId === id),
    signals: diagnosis.signals.filter((s) => s.campaignId === id),
    daily: daily.points,
    weekly: toWeekly(daily),
    tasks,
  };
});

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { db } = await ctx();
  await updateCampaign(db, id, await body<CampaignInput>(req));
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const { db } = await ctx();
  await deleteCampaign(db, id);
  return { ok: true };
});
