import { body, ctx, handle } from '@/server/api';
import { deleteTask, updateTask, type TaskInput } from '@/server/mutations';

type P = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { db } = await ctx();
  await updateTask(db, Number(id), await body<TaskInput>(req));
  return { ok: true };
});

export const DELETE = handle(async (_req: Request, { params }: P) => {
  const { id } = await params;
  const { db } = await ctx();
  await deleteTask(db, Number(id));
  return { ok: true };
});
