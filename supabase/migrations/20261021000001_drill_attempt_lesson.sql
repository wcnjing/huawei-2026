-- The lesson an email drill teaches (scam type, red flags, advice), written in the
-- player's app language alongside the email (server/email-writer.js), so the reveal and
-- report pages and Pixi show it in that language. Null for other drills, and for emails
-- sent before this column existed (those fall back to the English bulletin text).
alter table safespace.drill_attempts add column lesson jsonb;
