# House Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-memory House Chat with persistent private messages, live updates, history paging, and reliable retries between current house members.

**Architecture:** Express authorizes every request against Postgres house membership. Messages commit before a content-free Supabase doorbell tells browsers to fetch updates; visible chat polls every five seconds as a fallback. A focused client controller owns paging and delivery state, with a React hook and accessible chat screen above it.

**Tech Stack:** Existing Node >=22.9, Express, Postgres/PGlite, Supabase Realtime, React 18, TypeScript, node:test, esbuild. No new production dependencies.

**Spec:** `docs/superpowers/specs/2026-09-21-house-chat-design.md` (approved in conversation).

## Global Constraints

- One private, text-only conversation per house.
- New members may read all earlier house messages.
- Open with the latest 50 messages; provide **Load older messages**.
- Messages are limited to 1,000 characters (Unicode code points after normalization).
- Show Sending, Sent, and Failed states and provide Retry without duplicate messages.
- Every read and send requires current house membership.
- Shared chat contains messages from house members only.
- Limit new messages to 20 per account per rolling minute.
- Pause polling when the document is hidden or chat is closed.
- Network requests have a bounded 15-second timeout.
- Chat bodies and pending messages are not stored in localStorage or a service-worker cache.
- Access revocation is immediate at the server's transaction boundary; disconnected clients clear cached views on their next membership event or authorization check.
- Keep existing room/furniture behavior and other drill/reward/notification flows intact.
- No real chat messages, live provider drills, production migrations or deployment during validation.

---

## File map and execution order

1. Database/domain: migration, `server/chat.js`, membership helper in `server/houses.js`, `server/chat.test.mjs`, test DB lifecycle.
2. HTTP: thin routes in `server/index.js`, isolated `server/chat-routes.test.mjs`.
3. Client state: `src/app/chat-state.ts`, `src/app/chat-controller.ts`, `src/app/chat.ts`, `server/chat-client.test.mjs`.
4. UI/realtime: `src/app/HouseChatScreen.tsx`, `src/app/chat.css`, `src/app/house.ts`, minimal App wiring, browser checks.
5. Regression/rollout documentation: README, backend API guide, TESTPLAN, full checks.

The pure client state/controller split refines the approved `chat.ts` boundary so concurrency behavior can be tested without a React test dependency. `chat.ts` remains the public hook/API entry point.

Before execution, read the spec and repository instructions, check `git status`, and use the git-worktrees skill if isolation is needed. Do not lose or amend unrelated user commits. Use one worktree for the feature, not one per task. Run the red/green steps in order and commit only the named task files.

## Task 1: Persist messages under current membership

**Files**
- Create `supabase/migrations/20260921000001_house_chat.sql` (confirm version unused).
- Create `server/chat.js`, `server/chat.test.mjs`.
- Modify `server/houses.js` around `lockOwnHouse`; `server/testdb.mjs` table list.

**Interfaces**
- Consumes `transaction(callback)`, `query(sql, params)` from `server/db.js`; `lockUser`, `lockRateLimits`, `recordRateLimitHits`, `retryAfterForWindow` from `server/store.js`; `cleanAvatar`, `DEFAULT_AVATAR` from `server/avatar.js`.
- Produces `lockHouseMember(tx, userId, expectedHouseId?) -> Promise<{house,user}>` from houses; existing house mutations retain their current errors and behavior.
- Produces `ChatError(code, retryAfterMs = 0)`, `normalizeText(value) -> string`, `parseCursors({before,after}) -> {before?:string,after?:string}`.
- Produces `listMessages(userId, houseId, cursors = {}) -> Promise<{houseId,messages,hasMore}>`.
- Produces `sendMessage(userId, houseId, {text,clientKey}, {now = new Date()} = {}) -> Promise<{message,created,topic}>`.
- `message` fields: string `id`, `houseId`, nullable `senderId`, `senderName`, validated `senderAvatar`, `text`, ISO `createdAt`, `clientKey`.

- [ ] **1. Write the first failing domain test and fixture.** Use the existing test database lifecycle, real account registration, and real house creation. Put the fixture in this test file so each test is independent.

```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setupTestDb, resetDb, teardownTestDb } from './testdb.mjs';
process.env.IDENTITY_LOOKUP_SECRET = 'chat-test-identity-secret-at-least-32-characters';
await setupTestDb();
after(teardownTestDb);
const { registerVerifiedUser } = await import('./store.js');
const houses = await import('./houses.js');
const chat = await import('./chat.js');
async function fixture() {
  await resetDb();
  const owner = await registerVerifiedUser({ phone: '+6593330001', name: 'Alice' });
  const other = await registerVerifiedUser({ phone: '+6593330002', name: 'Bob' });
  const { houseId } = await houses.createHouse(owner.id, 'Chat Test');
  const code = (await houses.getHouseView(owner.id)).house.inviteCode;
  return { owner, other, houseId, code };
}
test('new members read messages sent before they joined', async () => {
  const { owner, other, houseId, code } = await fixture();
  const sent = await chat.sendMessage(owner.id, houseId, { text: 'Hello Bob', clientKey: randomUUID() });
  await assert.rejects(() => chat.listMessages(other.id, houseId), { code: 'CHAT_ACCESS_DENIED' });
  await houses.joinHouse(other.id, code);
  assert.equal((await chat.listMessages(other.id, houseId)).messages[0].id, sent.message.id);
});
```

- [ ] **2. Run the test red.** `node --test server/chat.test.mjs` must fail because the chat module is absent, not because of an unrelated environment failure.
- [ ] **3. Add the migration and shared locking helper.** Insert `chat_messages` before houses/users in the test table list. Export the existing helper under `lockHouseMember`, with an optional expected house argument; reject a mismatch before reading message rows. Keep a private `lockOwnHouse` wrapper for existing callers if that minimizes the diff. Recheck the user's house under lock. Convert `NOT_IN_HOUSE` to `CHAT_ACCESS_DENIED` only at the chat boundary.

```sql
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
```

Implement the membership extension using the current helper's exact body:

```js
export async function lockHouseMember(tx, userId, expectedHouseId) {
  const houseId = await unlockedHouseId(tx, userId);
  if (!houseId || (expectedHouseId !== undefined && houseId !== expectedHouseId)) {
    throw new HouseError('NOT_IN_HOUSE');
  }
  const house = await lockHouse(tx, houseId);
  const user = await lockUser(tx, userId);
  if (!house || !user || user.houseId !== house.id) throw new HouseError('NOT_IN_HOUSE');
  return { house, user };
}
```

- [ ] **4. Implement validation and explicit row serialization.** Normalize CRLF, reject controls and unpaired surrogates, then trim and count code points. Accept canonical UUID syntax, case-normalizing UUIDs to lowercase before storage. Cursors must match `/^[1-9][0-9]{0,18}$/`, fit signed bigint `<=9223372036854775807n`, and not appear together; arrays and repeated query fields are invalid. Serialize `String(row.id)` and `new Date(row.created_at).toISOString()`. Use `cleanAvatar(user.avatar) ?? DEFAULT_AVATAR` at send time.

```js
export function normalizeText(value) {
  if (typeof value !== 'string') throw new ChatError('INVALID_MESSAGE');
  const body = value.replace(/\r\n/g, '\n');
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(body)
      || /[\uD800-\uDFFF]/u.test(body)) throw new ChatError('INVALID_MESSAGE');
  const text = body.trim();
  if (!text || Array.from(text).length > 1000) throw new ChatError('INVALID_MESSAGE');
  return text;
}
```

- [ ] **5. Implement transactional history and sending.** History locks membership, uses `id::text`, fetches 51 rows with the appropriate bound, takes 50, then reverses descending pages. Dynamic SQL direction/operator strings must come from validated branches, never user input. Sending locks `{scope:'house_chat_send',subject:userId}` first, then membership; looks up the idempotency key; checks the 20/minute quota only for a new message; inserts the server-derived snapshot and records the hit in the same transaction. Return the topic, without calling Supabase inside the transaction.

```js
// The query shapes inside listMessages; choose only these fixed fragments.
const ascending = after !== undefined;
const bound = after ?? before;
const clause = bound ? `and id ${ascending ? '>' : '<'} $2::bigint` : '';
const result = await tx.query(
  `select id::text, house_id, sender_id, sender_name, sender_avatar,
          client_key, body, created_at
     from safespace.chat_messages where house_id = $1 ${clause}
     order by id ${ascending ? 'asc' : 'desc'} limit 51`,
  bound ? [house.id, bound] : [house.id],
);
const rows = result.rows.slice(0, 50);
if (!ascending) rows.reverse();
```

- [ ] **6. Add domain tests for duplicates, limits, paging and membership transitions.** Each test starts with `fixture()`. Generate 125 sends with increasing injected timestamps spaced 3,001 ms apart to remain below the quota. Assert last-page length 50, next older length 50, final older length 25, and forward catch-up retrieves all IDs exactly once. Tie timestamps for a small separate set to prove ID ordering. Add the following retry regression, then cover changed-text 409, 21st new send rejection, exact retry after quota exhaustion, and quota expiry at 60,001 ms.

```js
test('concurrent retries create one row and preserve the original response', async () => {
  const { owner, houseId } = await fixture();
  const input = { text: 'One message', clientKey: randomUUID() };
  const replies = await Promise.all(Array.from({ length: 4 }, () => chat.sendMessage(owner.id, houseId, input)));
  assert.equal(new Set(replies.map(r => r.message.id)).size, 1);
  assert.equal(replies.filter(r => r.created).length, 1);
  assert.equal((await chat.listMessages(owner.id, houseId)).messages.length, 1);
  await assert.rejects(() => chat.sendMessage(owner.id, houseId, { ...input, text: 'Changed' }), { code: 'MESSAGE_KEY_REUSED' });
});
```

For leave/remove, join Bob, save Alice's message, remove Bob, and assert Bob's GET and POST fail while Alice's history remains. For house switching, create Bob a new house and assert the old expected-house route fails. Leave the last member and query that house's message count to confirm cascade deletion. For a real-Postgres race, hold a house row lock in transaction A, launch send/removal promises in both orders, release A, and assert either a committed authorized send before removal or `CHAT_ACCESS_DENIED` after removal—never an unauthorized row. Use the real Postgres runner for true multi-connection coverage; do not claim PGlite proves it.

- [ ] **7. Run green and commit.** `node --test server/chat.test.mjs server/houses.test.mjs` must pass. Stage the five named files and commit `feat(chat): persist authorized house messages`.

## Task 2: Expose authenticated chat endpoints

**Files:** Modify `server/index.js`; create `server/chat-routes.test.mjs`.

**Interfaces:** Consume Task 1 functions and existing `requireUserId`, `api.get/post`, `ring`, `fail`. Produce GET and POST `/api/houses/:houseId/chat/messages` with the spec's response shapes. POST returns `{message}` with 201 for new rows and 200 for exact retries.

- [ ] **1. Write a failing HTTP test using a real ephemeral Express listener.** In the new test file, run `setupTestDb` before importing the app, disable provider configuration/dev verification, create Alice/Bob with `registerVerifiedUser`, create sessions with `createSession`, and create/join through the domain functions. Register listener cleanup and database teardown. Define `base`, `ownerToken`, `outsiderToken`, and `houseId` in that fixture before these assertions:

```js
const path = `${base}/api/houses/${houseId}/chat/messages`;
assert.equal((await fetch(path)).status, 401);
assert.equal((await fetch(path, { headers: { authorization: `Bearer ${outsiderToken}` } })).status, 403);
const headers = { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' };
const input = { text: '<script>hello</script>', clientKey: crypto.randomUUID() };
const first = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
assert.equal(first.status, 201);
const again = await fetch(path, { method: 'POST', headers, body: JSON.stringify(input) });
assert.equal(again.status, 200);
assert.deepEqual(await first.json(), await again.json());
assert.equal((await fetch(path, { method: 'POST', headers, body: JSON.stringify({ ...input, senderId: 'victim' }) })).status, 400);
```

- [ ] **2. Run red.** `node --test server/chat-routes.test.mjs` fails on missing endpoints.
- [ ] **3. Wire routes and a small error mapper.** Reject POST bodies unless they are non-array objects with exactly `text` and `clientKey`. The error mapper uses the mapping below and sets `Retry-After = Math.ceil(retryAfterMs/1000)` for 429. Unexpected errors go through `fail(res,500,'Could not load/send messages.',error)` without message content. GET uses explicit `before`/`after`; POST awaits `ring([result.topic])` after the domain transaction returns.

```js
const chatStatuses = {
  CHAT_ACCESS_DENIED: 403, INVALID_MESSAGE: 400, INVALID_CLIENT_KEY: 400,
  INVALID_CURSOR: 400, MESSAGE_KEY_REUSED: 409, CHAT_RATE_LIMITED: 429,
};
// The route uses this after requireUserId succeeds:
const result = await sendMessage(userId, req.params.houseId, req.body);
await ring([result.topic]);
return res.status(result.created ? 201 : 200).json({ message: result.message });
```

- [ ] **4. Expand HTTP tests.** Check 400 for arrays, both cursors, duplicate cursor parameters, out-of-range bigint and missing fields; expired sessions return 401; every response is no-store; 429 has Retry-After. Intercept only the test Supabase broadcast URL, delegating local HTTP to native fetch as in `routes.test.mjs`; verify payload `{}` and simulate a rejected broadcast, asserting POST still returns 201 and history contains the message. Compare returned keys to the documented allowlist and ensure no phone/email fields appear.
- [ ] **5. Run green and commit.** `node --test server/chat-routes.test.mjs server/routes.test.mjs server/doorbell.test.mjs`; commit the two named files as `feat(chat): add authenticated history and send endpoints`.

## Task 3: Build and test client delivery state

**Files:** Create `src/app/chat-state.ts`, `src/app/chat-controller.ts`, `src/app/chat.ts`, `server/chat-client.test.mjs`.

**Interfaces**

```ts
// chat-state.ts; Avatar is a type-only import from house.ts.
type ChatMessage = {
  id: string; houseId: string; senderId: string | null; senderName: string;
  senderAvatar: Avatar; text: string; createdAt: string; clientKey: string;
};
type PendingMessage = {
  clientKey: string; houseId: string; senderId: string; text: string;
  createdAt: string; status: 'sending' | 'failed'; error: string | null;
  retryAt: number;
};
type ChatPage = { houseId: string; messages: ChatMessage[]; hasMore: boolean };
type ChatSnapshot = {
  messages: ChatMessage[]; pending: PendingMessage[];
  loading: boolean; loadingOlder: boolean; hasOlder: boolean;
  error: string | null; olderError: string | null; accessDenied: boolean;
};
type ChatTransport = {
  get(houseId: string, cursor: {before?: string; after?: string}, signal: AbortSignal): Promise<ChatPage>;
  post(houseId: string, input: {text: string; clientKey: string}, signal: AbortSignal): Promise<{message: ChatMessage}>;
};
// chat-controller.ts, a store whose snapshots change identity only on updates.
createChatController(options: {
  houseId: string; selfId: string; transport: ChatTransport;
  onAccessDenied(): void; uuid(): string; now(): number;
}): {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ChatSnapshot;
  refresh(): Promise<void>; loadOlder(): Promise<void>;
  send(text: string): boolean; retry(clientKey: string): void;
  dispose(): void;
};
// chat.ts
useHouseChat(options: {
  houseId: string | null; selfId: string | null; sessionKey: string | null;
  active: boolean; changeRevision: number; onAccessDenied(): void;
}): ChatSnapshot & {
  send(text: string): boolean; retry(clientKey: string): void;
  refresh(): Promise<void>; loadOlder(): Promise<void>;
};
```

`sessionKey` stays in memory only, is not rendered/logged, and changes when the bearer token changes. Missing identity returns a constant empty snapshot. Export the listed types and functions. `chat-state.ts` also exports `mergeMessages(existing,incoming)` and `normalizeDraft(text)` with the same normalization/length/control rules as the server.

- [ ] **1. Write failing state/controller tests.** Bundle TypeScript test targets using the existing esbuild approach (`buildSync({entryPoints:[...],bundle:true,write:false,platform:'node',format:'esm'})`), then import the resulting data URL. Test targets exclude the React hook. Use fake transports and manually resolved promises instead of real timers. Define messages and verify IDs larger than Number.MAX_SAFE_INTEGER:

```js
const message = (id, text = id, clientKey = id) => ({
  id, text, clientKey, houseId: 'h1', senderId: 'u1', senderName: 'Alice',
  senderAvatar: { color:'#4ecdc4',glow:'#00ff88',hat:'None',eyes:'Default',outfit:'Standard' },
  createdAt: '2026-09-21T00:00:00.000Z',
});
assert.deepEqual(
  mergeMessages([message('9007199254740993')], [message('9007199254740992'),message('9007199254740993')]).map(m=>m.id),
  ['9007199254740992','9007199254740993'],
);
```

- [ ] **2. Run red.** `node --test server/chat-client.test.mjs` fails because modules are absent.
- [ ] **3. Implement pure merging and controller state.** Merge server messages by ID, sort using BigInt comparisons, remove optimistic rows only when `(houseId,senderId,clientKey)` matches. Deduplicate pending Retry clicks. POST completion updates message state but never the GET high-water cursor. Initial empty history has a null cursor and continues requesting latest until a GET sees messages; POST alone never marks history initialized.

```ts
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0);
}
```

Keep `afterCursor`, `oldestCursor`, first-page history metadata, abort controllers, and a disposed flag separate from optimistic messages. A refresh requested while busy sets a `refreshAgain` flag. For catch-up, drain `hasMore` pages, advancing only to the last fetched ID; refreshAgain triggers another pass before idle. Loading older pages changes only oldestCursor/hasOlder. If any access check fails, clear state and abort all other requests before notifying App. Guard every post-await continuation against disposal, including errors and finally blocks.

- [ ] **4. Implement transport and hook.** Use fetch directly rather than `apiGet` (it loses status/error details). Capture the expected bearer token in the transport; timeout each request after 15,000 ms and clear its timer/listener in finally. Define `ChatRequestError` with `status`, `retryAt`, and public `message`. On 401 call `handleApiAuth` only if the captured token still equals the current token, preventing a late old-session response from signing out a newer session. On 403 invoke the controller's access-denied path. Render 429 as a failed optimistic row with retryAt computed from Retry-After.

```ts
const response = await fetch(`/api/houses/${encodeURIComponent(houseId)}/chat/messages${query}`, {
  method, headers: { authorization: `Bearer ${capturedToken}`, 'content-type': 'application/json' },
  body: input === undefined ? undefined : JSON.stringify(input), signal: requestController.signal,
  cache: 'no-store',
});
```

Use `useSyncExternalStore` for controller snapshots, creating/disposing the controller when session/player/house changes. Keep it mounted in App while chat is closed so failed rows remain available on return. Revalidate on entering chat, revision changes, focus, and visible `visibilitychange`. Install the 5,000 ms timer only while active and visible; pause hidden requests except already initiated sends. Reopening refreshes without throwing away older loaded messages. Account changes clear state synchronously by selecting the new controller, not one render after an effect.

- [ ] **5. Add deterministic controller regressions.** Assert POST delivered after GET and GET delivered after POST each produce one bubble; a failed POST retries with the same key; a pending own ID 103 cannot make refresh skip others' IDs 101/102; forward pages of 50/50/25 all appear; older-history failure preserves current messages; a queued refresh runs after the in-flight request; disposal ignores a late successful or failed response; 403 clears pending/saved rows and calls onAccessDenied once. Create response promises using a small `deferred()` helper inside this test file:

```js
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
```

- [ ] **6. Run green and commit.** `node --test server/chat-client.test.mjs` and `npm run typecheck`; commit the four named files as `feat(chat): implement resilient client message state`.

## Task 4: Connect the chat screen and realtime events

**Files:** Create `src/app/HouseChatScreen.tsx`, `src/app/chat.css`; modify `src/app/house.ts`, `src/app/App.tsx`. Create a reusable dev-only browser check `scripts/check-house-chat.mjs` without adding production routes. Use the available browser automation runtime, or add a dev-only Playwright dependency only if no supplied runtime is available.

**Interfaces:** Consume Task 3 hook. `useHouse` additionally returns `changeRevision: number`. Screen props are `{chat, selfId, selfName, houseName, hasHouse, identityKey, onBack, onJoinHouse, renderAvatar}` where chat is `ReturnType<typeof useHouseChat>`, renderAvatar accepts `(avatar: Avatar) => ReactNode`, and identityKey is a non-secret player/house identity string. Component key changes with authenticated session as well, using an internal epoch rather than exposing token values.

- [ ] **1. Record failing two-browser acceptance checks against the old local screen.** Run a local isolated backend with `PGLITE_DIR=memory://` and no provider credentials. Start two browser contexts with synthetic users/sessions created by a dev-only launcher importing the actual store/house modules in the same process as Express. Bind it only to 127.0.0.1; inject tokens into test contexts, not URLs or output. Vite proxies to that local server. Assert Bob receives Alice's message, reload retains it, and removing Bob prevents further access. The baseline fails shared delivery. Do not add any authentication bypass to application code.

```js
await alice.getByRole('textbox', { name: 'Message' }).fill('Hello from Alice');
await alice.getByRole('button', { name: 'Send', exact: true }).click();
await bob.getByText('Hello from Alice', { exact: true }).waitFor({ timeout: 10000 });
await bob.reload();
// Navigate through PRESS START and Open house chat after the normal reload.
await bob.getByRole('button', { name: '[ PRESS START ]', exact: true }).click();
await bob.getByRole('button', { name: 'Open house chat' }).click();
await bob.getByText('Hello from Alice', { exact: true }).waitFor();
```

- [ ] **2. Expose notification revision without a second subscription.** Increment on `changed` and Supabase `SUBSCRIBED`, and keep refreshing house membership as before. Ensure old house subscription callbacks and in-flight house fetches cannot overwrite state after the authenticated identity changes; pass a session identity into `useHouse` if required, abort or discard stale fetches, and preserve existing callers/tests.

```ts
const [changeRevision, setChangeRevision] = useState(0);
const notify = () => { setChangeRevision(value => value + 1); void refresh(); };
// In the existing channel chain:
.on('broadcast', { event: 'changed' }, notify)
.subscribe(status => { if (status === 'SUBSCRIBED') notify(); });
```

- [ ] **3. Implement the screen.** Use a scrollable history region above a fixed-in-flow multiline composer. Full sender names and snapshots are visible; group by local date and format timestamps with Intl.DateTimeFormat. Use `white-space: pre-wrap` and `overflow-wrap: anywhere` for text. Own-message detection compares senderId to selfId. Render server text only as React text nodes. Pending rows show Sending or Failed/Retry; server-confirmed own rows show Sent. Each retry button is disabled until retryAt, with a one-second display timer only while a cooldown is active.

```tsx
<label htmlFor="chat-message">Message</label>
<textarea id="chat-message" value={draft}
  onChange={event => setDraft(event.target.value)}
  onKeyDown={event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (chat.send(draft)) setDraft('');
    }
  }} />
<button disabled={!validDraft} onClick={() => { if (chat.send(draft)) setDraft(''); }}>Send</button>
```

Compute validDraft with normalizeDraft; show a code-point count rather than textarea maxLength (UTF-16). Disable the composer on missing membership/accessDenied; show Create or join a house. Preserve draft when send returns false. Clear draft on identity/access changes. Status live regions summarize delivery/errors, not the whole history. Honor reduce motion when scrolling. Before prepending history save scrollHeight/scrollTop and restore the difference in a layout effect; do not also auto-scroll to bottom. Use a bottom-distance threshold of 80 px for arrival scrolling and a New messages button when above it.

- [ ] **4. Wire App and remove obsolete chat-only state.** Call the hook unconditionally with current self/house/session and `screen === 'family-chat'`; onAccessDenied triggers `house.refresh()`. Pass `PixelMascot` configured from each saved avatar via renderAvatar. Delete `ChatMsg`, `INITIAL_CHAT`, `FamilyChatScreen`, chatMessages/CHAT_CAP/appendChatMessage, and PIXI chat emitter functions/calls. Retain PIXI avatar or constants if other screens still reference them. Retain `nowTimeString` if used outside the removed emitters. Confirm drill-result, coin and notification code is not deleted along with chat-only calls.

```tsx
<HouseChatScreen chat={chat} selfId={selfId} selfName={profile.name}
  houseName={house.state.house?.name ?? ''} hasHouse={!!house.state.house}
  identityKey={`${selfId}:${house.state.house?.id ?? ''}`}
  onBack={goHome} onJoinHouse={() => setScreen('house')}
  renderAvatar={avatar => <PixelMascot size={28} color={avatar.color}
    hat={avatar.hat} eyes={avatar.eyes} outfit={avatar.outfit} />} />
```

- [ ] **5. Run browser checks and fix actual layout/state issues.** Test both contexts sending; earlier history after a third player joins; removed/solo player states; Enter/Shift+Enter/IME; literal HTML; failed POST Retry; older-history anchoring; a >100-message catch-up; no unexpected jumps while reading older rows. Verify polling with realtime absent and trigger controlled notification/reconnection callbacks without sending real external broadcasts. Check 320 × 844 with 20% larger text and desktop. Assert no horizontal overflow, missing message duplicates, reward changes, PIXI chat rows, runtime errors, or requests to a previous house after switching. Check hidden/closed chat does not poll. Capture and inspect screenshots.
- [ ] **6. Run green and commit.** `npm run typecheck`, `npm run build`, `node --test server/chat-client.test.mjs server/houses.test.mjs`; commit the named frontend/check files as `feat(chat): connect live house conversation UI`.

## Task 5: Regression verification and rollout notes

**Files:** Modify `server/README.md`, `README.md`, `TESTPLAN.md`; fix only defects revealed by this feature's checks.

**Interfaces:** No API changes beyond the approved contracts. Document session-only message drafts and the existing Supabase configuration.

- [ ] **1. Add manual acceptance cases and API documentation.** Include the two routes, cursor directions, response fields, 1,000-code-point limit, 20/minute rate limit, HTTP statuses, Retry-After, history visibility for new members, removal semantics, retry behavior, and no PIXI messages. Document migration-first deployment and no new credentials. Make explicit that old in-memory messages cannot be recovered or migrated.

```text
Manual acceptance: Create a house with Alice and Bob in separate browsers.
Alice sends a message; Bob receives it, replies, and reloads without losing it.
Join Charlie and confirm Alice's earlier message is visible.
Remove Bob while his chat is open; he loses the composer and history on the next
membership check. His old request URLs return 403. Alice still sees prior messages.
Disconnect Alice's network during Send, reconnect, and Retry: exactly one row.
Disable realtime configuration locally: messages still arrive by visible polling.
```

- [ ] **2. Run final checks, inspecting every result.** Use the following commands; if a failure is environmental, report its concrete cause rather than claiming the check passed. Never connect tests to an existing production database.

```sh
npm run typecheck
npm run build
npm test
npm run test:pg
git diff --check
```

`test:pg` requires Docker and launches its own disposable Postgres 17 instance. If Docker is unavailable, retain PGlite results and explicitly report real-Postgres concurrency checks as not run. Rerun the two-context browser check against the final code after any fixes.

- [ ] **3. Review isolation and scope.** Inspect diffs for message content in broadcasts/logging/storage caches, sender identity overrides, unprotected membership reads, unsafe dynamic SQL, and unrelated room/drill changes. Verify any new public endpoint uses session authentication, all 401/403 paths clear current chat, and documentation matches behavior. Run the requesting-code-review skill at execution time and address actionable findings.
- [ ] **4. Commit documentation and finish with evidence.** Commit `docs(chat): document delivery and access behavior`. Report checks run, any unavailable Postgres/realtime checks, migration required for production, and local commit/worktree status. Do not deploy or push without applicable session authorization.

## Plan self-review

- Scope/data/permissions/persistence/retention: Task 1.
- API validation/session authentication/retry/rate limits/notification failures: Tasks 1–2.
- Ordering, pagination, duplicate reconciliation, identity races, timeouts and retry state: Task 3.
- Live delivery, focus/visibility fallback, screen behavior, accessibility, and PIXI removal: Task 4.
- Regression tests, two-browser validation, docs and rollout: Tasks 4–5.
- Interface names used between tasks are defined above. Public API errors and response shapes match the approved spec.

Execution has not started. Select subagent-driven execution or inline execution for the next step.
