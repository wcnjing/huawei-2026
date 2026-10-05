-- Multiple houses per person (up to 3). Membership moves from users.house_id to a
-- house_members table; users.house_id stays as the house the player is currently
-- looking at (their "active" house), and must always be one of their memberships.
-- Family-tree placements are per house, so they move onto the membership row.
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

create table safespace.house_members (
  house_id text not null references safespace.houses (id) on delete cascade,
  user_id text not null references safespace.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  family_link jsonb,
  primary key (house_id, user_id)
);
create index house_members_user_idx on safespace.house_members (user_id);
alter table safespace.house_members enable row level security;

insert into safespace.house_members (house_id, user_id, joined_at, family_link)
  select house_id, id, coalesce(joined_house_at, created_at), family_link
    from safespace.users
   where house_id is not null
on conflict do nothing;

-- users.joined_house_at and users.family_link are no longer read or written; they are
-- left in place so older app builds pointed at this database keep working.
