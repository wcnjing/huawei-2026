-- Family tree: each member places themself by naming a role and their links to other
-- members of the same house (parents, partner, children). Stored on the member's own
-- row so a player only ever edits their own placement; the tree is the union of all.
-- Ids that point at someone no longer in the house are ignored on read.
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

alter table safespace.users
  add column family_link jsonb;
