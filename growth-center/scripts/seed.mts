/**
 * Prepare a database: schema + settings + original attendee workbook + management seed (team, 2027 bets, tasks).
 *   DATABASE_URL=postgres://... npx tsx scripts/seed.mts            (Neon)
 *   npx tsx scripts/seed.mts                                        (local PGlite in ./.pglite)
 *   add --reset-management to replace existing initiatives and tasks with the seed file
 */
import { readFileSync, existsSync } from 'node:fs';
import { getDb } from '../src/server/db';
import { ensureSchema, importOriginal, seedManagement, seedSettings } from '../src/server/setup';

for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const db = await getDb();
console.log(`database: ${db.kind}`);
const t0 = Date.now();
await ensureSchema(db);
await seedSettings(db);
const res = await importOriginal(db);
for (const [k, s] of Object.entries(res.tables)) console.log(`  ${k.padEnd(13)} read ${String(s.rowsRead).padStart(6)}  imported ${String(s.imported).padStart(6)}  duplicates removed ${s.duplicateIds}`);
const seed = JSON.parse(readFileSync('data/seed-management.json', 'utf8'));
await seedManagement(db, seed, process.argv.includes('--reset-management'));
const [v] = await db.query<{ value: string }>(`select value from meta where key = 'data_version'`);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s; data_version ${v.value}`);
process.exit(0);
