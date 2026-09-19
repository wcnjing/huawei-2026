-- Houses: optional groups of up to 6 players (sub-project 2).
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

create table safespace.houses (
  id text primary key,
  name text not null check (char_length(name) between 1 and 30),
  owner_id text not null references safespace.users (id),
  -- Null when there is no live code. The alphabet has no 0/O/1/I/L.
  invite_code text unique check (invite_code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  invite_expires_at timestamptz,
  -- Random Realtime topic. Knowing it is what lets a client hear the doorbell.
  doorbell text not null unique,
  created_at timestamptz not null default now(),
  check ((invite_code is null) = (invite_expires_at is null))
);

alter table safespace.users
  add column house_id text references safespace.houses (id) on delete set null,
  add column joined_house_at timestamptz,
  add column avatar jsonb;
create index users_house_id_idx on safespace.users (house_id) where house_id is not null;

-- One row per finished house drill. Only the first run of a week earns XP.
create table safespace.drill_runs (
  id text primary key,
  user_id text not null references safespace.users (id),
  client_key text not null check (char_length(client_key) between 1 and 200),
  correct integer not null check (correct >= 0),
  cautious integer not null check (cautious >= 0),
  wrong integer not null check (wrong >= 0),
  xp_gained integer not null check (xp_gained >= 0),
  at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index drill_runs_user_at_idx on safespace.drill_runs (user_id, at);

-- "Safe this week" and "active this week" read results by user and time.
create index drill_results_user_at_idx on safespace.drill_results (user_id, at);

alter table safespace.houses enable row level security;
alter table safespace.drill_runs enable row level security;
