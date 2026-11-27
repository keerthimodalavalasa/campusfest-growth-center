import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { connection } from 'next/server';
import { getDb, type Db } from './db';
import { getDataset } from './dataset';
import { latestDataDate } from './engine/snapshot';
import { isIsoDate } from './engine/time';
import type { Dataset } from './engine/types';
import { ValidationError } from './mutations';
import { ensureSchema, importOriginal, seedManagement, seedSettings, type ManagementSeed } from './setup';

const g = globalThis as unknown as { __gcReady?: Promise<void> };

/** Idempotent bootstrap: create schema and load the original dataset + management seed if the DB is empty. */
export function ensureReady(): Promise<void> {
  if (!g.__gcReady) {
    g.__gcReady = (async () => {
      const db = await getDb();
      const exists = await db.query<{ t: string | null }>(`select to_regclass('public.meta')::text as t`);
      if (!exists[0]?.t) await ensureSchema(db);
      const ev = await db.query(`select 1 from event_info limit 1`).catch(() => []);
      if (!ev.length) {
        await ensureSchema(db);
        await seedSettings(db);
        await importOriginal(db);
        await seedManagement(db, await managementSeed());
      }
    })().catch((e) => {
      g.__gcReady = undefined;
      throw e;
    });
  }
  return g.__gcReady;
}

export async function managementSeed(): Promise<ManagementSeed> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed-management.json'), 'utf8'));
  } catch {
    return {};
  }
}

export async function ctx(): Promise<{ db: Db; ds: Dataset }> {
  await ensureReady();
  const [db, ds] = await Promise.all([getDb(), getDataset()]);
  return { db, ds };
}

export function asOfParam(req: Request, ds: Dataset): string {
  const v = new URL(req.url).searchParams.get('asOf');
  return v && isIsoDate(v) ? v : latestDataDate(ds);
}

export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<Response> => {
    // Every API response depends on live data: never prerender at build time (no DB access during `next build`).
    await connection();
    try {
      const out = await fn(...args);
      if (out instanceof Response) return out;
      return Response.json(out, { headers: { 'cache-control': 'no-store' } });
    } catch (e) {
      if (e instanceof ValidationError) return Response.json({ error: e.message }, { status: 400 });
      console.error(e);
      return Response.json({ error: (e as Error).message ?? 'Server error' }, { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ValidationError('Request body must be JSON.');
  }
}
