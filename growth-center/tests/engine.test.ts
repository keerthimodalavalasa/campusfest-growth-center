import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeSnapshot, UNATTRIBUTED } from '@/server/engine/snapshot';
import { computeEventDays } from '@/server/engine/eventday';
import { groundTruth, originalDataset } from './helpers';

const GT = groundTruth();
const close = (a: number | null | undefined, b: number, msg: string) => assert.ok(Math.abs((a ?? NaN) - b) < 1e-6, `${msg}: got ${a}, expected ${b}`);
const FIELDS: [string, string][] = [
  ['spend', 'spend'],
  ['impressions', 'impressions'],
  ['clicks', 'clicks'],
  ['landing_page_sessions', 'lpSessions'],
  ['registration_starts', 'regStarts'],
  ['identified', 'identified'],
  ['registrations', 'registrations'],
  ['confirmed', 'confirmed'],
  ['cancelled', 'cancelled'],
  ['waitlisted', 'waitlisted'],
  ['interested', 'interested'],
  ['visitors', 'visitors'],
  ['opted_out_events', 'optOuts'],
  ['questions', 'questions'],
  ['brochures', 'brochures'],
];

describe('import applies the source rules', () => {
  it('deduplicates import retries by stable ID', async () => {
    const { ds } = await originalDataset();
    const t = ds.importStats!.tables;
    assert.equal(t.daily.duplicateIds, GT.dedup.daily);
    assert.equal(t.history.duplicateIds, GT.dedup.registration_history);
    assert.equal(t.checkins.duplicateIds, GT.dedup.checkins);
    assert.equal(t.interactions.duplicateIds, GT.dedup.interactions);
    for (const s of Object.values(t)) assert.equal(s.conflictingDuplicates, 0);
  });
});

for (const truth of GT.snapshots) {
  const asOf = truth.as_of;
  describe(`snapshot as of ${asOf} matches the independent Python implementation`, () => {
  it('totals', async () => {
    const { ds } = await originalDataset();
    const snap = computeSnapshot(ds, asOf);
    assert.equal(snap.target?.version ?? null, truth.target_version);
    if (truth.targets) {
      assert.equal(snap.target?.registrationGoal, truth.targets.registration_goal);
      assert.equal(snap.target?.visitorsGoal, truth.targets.unique_external_visitors_goal);
      assert.equal(snap.target?.budget, truth.targets.marketing_budget_inr);
    }
    for (const [py, ts] of FIELDS) {
      close((snap.totals as unknown as Record<string, number>)[ts], truth.totals[py], `total ${py} @ ${asOf}`);
    }
  });

  it('per campaign', async () => {
    const { ds } = await originalDataset();
    const snap = computeSnapshot(ds, asOf);
    for (const [cid, row] of Object.entries(truth.campaigns)) {
      const m = snap.campaigns.find((c) => c.campaignId === (cid === 'UNATTRIBUTED' ? UNATTRIBUTED : cid));
      if (!m) {
        // the unattributed bucket is omitted when empty
        assert.ok(Object.values(row).every((v) => v === 0), `missing bucket ${cid}`);
        continue;
      }
      for (const [py, ts] of FIELDS) {
        close((m as unknown as Record<string, number>)[ts], row[py], `${cid} ${py} @ ${asOf}`);
      }
    }
  });
  });
}

describe('event-day gate analytics match the independent Python implementation', () => {
  it('per-day uniques, both-day visitors and day-1 first entries by hour', async () => {
    const { ds } = await originalDataset();
    const py = JSON.parse(readFileSync(new URL('../../analysis/out/deep_dive.json', import.meta.url), 'utf8')) as {
      days: { day1: number; day2: number; both: number };
      first_entry_by_hour: Record<string, number>;
    };
    const e = computeEventDays(ds, '2025-04-20');
    assert.equal(e.uniqueVisitors, 2050);
    assert.equal(e.days[0].uniqueVisitors, py.days.day1);
    assert.equal(e.days[1].uniqueVisitors, py.days.day2);
    assert.equal(e.bothDays, py.days.both);
    // on day 1 "first entry that day" and "first entry ever" are the same thing
    for (const h of e.days[0].hours) assert.equal(h.firstEntries, py.first_entry_by_hour[`2025-04-12 ${String(h.hour).padStart(2, '0')}h`] ?? 0, `hour ${h.hour}`);
    assert.equal(e.days[0].peakHour, 11);
    assert.equal(e.days[0].peakFirstEntries, 251);
  });

  it('shows nothing before the event', async () => {
    const { ds } = await originalDataset();
    const e = computeEventDays(ds, '2025-04-11');
    assert.equal(e.uniqueVisitors, 0);
  });
});

describe('no future leakage', () => {
  it('a mid-campaign snapshot never shows visitors or later statuses', async () => {
    const { ds } = await originalDataset();
    const snap = computeSnapshot(ds, '2025-03-01');
    assert.equal(snap.phase, 'campaign');
    assert.equal(snap.totals.visitors, 0);
    assert.equal(snap.totals.rates.regToVisit, null);
    assert.notEqual(snap.projection, null);
    assert.equal(snap.target?.version, 'Attendee launch plan');
  });

  it('revised targets apply from 15 March 09:00 IST', async () => {
    const { ds } = await originalDataset();
    assert.equal(computeSnapshot(ds, '2025-03-14').target?.version, 'Attendee launch plan');
    assert.equal(computeSnapshot(ds, '2025-03-15').target?.version, 'Attendee revised plan');
  });

  it('final snapshot reproduces the headline numbers', async () => {
    const { ds } = await originalDataset();
    const s = computeSnapshot(ds, '2025-04-20');
    assert.equal(s.totals.identified, 3625);
    assert.equal(s.totals.registrations, 2800);
    assert.equal(s.totals.confirmed, 2500);
    assert.equal(s.totals.visitors, 2050);
    assert.equal(s.totals.spend, 274000);
    assert.equal(s.excluded.walkInVisitors, 125);
    const ps = s.campaigns.find((c) => c.campaignId === 'C02')!;
    assert.equal(Math.round(ps.costs.perVisitor!), 274);
    close(ps.rates.regToVisit, 0.5, '');
  });
});
