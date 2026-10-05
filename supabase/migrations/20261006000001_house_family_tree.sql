-- One shared family tree per house that every member can edit (server/family-rules.js).
-- Until a house's tree is first saved it's built from the members' old per-member
-- placements in house_members.family_link, which are left in place for older builds.
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

alter table safespace.houses
  add column if not exists family_tree jsonb;
