import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream, type UIMessage } from 'ai';
import { ctx, todayIST } from '@/server/api';
import { latestDataDate } from '@/server/engine/snapshot';
import { isIsoDate } from '@/server/engine/time';
import { buildTools } from '@/server/chat/tools';
import { buildInstructions } from '@/server/chat/instructions';
import { copilotModel, copilotStatus } from '@/server/chat/model';
import { LIMITS, rateLimit, tooMany } from '@/server/ratelimit';

export const maxDuration = 120;
const MAX_STEPS = 10;

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: 'The AI copilot is not configured: set GOOGLE_GENERATIVE_AI_API_KEY.' }, { status: 503 });
  }
  const wait = rateLimit(req, LIMITS.chat);
  if (wait != null) return tooMany(wait, 'copilot questions');
  const { messages, asOf, page }: { messages: UIMessage[]; asOf?: string; page?: string } = await req.json();
  // keep prompts bounded: the free Gemini quota is shared by every visitor
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return Response.json({ error: 'A conversation can hold at most 40 messages. Start a new chat.' }, { status: 400 });
  if (JSON.stringify(messages).length > 200_000) return Response.json({ error: 'The conversation is too long. Start a new chat.' }, { status: 413 });
  const { db, ds } = await ctx();
  const defaultAsOf = asOf && isIsoDate(asOf) ? asOf : latestDataDate(ds);
  const today = todayIST();
  const instructions = buildInstructions(ds, { asOf: defaultAsOf, today, page });
  const thinking = (process.env.GEMINI_THINKING as 'minimal' | 'low' | 'medium' | 'high' | undefined) || 'low';
  const result = streamText({
    model: copilotModel(),
    maxRetries: 0, // the model chain handles busy/quota errors by moving to the next model
    instructions,
    messages: await convertToModelMessages(messages),
    tools: buildTools({ db, defaultAsOf, today }),
    toolApproval: { create_task: 'user-approval', update_task: 'user-approval', update_campaign: 'user-approval' },
    // HMAC-sign approval requests so a client cannot forge an approval for a write it was never offered
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET || undefined,
    stopWhen: isStepCount(MAX_STEPS),
    // The last allowed step must be a written answer: a model that keeps calling tools
    // would otherwise end the turn with no text at all.
    prepareStep: ({ stepNumber }) =>
      stepNumber >= MAX_STEPS - 1
        ? { toolChoice: 'none', instructions: `${instructions}

## Tool budget used
Do not call more tools. Answer now from the tool results above, and say plainly what you could not determine.` }
        : undefined,
    temperature: 0.2,
    providerOptions: { google: { thinkingConfig: { thinkingLevel: thinking } } },
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (e) => {
        console.error('chat error', e);
        const m = e instanceof Error ? e.message : String(e);
        if (/per ?day/i.test(m)) return 'The copilot has used today’s free AI quota on every model in its chain. It resets at midnight Pacific time (about 1:30 pm IST). The dashboard, diagnosis, decisions and simulator all still work.';
        if (/quota|rate|429|RESOURCE_EXHAUSTED/i.test(m)) return 'The AI model is rate-limited right now (free tier). Please retry in a minute.';
        if (/high demand|overloaded|UNAVAILABLE|503/i.test(m)) return 'Every model in the copilot’s chain is busy right now. Please retry in a minute.';
        return 'The copilot hit an error. Please retry; if it persists, check the server logs.';
      },
    }),
  });
}

/** Which models the copilot will try, and which are cooling down after a quota or overload error. */
export function GET() {
  return Response.json(copilotStatus());
}
