import { body, ctx, handle } from '@/server/api';
import { insertRow, listRows } from '@/server/mutations';

type P = { params: Promise<{ table: string }> };

export const GET = handle(async (req: Request, { params }: P) => {
  const { table } = await params;
  const { db } = await ctx();
  const sp = new URL(req.url).searchParams;
  return listRows(db, table, sp.get('q'), Number(sp.get('limit') ?? 50), Number(sp.get('offset') ?? 0));
});

export const POST = handle(async (req: Request, { params }: P) => {
  const { table } = await params;
  const { db } = await ctx();
  return { id: await insertRow(db, table, await body(req)) };
});
