/**
 * Best-effort, in-memory rate limiting per client IP (per server instance).
 *
 * The demo is deliberately open: reviewers edit data without logging in, and "Reset to original
 * data" restores everything. These limits make abuse expensive without getting in a reviewer's
 * way: they cap copilot calls (which spend a shared, rate-limited Gemini quota) and bulk writes.
 * On serverless each instance keeps its own counters, so this is a speed bump, not a wall.
 */
const hits = new Map<string, number[]>();

export interface Limit {
  key: string; // bucket name, e.g. 'chat'
  max: number; // requests allowed in the window
  windowMs: number;
}

export const LIMITS = {
  chat: { key: 'chat', max: 20, windowMs: 10 * 60_000 },
  bulk: { key: 'bulk', max: 6, windowMs: 10 * 60_000 }, // workbook import, reset to original
  write: { key: 'write', max: 90, windowMs: 60_000 }, // single-row edits, tasks, settings
} satisfies Record<string, Limit>;

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
}

/** Returns null when allowed, or the number of seconds to wait. */
export function rateLimit(req: Request, limit: Limit): number | null {
  const id = `${limit.key}:${clientIp(req)}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.max) {
    hits.set(id, recent);
    return Math.ceil((limit.windowMs - (now - recent[0])) / 1000);
  }
  recent.push(now);
  hits.set(id, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 10 * 60_000)) hits.delete(k); // keep memory bounded
  return null;
}

export function tooMany(retryAfter: number, what: string): Response {
  return Response.json(
    { error: `Too many ${what} from this connection. Please wait ${retryAfter} s and try again.` },
    { status: 429, headers: { 'retry-after': String(retryAfter) } },
  );
}
