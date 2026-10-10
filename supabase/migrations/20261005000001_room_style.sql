-- Room look (wall colour, wallpaper, floor, light, glow, room name), previously kept only
-- in each phone's localStorage, now lives on the account so every member of the house
-- sees each other's room the way its owner decorated it.
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

alter table safespace.users
  add column if not exists room_style jsonb;
