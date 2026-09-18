-- The demo family that visitors who are not logged in see. This is a migration rather
-- than supabase/seed.sql because the CLI applies seed.sql only to local databases, and
-- production needs these rows too. Re-runnable: the test helper replays it after
-- truncating. Explicit created_at values keep the family in this order.
insert into safespace.users (
  id, name, role, consent_to_drills, level, xp, xp_max, streak, times_safe,
  times_scammed, primary_color, badge_count, badge_total, room_name, room_bg,
  safe_this_week, recent_drill_result, created_at
) values
  ('you', 'YOU', 'ROOKIE', true, 4, 890, 1200, 3, 12, 2, '#00ff88', 2, 9,
   'YOUR ROOM', '#0c1a10', true, 'WON', '2026-01-01T00:00:00Z'),
  ('grandma', 'GRANDMA', 'ELDER GUARDIAN', true, 12, 3800, 4000, 24, 89, 1, '#c77dff', 7, 9,
   'GRANDMA''S ROOM', '#100c20', true, 'WON', '2026-01-01T00:00:01Z'),
  ('mum', 'MUM', 'SHIELD BEARER', true, 9, 2100, 2500, 16, 67, 2, '#00ff88', 5, 9,
   'MUM''S ROOM', '#0c1a10', true, 'WON', '2026-01-01T00:00:02Z'),
  ('dad', 'DAD', 'ROOKIE', true, 4, 890, 1200, 0, 23, 7, '#4ecdc4', 2, 9,
   'DAD''S ROOM', '#081420', false, 'LOST', '2026-01-01T00:00:03Z')
on conflict (id) do nothing;
