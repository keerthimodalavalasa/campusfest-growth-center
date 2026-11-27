import { body, ctx, handle } from '@/server/api';
import { updateInitiative } from '@/server/mutations';

type P = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { db } = await ctx();
  await updateInitiative(db, id, await body(req));
  return { ok: true };
});
