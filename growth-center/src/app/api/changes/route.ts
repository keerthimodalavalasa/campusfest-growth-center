import { ctx, handle } from '@/server/api';
import { recentChanges } from '@/server/mutations';

export const GET = handle(async () => {
  const { db } = await ctx();
  return { changes: await recentChanges(db, 80) };
});
