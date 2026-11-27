import { body, ctx, handle } from '@/server/api';
import { deleteRow, updateRow } from '@/server/mutations';

type P = { params: Promise<{ table: string; id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { table, id } = await params;
  const { db } = await ctx();
  await updateRow(db, table, decodeURIComponent(id), await body(req));
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { table, id } = await params;
  const { db } = await ctx();
  await deleteRow(db, table, decodeURIComponent(id));
  return { ok: true };
});
