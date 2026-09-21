create table safespace.chat_messages (
  id bigint generated always as identity primary key,
  house_id text not null references safespace.houses(id) on delete cascade,
  sender_id text references safespace.users(id) on delete set null,
  sender_name text not null,
  sender_avatar jsonb,
  client_key text not null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (house_id, sender_id, client_key)
);
create index chat_messages_house_id_idx on safespace.chat_messages(house_id, id);
alter table safespace.chat_messages enable row level security;
