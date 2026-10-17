-- Which drill a real email drill sent: 'generated' for copy written from a scam variant
-- (server/email-writer.js), otherwise the allow-listed template id. Null for calls, SMS
-- and attempts sent before this column existed.
alter table safespace.drill_attempts add column scenario_id text;
