import { body, ctx, handle } from '@/server/api';
import { createTask, listTasks, type TaskInput } from '@/server/mutations';

export const GET = handle(async (req: Request) => {
  const { db } = await ctx();
  const sp = new URL(req.url).searchParams;
  return {
    tasks: await listTasks(db, {
      status: sp.get('status') ?? undefined,
      owner_id: sp.get('owner') ?? undefined,
      campaign_id: sp.get('campaign') ?? undefined,
      initiative_id: sp.get('initiative') ?? undefined,
    }),
  };
});

export const POST = handle(async (req: Request) => {
  const { db } = await ctx();
  return { id: await createTask(db, await body<TaskInput>(req)) };
});
