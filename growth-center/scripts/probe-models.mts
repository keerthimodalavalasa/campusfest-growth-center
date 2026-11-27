// One tiny request per model in the copilot chain: does the id exist, and is there quota left?
// Usage: npx tsx --env-file=.env.local scripts/probe-models.mts
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { modelChain } from '../src/server/chat/model';
for (const id of modelChain()) {
  const t0 = Date.now();
  try {
    const r = await generateText({ model: google(id), prompt: 'Reply with the single word OK.', maxRetries: 0 });
    console.log(`OK    ${id.padEnd(24)} ${Date.now() - t0}ms  "${r.text.trim().slice(0, 20)}"`);
  } catch (e) {
    const x = e as { statusCode?: number; message?: string };
    console.log(`FAIL  ${id.padEnd(24)} ${x.statusCode ?? ''} ${(x.message ?? '').split('\n')[0].slice(0, 160)}`);
  }
}
