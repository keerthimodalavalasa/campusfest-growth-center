import { ctx, handle } from '@/server/api';
import { latestDataDate } from '@/server/engine/snapshot';
import { TABLES } from '@/server/tables';

export const GET = handle(async () => {
  const { ds } = await ctx();
  return {
    dataVersion: ds.version,
    event: ds.event,
    latestDate: latestDataDate(ds),
    campaigns: ds.campaigns.map((c) => ({ id: c.campaignId, name: c.name, channel: c.channel, ownerId: c.ownerId, status: c.status, origin: c.origin, plannedBudget: c.plannedBudget, objective: c.objective, targetAudience: c.targetAudience })),
    team: [...ds.team.values()],
    targets: ds.targets,
    settings: ds.settings,
    importStats: ds.importStats,
    tables: Object.values(TABLES).map((t) => ({ key: t.key, label: t.label, description: t.description, pk: t.pk, pkGenerated: !!t.pkGenerated, columns: t.columns, insertable: t.insertable, deletable: t.deletable })),
  };
});
