import { asOfParam, ctx, handle } from '@/server/api';
import { computeSnapshot } from '@/server/engine/snapshot';

export const GET = handle(async (req: Request) => {
  const { db, ds } = await ctx();
  const asOf = asOfParam(req, ds);
  const snap = computeSnapshot(ds, asOf);
  const post = snap.phase === 'event' || snap.phase === 'post-event';
  const rows = await db.query<Record<string, unknown>>(
    `select i.*, i.start_date::text as start_date, i.end_date::text as end_date, tm.owner_name,
       (select count(*)::int from tasks t where t.initiative_id = i.id) as task_count,
       (select count(*)::int from tasks t where t.initiative_id = i.id and t.status = 'done') as tasks_done
     from initiatives i left join team tm on tm.owner_id = i.owner_id order by i.rank`,
  );
  const initiatives = rows.map((r) => {
    const ids = (r.campaign_ids as string[] | null) ?? [];
    const cs = snap.campaigns.filter((c) => ids.includes(c.campaignId));
    const sum = (k: 'spend' | 'registrations' | 'confirmed' | 'visitors' | 'registeredVisitors' | 'identified') => cs.reduce((s, c) => s + c[k], 0);
    const spend = sum('spend');
    const regs = sum('registrations');
    const vis = sum('visitors');
    return {
      ...r,
      evidence: ids.length
        ? {
            asOf,
            campaigns: cs.map((c) => c.name),
            spend,
            registrations: regs,
            confirmed: sum('confirmed'),
            visitors: post ? vis : null,
            costPerVisitor: post && vis ? spend / vis : null,
            showRate: post && regs ? sum('registeredVisitors') / regs : null,
            costPerRegistration: regs ? spend / regs : null,
          }
        : null,
    };
  });
  return { asOf, initiatives };
});
