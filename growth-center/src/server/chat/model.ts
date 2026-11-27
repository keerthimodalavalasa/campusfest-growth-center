import { google } from '@ai-sdk/google';
import type { LanguageModelV4, LanguageModelV4CallOptions } from '@ai-sdk/provider';

/**
 * The copilot's model: an ordered chain of Gemini models behind one LanguageModel.
 *
 * Why: Gemini free-tier quotas are per project AND per model (a daily request cap, ~20 on
 * gemini-3.8-flash at the time of writing), and busy models return 503 "high demand". Each
 * model in the chain has its own quota and its own load, so when one is exhausted or busy the
 * next answers. The chain is tried per model call (per agent step), and an exhausted model is
 * skipped until its quota resets (daily caps reset at midnight Pacific time).
 *
 * Configure with GEMINI_MODELS="a,b,c" (or a single GEMINI_MODEL, which is tried first).
 */
// Measured 2026-11-27 on the free tier: 3.8-flash is the strongest but has a ~20 request/day cap and
// frequent 503s; the flash-lite models answered in ~1.5 s; 3.6-flash took minutes under load, so it is last.
const DEFAULT_CHAIN = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
/** A model that has not started answering within this time is treated as busy and the next one is tried. */
const FIRST_RESPONSE_MS = Number(process.env.GEMINI_FIRST_RESPONSE_MS) || 25_000;

const coolUntil = new Map<string, number>();
// models that hit their daily cap; skipped until the cool-down (Pacific midnight) passes
const dailyCapped = new Set<string>();
const lastServed = { modelId: '' as string, at: 0 };

export function modelChain(): string[] {
  const list = process.env.GEMINI_MODELS
    ? process.env.GEMINI_MODELS.split(',')
    : [process.env.GEMINI_MODEL, ...DEFAULT_CHAIN].filter((x): x is string => !!x);
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}

export function copilotStatus() {
  const now = Date.now();
  return {
    chain: modelChain(),
    coolingDown: [...coolUntil.entries()].filter(([, t]) => t > now).map(([id, t]) => ({ id, until: new Date(t).toISOString() })),
    lastServed: lastServed.modelId || null,
  };
}

interface ApiErr { statusCode?: number; message?: string; responseBody?: string; lastError?: ApiErr; errors?: ApiErr[] }
const describe = (e: unknown) => {
  const x = (e ?? {}) as ApiErr;
  const inner = x.lastError ?? x.errors?.at(-1) ?? x;
  return { status: inner.statusCode ?? x.statusCode, text: `${inner.message ?? ''} ${inner.responseBody ?? ''} ${x.message ?? ''}` };
};

/** Milliseconds until the next midnight in America/Los_Angeles (when Gemini daily quotas reset). */
function msToPacificMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = ((get('hour') % 24) * 3600 + get('minute') * 60 + get('second')) * 1000;
  return Math.max(60_000, 86_400_000 - elapsed + 60_000);
}

class FirstResponseTimeout extends Error {}

type Kind = 'daily-quota' | 'rate' | 'busy' | 'thinking-unsupported' | 'other';
function classify(e: unknown): Kind {
  if (e instanceof FirstResponseTimeout) return 'busy';
  const { status, text } = describe(e);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) return /PerDay|per day/i.test(text) ? 'daily-quota' : 'rate';
  if (status === 503 || status === 500 || /high demand|overloaded|UNAVAILABLE/i.test(text)) return 'busy';
  if (/other side closed|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up|Cannot connect to API/i.test(text)) return 'busy'; // network blip
  if (status === 400 && /thinking/i.test(text)) return 'thinking-unsupported';
  if (status === 404 || /not found|is not supported/i.test(text)) return 'busy'; // model id unavailable: skip it for a while
  return 'other';
}

function withoutThinking(opts: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  const g = { ...((opts.providerOptions?.google as Record<string, unknown>) ?? {}) };
  delete g.thinkingConfig;
  return { ...opts, providerOptions: { ...opts.providerOptions, google: g as never } };
}

export function copilotModel(): LanguageModelV4 {
  const ids = modelChain();
  const models = ids.map((id) => google(id) as unknown as LanguageModelV4);


  async function run<T>(call: (m: LanguageModelV4, o: LanguageModelV4CallOptions) => PromiseLike<T>, opts: LanguageModelV4CallOptions): Promise<T> {
    let lastErr: unknown;
    // Pass 1: models that are not cooling down (if all are, try them all; a cool-down is a guess).
    // Pass 2, after a short pause: every model not out of its daily quota, because busy (503) and
    // per-minute limits usually clear within seconds.
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 1) {
        if (opts.abortSignal?.aborted) break;
        await new Promise((r) => setTimeout(r, 3_000));
      }
      const now = Date.now();
      const order = models.map((m, i) => ({ m, id: ids[i] })).filter((x) => !dailyCapped.has(x.id) || (coolUntil.get(x.id) ?? 0) <= now);
      const ready = order.filter((x) => (coolUntil.get(x.id) ?? 0) <= now);
      const queue = pass === 0 && ready.length ? ready : order;
      const out = await tryQueue(queue);
      if (out.ok) return out.value;
    }
    throw lastErr;

    async function tryQueue(queue: { m: LanguageModelV4; id: string }[]): Promise<{ ok: true; value: T } | { ok: false }> {
    for (const { m, id } of queue) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const timer = new AbortController();
        const t = setTimeout(() => timer.abort(new FirstResponseTimeout(`${id} did not respond within ${FIRST_RESPONSE_MS} ms`)), FIRST_RESPONSE_MS);
        const signal = opts.abortSignal ? AbortSignal.any([opts.abortSignal, timer.signal]) : timer.signal;
        try {
          const base = attempt === 1 ? withoutThinking(opts) : opts;
          // resolves once the model starts answering (for streams: when the response headers arrive)
          const out = await Promise.race([
            call(m, { ...base, abortSignal: signal }),
            new Promise<never>((_, reject) => timer.signal.addEventListener('abort', () => reject(timer.signal.reason), { once: true })),
          ]);
          clearTimeout(t);
          coolUntil.delete(id);
          dailyCapped.delete(id);
          lastServed.modelId = id; lastServed.at = Date.now();
          return { ok: true, value: out };
        } catch (e) {
          clearTimeout(t);
          if (opts.abortSignal?.aborted) throw e;
          lastErr = e;
          const kind = classify(e);
          if (kind === 'thinking-unsupported' && attempt === 0) continue; // retry this model without thinkingConfig
          if (kind === 'daily-quota') { coolUntil.set(id, Date.now() + msToPacificMidnight()); dailyCapped.add(id); }
          else if (kind === 'rate') coolUntil.set(id, Date.now() + 60_000);
          else if (kind === 'busy') coolUntil.set(id, Date.now() + 45_000);
          else throw e; // a real error (bad request, auth): do not mask it by switching models
          console.warn(`[copilot] ${id} unavailable (${kind}); trying the next model`);
          break;
        }
      }
    }
    return { ok: false };
    }
  }

  return {
    specificationVersion: 'v4',
    provider: 'google',
    modelId: ids.join(' > '),
    supportedUrls: models[0].supportedUrls,
    doGenerate: (opts) => run((m, o) => m.doGenerate(o), opts),
    doStream: (opts) => run((m, o) => m.doStream(o), opts),
  };
}
