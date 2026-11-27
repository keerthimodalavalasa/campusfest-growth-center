import { body, ctx, handle } from '@/server/api';
import { updateSettings } from '@/server/mutations';

export const GET = handle(async () => {
  const { db } = await ctx();
  return { settings: await db.query(`select key, value, description from settings order by key`) };
});

export const PATCH = handle(async (req: Request) => {
  const { db } = await ctx();
  await updateSettings(db, await body(req));
  return { ok: true };
});
