-- Turn-based house drills played across every member's own phone. One row per game;
-- players, turn order and answers live in `state`. `status` is a column so the
-- one-live-game-per-house rule can be checked under the house row lock.
create table safespace.house_drills (
  id text primary key,
  house_id text not null references safespace.houses (id) on delete cascade,
  host_id text references safespace.users (id) on delete set null,
  status text not null check (status in ('lobby', 'playing', 'finished', 'cancelled')),
  state jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index house_drills_house_created_idx on safespace.house_drills (house_id, created_at desc);
alter table safespace.house_drills enable row level security;
