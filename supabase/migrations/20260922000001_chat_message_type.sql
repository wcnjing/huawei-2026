-- House chat can now carry short event lines (a housemate finished a drill) alongside
-- ordinary messages. Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

alter table safespace.chat_messages
  add column type text not null default 'message'
    check (type in ('message', 'drill_finished'));
