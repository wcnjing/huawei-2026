alter table safespace.chat_messages
  drop constraint chat_messages_type_check;

alter table safespace.chat_messages
  add constraint chat_messages_type_check
  check (type in ('message', 'drill_scammed', 'pixi_message'));

-- System messages have no member sender id, so the normal per-sender unique key
-- cannot deduplicate retries. Keep Pixi event keys unique on their own.
create unique index chat_messages_pixi_client_key_idx
  on safespace.chat_messages(client_key)
  where type = 'pixi_message';
