# House chat backend

Date: 21 September 2026

Status: Design recorded for user review; implementation has not started.

## Approved scope

One private, text-only conversation per house. Messages persist in Postgres and
are available on other signed-in devices. New members may read all earlier house
messages. Use the existing Express backend and Supabase Realtime notification
mechanism, with polling as a fallback.

Open with the latest 50 messages; provide **Load older messages**. Messages are
limited to 1,000 characters. Show Sending, Sent, and Failed states and provide
Retry without duplicate messages. Every read and send requires current house
membership. Removed members and players who leave lose access. Shared chat
contains messages from house members only.

Attachments, editing, deletion controls, reactions, direct messages, typing
indicators, read receipts, push notifications, and shared PIXI messages are out
of scope. The room and furniture features are unrelated to this change.

## Existing implementation and approach

`src/app/App.tsx` currently owns an in-memory `ChatMsg[]`, a seeded PIXI greeting,
locally generated PIXI announcements, and `FamilyChatScreen`. Sending appends a
message with the synthetic sender ID `player`; refreshing discards the history.

The backend already supplies session authentication, Postgres/PGlite access,
house membership, transactional rate limits, and a content-free Supabase
"doorbell". The browser's `useHouse` subscribes to the house's random topic and
refreshes house state when it rings. Membership changes rotate that topic.

Reuse these facilities. Store and authorize messages through Express; never put
message text or sender details in a broadcast. Polling alone was rejected because
it delays delivery; a separate WebSocket service would add unnecessary hosting
and authentication infrastructure for houses of at most six members.

## Components and boundaries

- `server/chat.js`: text validation, membership-authorized history queries,
  idempotent sending, rate limits, and stable chat errors. Uses the database and
  the existing house locking convention. Returns the topic to notify after a
  successful transaction; does not perform network calls inside transactions.
- `server/houses.js`: expose a narrowly scoped transaction helper for checking
  and locking current membership, shared with chat. Preserve existing behavior
  and the lock order: rate-limit locks, house row, user row.
- `server/index.js`: thin authenticated GET/POST routes, response/error mapping,
  `Retry-After`, and post-commit doorbell notification.
- `src/app/chat.ts`: typed API calls plus `useHouseChat`; owns paging, refresh,
  optimistic sends, retries, request cancellation, and current-house isolation.
- `src/app/HouseChatScreen.tsx`: message list, composer, history controls,
  delivery states, and errors. Receives data/actions from the hook and small
  avatar-rendering callbacks from App; does not depend on App's internals.
- `src/app/house.ts`: expose an in-memory change revision incremented on a
  doorbell event and on successful realtime subscription/reconnection. Reuse
  its single existing subscription rather than subscribing twice to one topic.
- `src/app/App.tsx`: connect the screen to the authenticated player and house,
  pass avatar rendering and navigation, and remove obsolete local chat wiring.

Do not move unrelated screens or reorganize the entire App component. Remove
the seeded greeting and local PIXI chat emitters when replacing the old list;
retain the existing drill results, rewards, and notification flows.

## Data model

Add a forward-only plain Postgres migration:
`supabase/migrations/20260921000001_house_chat.sql`. Verify that its version is
still unused when implementation begins.

`safespace.chat_messages` contains:

| Column | Purpose |
| --- | --- |
| `id bigint generated always as identity primary key` | Stable ordering and paging cursor |
| `house_id text not null` | FK to houses, `ON DELETE CASCADE` |
| `sender_id text` | FK to users, `ON DELETE SET NULL` |
| `sender_name text not null` | Server-captured display name at send time |
| `sender_avatar jsonb` | Server-captured validated avatar at send time |
| `client_key text not null` | UUID identifying one user send intent |
| `body text not null` | Validated plain text, 1–1,000 Unicode code points |
| `created_at timestamptz not null default now()` | Server timestamp |

Add a unique constraint on `(house_id, sender_id, client_key)` and an index on
`(house_id, id)`. Enable RLS without anonymous/browser table policies, following
the existing schema's backend-only access pattern. There are no direct client
database reads or writes. Add the table to test reset/dump helpers.

Keep messages for the lifetime of their house. Leaving does not remove prior
messages; deleting an empty house removes its chat. Name/avatar snapshots keep
history readable when senders leave or change profiles. No phone numbers, email
addresses, session tokens, or private account fields appear in message records
or message responses. Do not log message bodies.

## API contract

Use an explicit expected house ID in both routes so a stale tab cannot silently
send a draft to a different house after its author changes houses:

### `GET /api/houses/:houseId/chat/messages`

Require a valid session and membership in this exact house. Support either
`before=<id>` or `after=<id>`, never both. Cursors are strictly validated positive
decimal bigint strings; preserve IDs as strings in JavaScript and JSON. Page
size is fixed at 50. Every query also filters by the authorized house ID.

- No cursor: fetch the latest 50 and return them in chronological order.
- `before`: fetch the nearest 50 older rows, also returned chronologically.
- `after`: fetch the earliest 50 newer rows in chronological order.

Return `{ houseId, messages, hasMore }`, where `hasMore` describes additional rows
in the requested direction. Fetch one extra row to calculate it. Each message
contains `{ id, houseId, senderId, senderName, senderAvatar, text, createdAt,
clientKey }`. Return only these explicit fields.

### `POST /api/houses/:houseId/chat/messages`

Accept `{ text, clientKey }`. Reject unexpected identity fields and derive the
sender, name, avatar, and house authorization
from the authenticated session and database. Require a UUID client key.

Normalize CRLF to LF and trim surrounding whitespace. Allow internal line breaks
and tabs; reject other C0 controls and DEL. Reject nonstrings, empty messages,
and messages above 1,000 Unicode code points after normalization. Enforce the
same character count in the composer. Render messages as plain React text;
do not interpret HTML, Markdown, or automatically turn URLs into links.

Within the transaction, obtain the account rate-limit lock, lock the expected
house then sender, and recheck membership. Check for an existing message with
the same key before consuming rate-limit allowance. Same key and same normalized
body returns the existing message with HTTP 200. Same key and different body
returns 409. A new message returns 201 and rings the current house topic after
commit. An exact retry may ring again to help recover from a lost notification.

Limit new messages to 20 per account per rolling minute using the existing
durable rate-limit helpers. Return 429 with `Retry-After`; exact retries do not
consume another allowance. This limit is server-side across tabs and devices.

### Membership and ordering

Authorize history reads and sends in a transaction under the house-then-user
locking convention used by leave/remove. Do not perform an unlocked membership
check followed by an unprotected query. A send serializes with membership changes
and with other sends in that house. Allocate its identity ID after obtaining the
house lock, so a later committed message in the same house cannot precede an
uncommitted lower-ID message and get skipped by `after` paging.

Unauthorized signed-out/expired requests return 401. A missing house or a caller
who is not currently a member receives the same 403 `CHAT_ACCESS_DENIED` response.
Invalid input/cursors return 400, reused keys with different content 409, rate
limits 429, and unexpected storage failures a generic 500. Preserve the API's
existing no-store caching headers. Broadcast failure never changes a committed
send into an error.

## Browser behavior and data flow

1. On opening chat with a known current house, load its latest messages. Without
   a house, show a create/join-house action instead of an active composer.
2. Display full sender names, their saved avatar, local timestamps and day
   separators. Determine which messages are yours by authenticated sender ID,
   not a client-supplied `isPlayer` flag.
3. Sending adds an optimistic row with a fresh UUID and Sending status. Clear
   the composer once the text is represented in that row, so the player may
   compose another message. Retain failed text in the row and offer Retry using
   its original UUID. Persisted messages remain visible while refresh fails.
4. Reconcile POST and GET results by server ID and client key; receiving the
   broadcast before the POST completes must not create duplicate bubbles. A
   send response must not advance the incremental fetch cursor past intervening
   messages from other players. Use a separate server-confirmed fetch cursor.
5. On a doorbell change, focus, successful realtime subscription/reconnection,
   or a five-second visible-chat timer, refresh the message stream. Start at the
   confirmed cursor and drain further pages while `hasMore` is true. Never drop
   the middle of a backlog by requesting only the latest page. Coalesce refreshes
   and queue one follow-up if a signal arrives during an in-flight request.
6. Loading older messages prepends one page and preserves scroll position.
   Refreshing does not discard loaded history. Scroll to new messages only when
   already near the bottom or after sending; otherwise show a New messages action.
7. Pause polling when the document is hidden or chat is closed. Trigger a catch-up
   on reopening. Show a reconnecting/error status based on actual requests;
   remove the current always-green fake online indicator. Network requests have
   a bounded 15-second timeout and cleanup via abort where supported.

The chat hook is keyed by session/player and house. Clear messages, composer,
pending/failed sends, and paging state when either changes or a 401/403 arrives;
refresh house state on 403. Discard late responses from the previous identity or
house using an epoch/request guard in addition to cancellation. No automatic
resend after membership changes. Chat bodies and pending messages are not stored
in localStorage or a service-worker cache; failed drafts survive only while the
current session's in-memory chat state remains mounted.

Access revocation is immediate at the server's transaction boundary. An offline
device cannot erase information it already displayed on command: the browser
clears chat on the next membership event, failed authorization response, or
refresh. With chat open and visible, fallback polling checks every five seconds.
This is the precise meaning of clearing chat after removal, not a guarantee of
remote deletion from disconnected devices.

## Failure handling and accessibility

Use explicit loading, empty-house, empty-history, send-failure and history-failure
states. Keep Retry local to the failed message. Honor `Retry-After` with a visible
wait state before another attempt. Older-history failures leave current messages
and scroll position intact and offer another load attempt.

Use a labelled multiline composer and Send button; Enter sends and Shift+Enter
adds a line break, while IME composition does not trigger send. Show a character
count, disable sending whitespace/over-limit text, and expose errors/status through
accessible live regions without rereading the entire conversation. Preserve the
app's text-size settings and test 320 px width and the larger-text option.

## Verification and acceptance

Backend tests run against the existing isolated PGlite setup, with the same tests
usable through the project's real-Postgres test runner:

- Latest/older/newer paging is ordered, disjoint, house-scoped, and complete,
  including histories exceeding 100 messages and timestamp ties.
- Signed-out users, outsiders, removed members and former members cannot read
  or send; a new member can load messages from before joining.
- Sender spoofing is rejected; text validation, Unicode limits, and malformed
  cursors behave as specified; markup is returned as inert text.
- Parallel retries with one key create one row; changed-body reuse returns 409;
  lost POST responses can be retried without another charge to the rate limit.
- Concurrent sends/removal and house switching follow the locking/access rules.
- Rate limits work across requests and expire; failed broadcasts preserve sends.
- Sender departure preserves history; deleting an empty house cascades messages.

Frontend checks cover out-of-order POST/GET completion, lost/duplicate signals,
missed-message catch-up, old-page scroll anchoring, retry/error states, identity
changes, and ignoring late responses. Browser validation uses two isolated
signed-in contexts to demonstrate delivery both ways, persistence across reload,
earlier history for a new member, removal handling, and polling without Supabase.
Verify that sending causes no rewards, drill results or PIXI announcements.

Run typecheck, production build, relevant tests, then the backend regression
suite because this touches shared auth/house transaction behavior. Run real
Postgres checks when its test runtime is available; report any unavailable check
explicitly. Do not send real user chat messages or invoke provider drills for QA.

## Delivery and rollout

Update backend API documentation and the manual test plan. Apply the new migration
through the project's existing deployment process; local PGlite migrates on start.
Supabase migrations and production deployment are not performed during design work.
Use the existing Supabase configuration; no new service or credentials are needed.
Where realtime is unconfigured, chat remains functional through visible polling.

Implementation begins only after the user reviews this written spec. The next
step is an implementation plan using the writing-plans skill.
