-- The Supabase scam_variants.id an email drill was written from, so the reveal and
-- report pages and Pixi teach about the same real scam (server/scam-variants.js).
-- Plain text, not a foreign key: scam_variants lives outside the safespace schema.
alter table safespace.drill_attempts add column scam_variant_id text;
