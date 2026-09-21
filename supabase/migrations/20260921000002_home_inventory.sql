-- Coins and furniture, previously kept only in the browser's localStorage, now also
-- live on the account so a player sees the room they built on any device.
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

alter table safespace.users
  add column home_inventory jsonb;
