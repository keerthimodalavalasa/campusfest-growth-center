import { ctx, handle, managementSeed } from '@/server/api';
import { seedManagement } from '@/server/setup';

/**
 * Re-load the management seed (team, the five 2027 bets, the dated plan tasks).
 * Allowed in development, or with the ADMIN_TOKEN header in production. Replaces initiatives and tasks.
 */
export const POST = handle(async (req: Request) => {
  const token = process.env.ADMIN_TOKEN;
  const allowed = token ? req.headers.get('x-admin-token') === token : process.env.NODE_ENV !== 'production';
  if (!allowed) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const { db } = await ctx();
  const seed = await managementSeed();
  await seedManagement(db, seed, true);
  return { ok: true, initiatives: seed.initiatives?.length ?? 0, tasks: seed.tasks?.length ?? 0 };
});
