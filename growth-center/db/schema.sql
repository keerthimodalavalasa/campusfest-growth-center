-- CampusFest Growth Center schema (PostgreSQL / Neon / PGlite)
-- Source tables mirror the attendee dataset 1:1 (deduplicated by stable ID on import).
-- Timestamps are timestamptz; the dataset's naive IST values are stored with +05:30.

create table if not exists meta (
  key text primary key,
  value text not null
);

create table if not exists event_info (
  id int primary key default 1,
  event_name text not null,
  history_start date,
  history_end date,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  timezone text,
  currency text,
  fictional boolean
);

create table if not exists targets (
  id serial primary key,
  effective_at timestamptz not null,
  identified_external_people_goal int,
  registration_goal int,
  unique_external_visitors_goal int,
  marketing_budget_inr numeric,
  target_version text,
  origin text not null default 'dataset'
);

create table if not exists team (
  owner_id text primary key,
  owner_name text not null,
  role text
);

create table if not exists campaigns (
  campaign_id text primary key,
  campaign_name text not null,
  channel text,
  target_audience text,
  objective text,
  owner_id text,
  created_at timestamptz,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  -- management fields (not in the source dataset)
  status text not null default 'active',          -- planned | active | paused | stopped | completed
  planned_budget_inr numeric,                       -- optional allocation set by the team
  notes text,
  origin text not null default 'dataset',           -- dataset | app
  updated_at timestamptz not null default now()
);

create table if not exists daily_marketing (
  activity_id text primary key,
  campaign_id text not null,
  activity_date date not null,
  impressions numeric not null default 0,
  clicks numeric not null default 0,
  reported_reach numeric not null default 0,
  landing_page_sessions numeric not null default 0,
  registration_starts numeric not null default 0,
  marketing_spend_inr numeric not null default 0,
  platform text,
  owner_id text
);
create index if not exists daily_marketing_campaign_idx on daily_marketing (campaign_id, activity_date);

create table if not exists people (
  person_id text primary key,
  person_name text,
  person_type text not null,                         -- external | internal | staff | test
  first_seen_at timestamptz,
  first_touch_source text,
  first_campaign_id text,
  owner_id text
);

create table if not exists interactions (
  interaction_id text primary key,
  person_id text not null,
  campaign_id text,
  occurred_at timestamptz not null,
  event_type text not null,
  detail text,
  owner_id text
);
create index if not exists interactions_person_idx on interactions (person_id);

create table if not exists registrations (
  registration_id text primary key,
  person_id text not null,
  campaign_id text,
  registered_at timestamptz not null,
  owner_id text
);
create index if not exists registrations_person_idx on registrations (person_id);

create table if not exists registration_history (
  history_id text primary key,
  registration_id text not null,
  person_id text,
  campaign_id text,
  effective_at timestamptz not null,
  status text not null,                              -- interested | confirmed | cancelled | waitlisted
  owner_id text
);
create index if not exists registration_history_reg_idx on registration_history (registration_id, effective_at);

create table if not exists checkins (
  event_id text primary key,
  person_id text not null,
  registration_id text,
  campaign_id text,
  occurred_at timestamptz not null,
  result text not null,                              -- admitted | denied | pending
  verification text not null,                        -- verified | unverified
  source text,                                       -- scanner | manual
  owner_id text
);
create index if not exists checkins_person_idx on checkins (person_id);

-- ---------------------------------------------------------------- management
create table if not exists initiatives (
  id text primary key,
  rank int not null,
  name text not null,
  concept text,
  why_it_works text,
  campaign_ids text[] not null default '{}',
  owner_id text,
  budget_inr numeric,
  expected_visitors numeric,                         -- expected incremental verified visitors (plan)
  start_date date,
  end_date date,
  primary_kpi text,
  scale_rule text,
  change_rule text,
  stop_rule text,
  status text not null default 'planned',            -- planned | testing | scaling | changed | stopped | done
  ice_impact numeric, ice_confidence numeric, ice_ease numeric,
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id serial primary key,
  title text not null,
  description text,
  campaign_id text,
  initiative_id text,
  owner_id text,
  due_date date,
  status text not null default 'todo',               -- todo | in_progress | blocked | done
  priority text not null default 'medium',           -- high | medium | low
  decision text,                                     -- scale | change | stop | fix | monitor (optional)
  source text not null default 'manual',             -- manual | copilot | insight | seed
  evidence text,                                     -- metric evidence that motivated the task
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  description text
);

create table if not exists change_log (
  id serial primary key,
  at timestamptz not null default now(),
  actor text not null default 'user',                -- user | copilot | system
  entity text not null,
  entity_id text,
  action text not null,
  detail jsonb
);

create table if not exists import_log (
  id serial primary key,
  at timestamptz not null default now(),
  source text not null,
  stats jsonb not null
);

-- ---------------------------------------------------------------- read-only views for the copilot's SQL tool
create or replace view v_external_people as
  select * from people where person_type = 'external';

create or replace view v_registration_current_status as
  select distinct on (h.registration_id)
         h.registration_id, h.person_id, h.campaign_id, h.status, h.effective_at
  from registration_history h
  order by h.registration_id, h.effective_at desc, h.history_id desc;

create or replace view v_verified_external_admissions as
  select c.* from checkins c
  join people p on p.person_id = c.person_id
  where c.result = 'admitted' and c.verification = 'verified' and p.person_type = 'external';
