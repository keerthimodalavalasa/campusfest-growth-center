import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createMemoryDb, type Db } from '@/server/db';
import { loadDataset } from '@/server/dataset';
import { ensureSchema, importOriginal, seedSettings } from '@/server/setup';
import type { Dataset } from '@/server/engine/types';

let shared: Promise<{ db: Db; ds: Dataset }> | null = null;

/** One in-memory Postgres with the original workbook imported, shared across a test file. */
export function originalDataset() {
  if (!shared) {
    shared = (async () => {
      const db = await createMemoryDb();
      await ensureSchema(db);
      await seedSettings(db, true);
      await importOriginal(db);
      return { db, ds: await loadDataset(db) };
    })();
  }
  return shared;
}

export async function freshDb() {
  const db = await createMemoryDb();
  await ensureSchema(db);
  await seedSettings(db, true);
  await importOriginal(db);
  return db;
}

export interface GroundTruth {
  snapshots: {
    as_of: string;
    target_version: string | null;
    targets: Record<string, number> | null;
    campaigns: Record<string, Record<string, number>>;
    totals: Record<string, number>;
  }[];
  event_days: Record<string, number>;
  dedup: Record<string, number>;
}

export function groundTruth(): GroundTruth {
  return JSON.parse(readFileSync(path.resolve(__dirname, '../../analysis/out/ground_truth.json'), 'utf8'));
}
