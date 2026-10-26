-- The app language a drill was sent in. Needed where there is no request to read it
-- from: an inbound SMS reply (server/sms-reply.js) must answer and reveal in the same
-- language as the bait, and until now that was only recoverable from `lesson`, which is
-- null whenever a curated scenario was sent instead of AI-written copy.
-- Null for drills sent before this column existed; those fall back to English.
alter table safespace.drill_attempts add column language text;
