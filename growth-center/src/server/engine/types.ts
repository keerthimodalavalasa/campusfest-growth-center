export interface EventInfo {
  name: string;
  historyStart: string; // YYYY-MM-DD
  historyEnd: string;
  startsAt: number; // epoch ms
  endsAt: number;
  timezone: string;
  currency: string;
}

export interface Target {
  id: number;
  effectiveAt: number;
  identifiedGoal: number;
  registrationGoal: number;
  visitorsGoal: number;
  budget: number;
  version: string;
  origin: string;
}

export interface TeamMember {
  ownerId: string;
  ownerName: string;
  role: string | null;
}

export interface Campaign {
  campaignId: string;
  name: string;
  channel: string | null;
  targetAudience: string | null;
  objective: string | null;
  ownerId: string | null;
  createdAt: number | null;
  plannedStartAt: number | null;
  plannedEndAt: number | null;
  status: string;
  plannedBudget: number | null;
  notes: string | null;
  origin: string;
}

export interface DailyRow {
  activityId: string;
  campaignId: string;
  date: string; // YYYY-MM-DD (IST reporting day)
  impressions: number;
  clicks: number;
  reach: number;
  lpSessions: number;
  regStarts: number;
  spend: number;
  platform: string | null;
}

export interface Person {
  personId: string;
  name: string | null;
  type: string; // external | internal | staff | test
  firstSeenAt: number;
  firstTouch: string | null;
  firstCampaignId: string | null;
}

export interface Interaction {
  personId: string;
  campaignId: string | null;
  at: number;
  type: string;
}

export interface Registration {
  registrationId: string;
  personId: string;
  campaignId: string | null;
  at: number;
}

export interface StatusVersion {
  historyId: string;
  registrationId: string;
  at: number;
  status: string;
}

export interface Checkin {
  eventId: string;
  personId: string;
  registrationId: string | null;
  campaignId: string | null;
  at: number;
  result: string;
  verification: string;
  source: string | null;
}

export interface Settings {
  /** Planning assumption used ONLY for pre-event projections: share of confirmed registrants expected to attend. */
  showRateAssumption: number;
  /** Optional per-campaign override of the show-rate assumption. */
  showRateByCampaign: Record<string, number>;
  /** Decision rules: thresholds are multiples of the portfolio median cost per (expected) visitor. */
  scaleCostFactor: number;
  changeCostFactor: number;
  stopCostFactor: number;
  maxOptOutRate: number;
  maxCancelRateGapPts: number;
  momentumDropRatio: number;
  /** Budget simulator: visitors scale with (new spend / current spend) ^ elasticity. 1 = linear, <1 = diminishing returns. */
  spendElasticity: number;
}

export const DEFAULT_SETTINGS: Settings = {
  // PheedLoop (1,070+ events, 2026): free events with 500+ registrants see ~24% no-shows, i.e. ~76% attend.
  // Used only before event day, never derived from later outcomes in the same dataset.
  showRateAssumption: 0.75,
  showRateByCampaign: {},
  scaleCostFactor: 0.8,
  changeCostFactor: 1.25,
  stopCostFactor: 2,
  maxOptOutRate: 0.08,
  maxCancelRateGapPts: 3,
  momentumDropRatio: 0.5,
  spendElasticity: 0.6,
};

export interface ImportStatsSummary {
  at: string | null;
  source: string | null;
  tables: Record<string, { sheet: string; rowsRead: number; imported: number; duplicateIds: number; conflictingDuplicates: number; skippedInvalid: number }>;
  warnings: string[];
}

export interface Dataset {
  version: string;
  loadedAt: number;
  event: EventInfo;
  targets: Target[]; // sorted by effectiveAt
  team: Map<string, TeamMember>;
  campaigns: Campaign[];
  daily: DailyRow[];
  people: Map<string, Person>;
  interactions: Interaction[];
  registrations: Registration[];
  history: Map<string, StatusVersion[]>; // registrationId -> versions sorted by (at, historyId)
  checkins: Checkin[];
  settings: Settings;
  importStats: ImportStatsSummary | null;
  /** personId -> registrations (sorted by time) */
  regsByPerson: Map<string, Registration[]>;
}
