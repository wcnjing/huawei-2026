-- Pre-survey answers (server/presurvey-store.js), read and written by the server through
-- the Data API with SUPABASE_PROD_SECRET_KEY (Supabase's service_role). Run ONCE in the
-- safespace-prod project's SQL editor. `safespace` must be listed under
-- Project Settings → Data API → Exposed schemas.
--
-- It lives outside supabase/migrations because it grants to service_role, which the local
-- PGlite database does not have. RLS is on with no policies, so the publishable/anon keys
-- cannot read it; only the secret key can.

create schema if not exists safespace;

-- One row per player. No foreign key to safespace.users: accounts created by a local
-- development server (its own database) still need somewhere to save their answers.
create table if not exists safespace.presurvey_responses (
  user_id text primary key,                            -- the SafeSpace account id
  age_range text not null default '',                  -- AGE RANGE
  situation text not null default '',                  -- CURRENT SITUATION
  activities text[] not null default '{}',             -- WHAT DO YOU REGULARLY DO?
  interests text[] not null default '{}',              -- WHAT WOULD YOU LIKE TO PRACTISE?
  channels text[] not null default '{call,sms,email}', -- HOW WOULD YOU LIKE TO PRACTISE?
  include_other_types boolean not null default true,   -- Occasionally show other scam types
  completed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table safespace.presurvey_responses enable row level security;

-- The server's secret key may use the schema and this one table. (Fixes
-- "permission denied for schema safespace" from the Data API.)
grant usage on schema safespace to service_role;
grant select, insert, update, delete on safespace.presurvey_responses to service_role;

-- Make the Data API notice the new table straight away.
notify pgrst, 'reload schema';

-- Check: should list the table's columns.
select column_name, data_type
  from information_schema.columns
 where table_schema = 'safespace' and table_name = 'presurvey_responses'
 order by ordinal_position;
