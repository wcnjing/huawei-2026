-- SafeSpace application data.
--
-- Kept out of `public`, which Supabase publishes through its HTTP API. The browser will
-- hold that API's key once the Realtime doorbell ships. Row-level security is on with no
-- policies as a second lock. The server connects as the owner and is unaffected.
-- Plain Postgres only, so this file applies unchanged to Supabase, PGlite and CI.

create schema if not exists safespace;
revoke all on schema safespace from public;

create table safespace.users (
  id text primary key,
  name text not null,
  role text not null default 'ROOKIE',
  phone text unique,
  phone_lookup_hash text unique,
  consent_to_drills boolean not null default false,
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  xp_max integer not null default 500 check (xp_max > 0),
  streak integer not null default 0 check (streak >= 0),
  times_safe integer not null default 0 check (times_safe >= 0),
  times_scammed integer not null default 0 check (times_scammed >= 0),
  safe_this_week boolean not null default true,
  recent_drill_result text check (recent_drill_result in ('WON', 'LOST')),
  primary_color text not null default '#4ecdc4',
  room_name text not null default 'GUEST ROOM',
  room_bg text not null default '#081420',
  badge_count integer not null default 0 check (badge_count >= 0),
  badge_total integer not null default 9 check (badge_total >= 0),
  email text,
  pending_email text,
  email_verified_at timestamptz,
  email_verification_requested_at timestamptz,
  email_verification_token_hash text,
  created_at timestamptz not null default now()
);

-- Only a digest of the bearer token is stored.
create table safespace.sessions (
  token_hash text primary key,
  user_id text not null references safespace.users (id) on delete cascade,
  created_at timestamptz not null,
  expires_at timestamptz not null
);
create index sessions_user_id_idx on safespace.sessions (user_id);

create table safespace.drill_attempts (
  id text primary key,
  user_id text not null references safespace.users (id),
  channel text not null check (channel in ('call', 'sms', 'email')),
  status text not null check (status in ('created', 'sent', 'completed', 'failed')),
  provider_id text unique,
  action_token_hash text unique,
  created_at timestamptz not null,
  sent_at timestamptz,
  completed_at timestamptz,
  scored boolean,
  outcome text,
  failure_reason text,
  -- No foreign key: drill_results.attempt_id already points the other way.
  result_record_id text
);
create index drill_attempts_cooldown_idx
  on safespace.drill_attempts (user_id, channel, created_at desc);

-- One row per scored or unscored result. A real result stays pending until the client
-- acknowledges it; `seq` keeps the queue in insertion order.
create table safespace.drill_results (
  id text primary key,
  seq bigint generated always as identity,
  user_id text not null references safespace.users (id),
  channel text not null check (channel in ('call', 'sms', 'email')),
  outcome text,
  practice boolean not null,
  result text not null check (result in ('WON', 'LOST', 'SAFE', 'UNSCORED')),
  screen text,
  xp_gained integer not null,
  at timestamptz not null,
  attempt_id text references safespace.drill_attempts (id),
  provider_id text,
  unscored_reason text,
  practice_source_key text unique,
  acknowledged_at timestamptz
);
create unique index drill_results_attempt_idx
  on safespace.drill_results (attempt_id) where attempt_id is not null;
create index drill_results_pending_idx
  on safespace.drill_results (user_id, seq) where practice = false and acknowledged_at is null;

create table safespace.consent_events (
  id bigint generated always as identity primary key,
  user_id text not null references safespace.users (id),
  type text not null,
  channel text not null,
  at timestamptz not null
);
create index consent_events_user_id_idx on safespace.consent_events (user_id);

-- subject_key is a keyed digest, never a raw phone number, email or address.
create table safespace.rate_limit_hits (
  id bigint generated always as identity primary key,
  scope text not null,
  subject_key text not null,
  hit_at timestamptz not null
);
create index rate_limit_hits_lookup_idx
  on safespace.rate_limit_hits (scope, subject_key, hit_at);

create table safespace.tactic_cards (
  id text primary key,
  card jsonb not null,
  fetched_at timestamptz not null
);

alter table safespace.users enable row level security;
alter table safespace.sessions enable row level security;
alter table safespace.drill_attempts enable row level security;
alter table safespace.drill_results enable row level security;
alter table safespace.consent_events enable row level security;
alter table safespace.rate_limit_hits enable row level security;
alter table safespace.tactic_cards enable row level security;
