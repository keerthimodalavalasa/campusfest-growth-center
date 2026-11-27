/** Editable source tables for the Data page (and the reviewer's "change the data" tests). */
export type ColType = 'text' | 'int' | 'num' | 'date' | 'ts' | 'enum' | 'bool';

export interface ColSpec {
  name: string;
  label: string;
  type: ColType;
  editable: boolean;
  required?: boolean;
  options?: string[];
  width?: number;
}

export interface TableSpec {
  key: string;
  table: string;
  label: string;
  description: string;
  pk: string;
  pkGenerated?: boolean; // serial ids
  orderBy: string;
  search: string[];
  columns: ColSpec[];
  insertable: boolean;
  deletable: boolean;
  affectsAnalytics: boolean;
}

const owner: ColSpec = { name: 'owner_id', label: 'Owner ID', type: 'text', editable: true };

export const TABLES: Record<string, TableSpec> = {
  daily_marketing: {
    key: 'daily_marketing',
    table: 'daily_marketing',
    label: 'Daily marketing',
    description: 'Anonymous platform metrics and net spend per campaign per IST day. Spend can be negative (vendor credits).',
    pk: 'activity_id',
    orderBy: 'activity_date desc, campaign_id',
    search: ['activity_id', 'campaign_id', 'platform'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'activity_id', label: 'Activity ID', type: 'text', editable: false, required: true },
      { name: 'campaign_id', label: 'Campaign', type: 'text', editable: true, required: true },
      { name: 'activity_date', label: 'Date', type: 'date', editable: true, required: true },
      { name: 'impressions', label: 'Impressions', type: 'num', editable: true },
      { name: 'clicks', label: 'Clicks', type: 'num', editable: true },
      { name: 'reported_reach', label: 'Reach', type: 'num', editable: true },
      { name: 'landing_page_sessions', label: 'LP sessions', type: 'num', editable: true },
      { name: 'registration_starts', label: 'Form starts', type: 'num', editable: true },
      { name: 'marketing_spend_inr', label: 'Spend ₹', type: 'num', editable: true },
      { name: 'platform', label: 'Platform', type: 'text', editable: true },
      owner,
    ],
  },
  targets: {
    key: 'targets',
    table: 'targets',
    label: 'Targets & budget',
    description: 'Full-state target versions. The version in force on a date is the latest one effective on or before that date.',
    pk: 'id',
    pkGenerated: true,
    orderBy: 'effective_at',
    search: ['target_version'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'id', label: 'ID', type: 'int', editable: false },
      { name: 'effective_at', label: 'Effective at (IST)', type: 'ts', editable: true, required: true },
      { name: 'identified_external_people_goal', label: 'Identified goal', type: 'int', editable: true },
      { name: 'registration_goal', label: 'Registration goal', type: 'int', editable: true },
      { name: 'unique_external_visitors_goal', label: 'Visitors goal', type: 'int', editable: true },
      { name: 'marketing_budget_inr', label: 'Budget ₹', type: 'num', editable: true },
      { name: 'target_version', label: 'Version', type: 'text', editable: true },
    ],
  },
  people: {
    key: 'people',
    table: 'people',
    label: 'People',
    description: 'Identified people. Only person_type = external counts toward targets.',
    pk: 'person_id',
    orderBy: 'first_seen_at desc',
    search: ['person_id', 'person_name', 'first_campaign_id'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'person_id', label: 'Person ID', type: 'text', editable: false, required: true },
      { name: 'person_name', label: 'Name', type: 'text', editable: true },
      { name: 'person_type', label: 'Type', type: 'enum', editable: true, required: true, options: ['external', 'internal', 'staff', 'test'] },
      { name: 'first_seen_at', label: 'First seen (IST)', type: 'ts', editable: true, required: true },
      { name: 'first_touch_source', label: 'First touch', type: 'enum', editable: true, options: ['campaign', 'walk_in', 'internal_registration', 'event_access'] },
      { name: 'first_campaign_id', label: 'First campaign', type: 'text', editable: true },
      owner,
    ],
  },
  registrations: {
    key: 'registrations',
    table: 'registrations',
    label: 'Registrations',
    description: 'One row per registration. Status lives in Registration history.',
    pk: 'registration_id',
    orderBy: 'registered_at desc',
    search: ['registration_id', 'person_id', 'campaign_id'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'registration_id', label: 'Registration ID', type: 'text', editable: false, required: true },
      { name: 'person_id', label: 'Person ID', type: 'text', editable: true, required: true },
      { name: 'campaign_id', label: 'Campaign', type: 'text', editable: true },
      { name: 'registered_at', label: 'Registered at (IST)', type: 'ts', editable: true, required: true },
      owner,
    ],
  },
  registration_history: {
    key: 'registration_history',
    table: 'registration_history',
    label: 'Registration history',
    description: 'Full-state status versions. Add a new version to change a status (e.g. cancel or reconfirm); never sum versions.',
    pk: 'history_id',
    orderBy: 'effective_at desc',
    search: ['history_id', 'registration_id', 'person_id', 'status', 'campaign_id'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'history_id', label: 'History ID', type: 'text', editable: false, required: true },
      { name: 'registration_id', label: 'Registration ID', type: 'text', editable: true, required: true },
      { name: 'person_id', label: 'Person ID', type: 'text', editable: true },
      { name: 'campaign_id', label: 'Campaign', type: 'text', editable: true },
      { name: 'effective_at', label: 'Effective at (IST)', type: 'ts', editable: true, required: true },
      { name: 'status', label: 'Status', type: 'enum', editable: true, required: true, options: ['interested', 'confirmed', 'cancelled', 'waitlisted'] },
      owner,
    ],
  },
  checkins: {
    key: 'checkins',
    table: 'checkins',
    label: 'Check-ins',
    description: 'Admission observations. Only admitted + verified records of external people establish attendance.',
    pk: 'event_id',
    orderBy: 'occurred_at desc',
    search: ['event_id', 'person_id', 'registration_id', 'campaign_id', 'result'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'event_id', label: 'Event ID', type: 'text', editable: false, required: true },
      { name: 'person_id', label: 'Person ID', type: 'text', editable: true, required: true },
      { name: 'registration_id', label: 'Registration ID', type: 'text', editable: true },
      { name: 'campaign_id', label: 'Campaign', type: 'text', editable: true },
      { name: 'occurred_at', label: 'Occurred at (IST)', type: 'ts', editable: true, required: true },
      { name: 'result', label: 'Result', type: 'enum', editable: true, required: true, options: ['admitted', 'denied', 'pending'] },
      { name: 'verification', label: 'Verification', type: 'enum', editable: true, required: true, options: ['verified', 'unverified'] },
      { name: 'source', label: 'Source', type: 'enum', editable: true, options: ['scanner', 'manual'] },
      owner,
    ],
  },
  interactions: {
    key: 'interactions',
    table: 'interactions',
    label: 'Interest & engagement',
    description: 'Identified actions (page visits, brochure downloads, questions, nurture emails, opt-outs).',
    pk: 'interaction_id',
    orderBy: 'occurred_at desc',
    search: ['interaction_id', 'person_id', 'campaign_id', 'event_type'],
    insertable: true,
    deletable: true,
    affectsAnalytics: true,
    columns: [
      { name: 'interaction_id', label: 'Interaction ID', type: 'text', editable: false, required: true },
      { name: 'person_id', label: 'Person ID', type: 'text', editable: true, required: true },
      { name: 'campaign_id', label: 'Campaign', type: 'text', editable: true },
      { name: 'occurred_at', label: 'Occurred at (IST)', type: 'ts', editable: true, required: true },
      { name: 'event_type', label: 'Event type', type: 'enum', editable: true, required: true, options: ['page_visit', 'brochure_download', 'registration_start', 'event_question_submitted', 'nurture_email_sent', 'nurture_email_opened', 'nurture_email_clicked', 'opted_out'] },
      { name: 'detail', label: 'Detail', type: 'text', editable: true },
      owner,
    ],
  },
};
