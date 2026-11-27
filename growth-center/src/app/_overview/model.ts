import type { Snapshot } from '@/server/engine/snapshot';
import type { DailyPoint, WeeklyPoint } from '@/server/engine/timeseries';
import { daysBetween } from '@/lib/format';

/** /api/overview response (see src/app/api/overview/route.ts). */
export interface Overview {
  snapshot: Snapshot;
  previous: {
    asOf: string;
    phase: Snapshot['phase'];
    registrations: number;
    visitors: number;
    spend: number;
    costPerRegistration: number | null;
    costPerVisitor: number | null;
    costPerExpectedVisitor: number | null;
    regToVisit: number | null;
    regToConfirmed: number | null;
  };
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
}

/** The three ways the page reads: before the gates open, while they are open, after. */
export type Mode = 'campaign' | 'event' | 'post';
export const modeOf = (p: Snapshot['phase']): Mode => (p === 'event' ? 'event' : p === 'post-event' ? 'post' : 'campaign');

const IST = 5.5 * 3600 * 1000;
export const istDate = (ms: number) => new Date(ms + IST).toISOString().slice(0, 10);
export const istClock = (ms: number) => new Date(ms + IST).toISOString().slice(11, 16);

/** Everything the tiles share, derived on the client from the existing API responses. */
export interface Ctx {
  s: Snapshot;
  mode: Mode;
  asOf: string;
  start: string;
  eventStart: string;
  eventEnd: string;
  eventDays: number;
  /** 1-based event day at the as-of date (event mode only) */
  eventDay: number;
  /** whole days until the gates open (campaign mode) */
  daysLeft: number;
  gateOpens: string;
}

export function makeCtx(s: Snapshot): Ctx {
  const eventStart = istDate(s.event.startsAt);
  const eventEnd = istDate(s.event.endsAt);
  return {
    s,
    mode: modeOf(s.phase),
    asOf: s.asOf,
    start: s.event.historyStart,
    eventStart,
    eventEnd,
    eventDays: daysBetween(eventStart, eventEnd) + 1,
    eventDay: Math.max(1, daysBetween(eventStart, s.asOf) + 1),
    daysLeft: Math.max(1, Math.round(s.daysToEvent)),
    gateOpens: istClock(s.event.startsAt),
  };
}

/** Share of a goal, or null when there is no goal in force. */
export const share = (x: number | null | undefined, goal: number | null | undefined) => (x != null && goal ? x / goal : null);

/** "50%" when the rate is whole at one decimal, otherwise "12.2%". */
export const pctTidy = (x: number | null | undefined) => {
  if (x == null || !Number.isFinite(x)) return '–';
  const t = (x * 100).toFixed(1);
  return `${t.endsWith('.0') ? t.slice(0, -2) : t}%`;
};

/** People per waffle dot, chosen so the waffle never holds more than ~300 dots. */
export function waffleUnit(n: number) {
  for (const u of [10, 25, 50, 100, 250, 500, 1000]) if (n / u <= 300) return u;
  return Math.ceil(n / 300);
}
