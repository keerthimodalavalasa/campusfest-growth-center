import { ctx, handle } from '@/server/api';
import { importOriginal } from '@/server/setup';

export const maxDuration = 120;

export const POST = handle(async () => {
  const { db } = await ctx();
  return importOriginal(db);
});
