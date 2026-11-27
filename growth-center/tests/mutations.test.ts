import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Db } from '@/server/db';
import { loadDataset } from '@/server/dataset';
import { computeSnapshot } from '@/server/engine/snapshot';
import { computeDecisions } from '@/server/engine/decide';
import { createTask, deleteRow, insertRow, listTasks, updateCampaign, updateRow, updateSettings, ValidationError } from '@/server/mutations';
import { buildTools } from '@/server/chat/tools';
import { freshDb } from './helpers';

let db: Db;
const snap = async (asOf = '2025-04-20') => computeSnapshot(await loadDataset(db), asOf);

before(async () => {
  db = await freshDb();
});

describe('edits to source data flow straight into the analytics', () => {
  it('adding net spend changes spend and cost per visitor; deleting restores it', async () => {
    const base = await snap();
    await insertRow(db, 'daily_marketing', { activity_id: 'TEST-1', campaign_id: 'C02', activity_date: '2025-03-01', marketing_spend_inr: 10000 });
    const after = await snap();
    assert.equal(after.totals.spend, base.totals.spend + 10000);
    const ps = after.campaigns.find((c) => c.campaignId === 'C02')!;
    assert.equal(Math.round(ps.costs.perVisitor!), Math.round(103000 / 340));
    // the edit is dated 1 Mar: a snapshot on 28 Feb must not see it
    const feb = await snap('2025-02-28');
    const febBase = computeSnapshot(await loadDataset(db), '2025-02-28');
    assert.equal(feb.totals.spend, febBase.totals.spend);
    await deleteRow(db, 'daily_marketing', 'TEST-1');
    assert.equal((await snap()).totals.spend, base.totals.spend);
  });

  it('a new full-state status version cancels a registration from its effective date onward', async () => {
    const base = await snap();
    await insertRow(db, 'registration_history', { history_id: 'TEST-H1', registration_id: 'R0003', person_id: 'E0003', campaign_id: 'C01', effective_at: '2025-04-01 12:00', status: 'cancelled' });
    const after = await snap();
    assert.equal(after.totals.confirmed, base.totals.confirmed - 1);
    assert.equal(after.totals.cancelled, base.totals.cancelled + 1);
    const earlier = await snap('2025-03-31');
    assert.equal(earlier.totals.cancelled, computeSnapshot(await loadDataset(db), '2025-03-31').totals.cancelled);
    await deleteRow(db, 'registration_history', 'TEST-H1');
  });

  it('denying a visitor\'s only admission removes them from verified visitors', async () => {
    const base = await snap();
    // pick an external visitor with exactly one verified admission
    const [one] = await db.query<{ event_id: string }>(
      `select min(event_id) as event_id from v_verified_external_admissions group by person_id having count(*) = 1 order by 1 limit 1`,
    );
    await updateRow(db, 'checkins', one.event_id, { result: 'denied' });
    const after = await snap();
    assert.equal(after.totals.visitors, base.totals.visitors - 1);
    await updateRow(db, 'checkins', one.event_id, { result: 'admitted' });
    assert.equal((await snap()).totals.visitors, base.totals.visitors);
    // a visitor with several admissions stays a single visitor when one admission is denied
    const [multi] = await db.query<{ event_id: string }>(
      `select min(event_id) as event_id from v_verified_external_admissions group by person_id having count(*) > 1 order by 1 limit 1`,
    );
    await updateRow(db, 'checkins', multi.event_id, { result: 'denied' });
    assert.equal((await snap()).totals.visitors, base.totals.visitors);
    await updateRow(db, 'checkins', multi.event_id, { result: 'admitted' });
  });

  it('a new target version takes effect from its timestamp', async () => {
    const id = await insertRow(db, 'targets', { effective_at: '2025-04-01 09:00', identified_external_people_goal: 4000, registration_goal: 3500, unique_external_visitors_goal: 2600, marketing_budget_inr: 320000, target_version: 'Test plan' });
    assert.equal((await snap('2025-03-31')).target?.version, 'Attendee revised plan');
    assert.equal((await snap('2025-04-01')).target?.version, 'Test plan');
    await deleteRow(db, 'targets', id);
  });

  it('rejects invalid values with a clear message', async () => {
    await assert.rejects(() => updateRow(db, 'checkins', 'CHK000002', { result: 'maybe' }), (e: Error) => e instanceof ValidationError && /admitted, denied, pending/.test(e.message));
    await assert.rejects(() => insertRow(db, 'daily_marketing', { activity_id: 'X', campaign_id: 'C01', activity_date: 'yesterday' }), ValidationError);
  });
});

describe('management changes', () => {
  it('campaign status and settings changes update the decision board', async () => {
    await updateCampaign(db, 'C02', { status: 'paused', planned_budget_inr: 45000 });
    const ds = await loadDataset(db);
    assert.equal(ds.campaigns.find((c) => c.campaignId === 'C02')?.status, 'paused');
    const before = computeDecisions(ds, '2025-04-20').recommendations.find((r) => r.campaignId === 'C02')!.decision;
    assert.equal(before, 'stop');
    await updateSettings(db, { stopCostFactor: 10, changeCostFactor: 10 });
    const loosened = computeDecisions(await loadDataset(db), '2025-04-20').recommendations.find((r) => r.campaignId === 'C02')!.decision;
    assert.equal(loosened, 'change'); // efficiency no longer stops it; guardrails still fail
    await updateSettings(db, { stopCostFactor: 2, changeCostFactor: 1.25 });
    await updateCampaign(db, 'C02', { status: 'active', planned_budget_inr: null });
  });

  it('tasks validate references', async () => {
    const id = await createTask(db, { title: 'Test task', owner_id: 'T04', campaign_id: 'C02', due_date: '2026-12-04', priority: 'high' });
    assert.ok((await listTasks(db, { campaign_id: 'C02' })).some((t) => (t as { id: number }).id === id));
    await assert.rejects(() => createTask(db, { title: 'x', owner_id: 'NOPE' }), /Unknown owner_id/);
  });
});

describe('copilot SQL tool is read-only', () => {
  it('refuses writes and multiple statements, allows SELECT', async () => {
    const tools = buildTools({ db, defaultAsOf: '2025-04-20', today: '2026-11-26' });
    const run = (sql: string) => (tools.query_data as unknown as { execute: (i: { sql: string; purpose: string }) => Promise<Record<string, unknown>> }).execute({ sql, purpose: 'test' });
    const ok = await run(`select count(distinct person_id)::int as n from v_verified_external_admissions`);
    assert.deepEqual((ok.rows as { n: number }[])[0].n, 2050);
    for (const bad of ['delete from tasks', 'select 1; drop table tasks', 'update tasks set title = $$x$$', 'with x as (delete from tasks returning *) select * from x']) {
      const r = await run(bad);
      assert.ok(typeof r.error === 'string', `should refuse: ${bad}`);
    }
    assert.ok((await listTasks(db)).length >= 1, 'tasks survive');
  });
});
