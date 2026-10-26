-- The back-and-forth of an SMS drill (server/sms-reply.js). Each element is
-- { role: 'target' | 'scammer', text, at }, appended as the exchange happens, so the
-- reply writer has context and the turn cap can be enforced across serverless
-- invocations. Null for every other channel and for texts sent before this column.
alter table safespace.drill_attempts add column sms_turns jsonb;
