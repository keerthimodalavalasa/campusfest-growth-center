import { neon, Pool } from '@neondatabase/serverless';

/** Minimal SQL surface shared by Neon (production) and PGlite (local dev / tests). */
export interface Sql {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Sql {
  kind: 'neon' | 'pglite';
  /** Run several statements atomically. */
  tx<T>(fn: (c: Sql) => Promise<T>): Promise<T>;
  /** Run statements inside a READ ONLY transaction with a statement timeout (used by the copilot SQL tool). */
  readOnly<T>(fn: (c: Sql) => Promise<T>, timeoutMs?: number): Promise<T>;
  /** Execute a multi-statement script without parameters (schema setup). */
  exec(script: string): Promise<void>;
}

function neonDb(url: string): Db {
  const http = neon(url);
  async function withClient<T>(fn: (c: Sql) => Promise<T>, begin: string, timeoutMs?: number): Promise<T> {
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query(begin);
      if (timeoutMs) await client.query(`set local statement_timeout = ${Math.floor(timeoutMs)}`);
      const out = await fn({
        query: async <R,>(text: string, params?: unknown[]) => (await client.query(text, params as unknown[])).rows as R[],
      });
      await client.query(begin.includes('read only') ? 'rollback' : 'commit');
      return out;
    } catch (e) {
      await client.query('rollback').catch(() => {});
      throw e;
    } finally {
      client.release();
      await pool.end();
    }
  }
  return {
    kind: 'neon',
    query: async <T,>(text: string, params?: unknown[]) => (await http.query(text, params ?? [])) as T[],
    tx: (fn) => withClient(fn, 'begin'),
    readOnly: (fn, timeoutMs = 5000) => withClient(fn, 'begin transaction read only', timeoutMs),
    exec: async (script) => {
      const pool = new Pool({ connectionString: url });
      try {
        await pool.query(script);
      } finally {
        await pool.end();
      }
    },
  };
}

type PGliteLike = {
  query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
  exec: (s: string) => Promise<unknown>;
  transaction: <T>(fn: (tx: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) => Promise<T>) => Promise<T>;
};

async function pgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = (dataDir ? new PGlite(dataDir) : new PGlite()) as unknown as PGliteLike;
  const wrap = (q: PGliteLike['query']): Sql => ({ query: async <T,>(t: string, p?: unknown[]) => (await q(t, p)).rows as T[] });
  return {
    kind: 'pglite',
    query: async <T,>(t: string, p?: unknown[]) => (await pg.query(t, p)).rows as T[],
    tx: (fn) => pg.transaction((tx) => fn(wrap(tx.query.bind(tx)))),
    readOnly: (fn, timeoutMs = 5000) =>
      pg.transaction(async (tx) => {
        await tx.query('set transaction read only');
        await tx.query(`set local statement_timeout = ${Math.floor(timeoutMs)}`);
        return fn(wrap(tx.query.bind(tx)));
      }),
    exec: async (s) => {
      await pg.exec(s);
    },
  };
}

const g = globalThis as unknown as { __gcDb?: Promise<Db> };

/** Singleton database handle. DATABASE_URL -> Neon; otherwise a local PGlite directory (.pglite). */
export function getDb(): Promise<Db> {
  if (!g.__gcDb) {
    const url = process.env.DATABASE_URL;
    g.__gcDb = url ? Promise.resolve(neonDb(url)) : pgliteDb(process.env.PGLITE_DIR ?? '.pglite');
  }
  return g.__gcDb;
}

/** For tests: create an isolated in-memory database. */
export function createMemoryDb(): Promise<Db> {
  return pgliteDb();
}
