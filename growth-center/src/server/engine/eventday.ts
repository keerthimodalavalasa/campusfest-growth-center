import { cutoffFor, istDate, istHour } from './time';
import { isExternal } from './snapshot';
import type { Dataset } from './types';

export interface EventDayHour {
  hour: number; // 0-23 IST
  firstEntries: number; // people whose first verified admission THAT DAY was in this hour
  admissions: number; // all verified external admission scans in this hour
  deniedOrPending: number;
}

export interface EventDay {
  date: string;
  uniqueVisitors: number;
  newVisitors: number; // first time across the whole event
  hours: EventDayHour[];
  peakHour: number | null;
  peakFirstEntries: number;
  manualShare: number | null;
}

export interface EventDays {
  asOf: string;
  days: EventDay[];
  bothDays: number;
  uniqueVisitors: number;
  note: string;
}

/** Arrivals at the gate by IST hour for each event day, as of the cutoff (no later scans leak in). */
export function computeEventDays(ds: Dataset, asOf: string): EventDays {
  const cut = cutoffFor(asOf);
  const start = istDate(ds.event.startsAt);
  const end = istDate(ds.event.endsAt);
  const days: string[] = [];
  for (let d = start; d <= end; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) days.push(d);

  const firstEver = new Map<string, number>();
  const byDayPerson = new Map<string, Map<string, number>>();
  const out = new Map<string, EventDay>(days.map((d) => [d, { date: d, uniqueVisitors: 0, newVisitors: 0, hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, firstEntries: 0, admissions: 0, deniedOrPending: 0 })), peakHour: null, peakFirstEntries: 0, manualShare: null }]));
  const manual = new Map<string, number>();

  for (const c of ds.checkins) {
    if (c.at > cut) continue;
    const d = istDate(c.at);
    const day = out.get(d);
    if (!day) continue;
    const h = istHour(c.at);
    const verified = c.result === 'admitted' && c.verification === 'verified';
    if (!verified) {
      day.hours[h].deniedOrPending++;
      continue;
    }
    if (!isExternal(ds, c.personId)) continue;
    day.hours[h].admissions++;
    if (c.source === 'manual') manual.set(d, (manual.get(d) ?? 0) + 1);
    const m = byDayPerson.get(d) ?? byDayPerson.set(d, new Map()).get(d)!;
    const prev = m.get(c.personId);
    if (prev === undefined || c.at < prev) m.set(c.personId, c.at);
    const fe = firstEver.get(c.personId);
    if (fe === undefined || c.at < fe) firstEver.set(c.personId, c.at);
  }

  for (const [d, people] of byDayPerson) {
    const day = out.get(d)!;
    day.uniqueVisitors = people.size;
    for (const at of people.values()) day.hours[istHour(at)].firstEntries++;
    const totalAdm = day.hours.reduce((s, x) => s + x.admissions, 0);
    day.manualShare = totalAdm ? (manual.get(d) ?? 0) / totalAdm : null;
    for (const x of day.hours) if (x.firstEntries > day.peakFirstEntries) {
      day.peakFirstEntries = x.firstEntries;
      day.peakHour = x.hour;
    }
  }
  for (const at of firstEver.values()) {
    const day = out.get(istDate(at));
    if (day) day.newVisitors++;
  }
  const d1 = byDayPerson.get(days[0]);
  const d2 = days[1] ? byDayPerson.get(days[1]) : undefined;
  let both = 0;
  if (d1 && d2) for (const p of d1.keys()) if (d2.has(p)) both++;

  return {
    asOf,
    days: [...out.values()],
    bothDays: both,
    uniqueVisitors: firstEver.size,
    note: 'Verified external admissions only (admitted + verified + external person). First entries count each person once per day at their earliest scan; repeat scans are admissions, not new people.',
  };
}
