import { createMemoryDb } from '../src/server/db';
import { loadDataset } from '../src/server/dataset';
import { ensureSchema, importOriginal, seedSettings } from '../src/server/setup';
import { computeSnapshot } from '../src/server/engine/snapshot';
import { computeDiagnosis } from '../src/server/engine/diagnose';
import { computeDecisions } from '../src/server/engine/decide';
import { simulateReallocation } from '../src/server/engine/simulate';
import { computeDaily, toWeekly } from '../src/server/engine/timeseries';

const db = await createMemoryDb();
await ensureSchema(db); await seedSettings(db, true); await importOriginal(db);
const ds = await loadDataset(db);
for (const d of ['2025-03-09', '2025-04-20']) {
  console.log('\n================', d);
  const t0 = performance.now();
  const s = computeSnapshot(ds, d);
  const dg = computeDiagnosis(ds, d, s);
  const dc = computeDecisions(ds, d, s);
  console.log('ms', Math.round(performance.now() - t0), 'phase', s.phase, 'target', s.target?.version);
  if (s.projection) console.log('projection', JSON.stringify({ regs: Math.round(s.projection.registrations), conf: Math.round(s.projection.confirmed), vis: Math.round(s.projection.visitors), spend: Math.round(s.projection.spend), req: s.projection.requiredDailyRegistrations?.toFixed(1), cur: s.projection.currentDailyRegistrations.toFixed(1) }));
  console.log('biggestDrop', dg.biggestDrop);
  console.log('bottlenecks'); dg.bottlenecks.forEach(b => console.log('  ', b.explanation));
  console.log('signals'); dg.signals.forEach(x => console.log('  ', x.severity, x.title, '|', x.evidence));
  console.log('drivers', dg.drivers.window, dg.drivers.totalPrev7, '->', dg.drivers.totalLast7); dg.drivers.rows.slice(0, 4).forEach(r => console.log('  ', r.read));
  console.log('decisions', dc.basis); dc.recommendations.forEach(r => console.log('  ', r.decision.toUpperCase().padEnd(6), r.name.padEnd(22), Math.round(r.efficiency ?? 0), r.ratioToMedian?.toFixed(2), '|', r.reasons.join(' ; ')));
  console.log('realloc', dc.reallocations);
  const sim = simulateReallocation(s, [{ from: 'C02', to: 'C04', amount: 30000 }, { from: 'C03', to: 'C05', amount: 20000 }], ds.settings);
  console.log('sim delta', Math.round(sim.delta), sim.rows.filter(r => r.delta !== 0).map(r => `${r.name}: ${Math.round(r.visitorsBefore)}->${Math.round(r.visitorsAfter)}`).join(', '));
  if (dg.showUpDrivers.length) console.log('showup', dg.showUpDrivers.map(x => `${x.factor}/${x.group}: ${x.visitors}/${x.registrants}=${((x.showRate ?? 0) * 100).toFixed(1)}%`).join(' | '));
  console.log('dq', dg.dataQuality.map(q => `${q.item}=${q.value}`).join('; '));
}
const w = toWeekly(computeDaily(ds, '2025-04-20'));
console.log('weekly', w.map(x => `${x.week}:${x.newRegistrations}/${Math.round(x.spend)}`).join(' '));
const daily = computeDaily(ds, '2025-04-20');
const last = daily.points[daily.points.length - 1];
console.log('last daily point', JSON.stringify(last));
const c02 = computeDaily(ds, '2025-04-20', 'C02'); console.log('C02 regs total', c02.points.at(-1)!.registrations, 'confirmed', c02.points.at(-1)!.confirmed, 'visitors', c02.points.at(-1)!.visitors);
