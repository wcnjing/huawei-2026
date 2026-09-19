# Households Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players design a character, sign in with their phone and play solo; any player can create or join a house of up to 6 with a 24-hour code, and the house replaces the hardcoded grandma/mum/dad/kid family everywhere.

**Architecture:** A new migration adds `houses`, `drill_runs` and three `users` columns. House rules live in a new `server/houses.js` (one transaction per operation, lock order house → user), exposed through new Express routes. After each committed change the server rings a content-free Supabase Realtime broadcast ("doorbell"); the React app refetches `GET /api/house` on a ring, on focus and every 5 minutes. On the client, `src/app/api.ts` and `src/app/house.ts` hold the fetch helpers and the `useHouse()` hook; screens stay in `App.tsx`, reading members from a React context instead of the hardcoded `FAMILY_MEMBERS`.

**Tech Stack:** Node 22 + Express, Postgres (Supabase in production, PGlite in tests), `node:test`, React 18 + Vite 6 + TypeScript, `@supabase/supabase-js` 2.x (already a dependency).

**Spec:** `docs/superpowers/specs/2026-09-19-households-design.md`

## Global Constraints

- Every table lives in schema `safespace` with row-level security enabled and no policies.
- Schema changes go only in `supabase/migrations/`; the user applies them to production with `npx supabase db push`.
- No API response ever includes a phone number, email, email token or `phoneLookupHash`.
- Max 6 members per house. One house per person. Invite codes: 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, shown as `K7P-3QX`, valid 24 hours.
- Weeks start Monday 00:00 Asia/Singapore (UTC+8, no daylight saving).
- House drill XP per round: correct 100, cautious 50, wrong 25. Only a person's first run of the week earns XP.
- Avatar allowlist: color and glow `#4ecdc4 #ff6b35 #c77dff #ffe66d #ff2d55 #00ff88`; hat `None Cap Helmet Crown`; eyes `Default Shades Visor Goggles`; outfit `Standard Camo Neon Stealth`.
- Error `code` strings must be longer than 5 characters: `server/db.js` treats any 5-character uppercase `code` as a Postgres SQLSTATE and rewrites the error.
- The doorbell never fails a request, carries no data, times out after 2 seconds, and does nothing without `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.
- Player-facing copy says "house", never "family".
- Never run the app against the production database: the repo `.env` points at it. Local runs use `DOTENV_CONFIG_PATH=/dev/null` (Task 15).
- Tests: `node --test server/*.test.mjs` (PGlite) and `npm run test:pg` (real Postgres in Docker). Frontend: `npm run typecheck` and `npm run build`.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Work on branch `feat/houses`. Never push `main`; the user does.

## Spec clarifications made while planning

These refine the spec; update the spec in Task 16.

1. `GET /api/house` returns `{ self, house }`: `self` is the caller's own member view (so solo players get weekly flags too), `house` is null when solo.
2. `src/app/house.ts` holds logic only (types, API calls, `useHouse`, realtime). New screens go in `App.tsx`, next to the UI primitives (`PixelBtn`, `PixelMascot`, …) they use, to avoid an import cycle. Session helpers move to `src/app/api.ts`.
3. The race "removal during a drill run" is replaced by "last member leaves while someone joins", which exercises the house-deletion path; removal and drill runs touch disjoint rows.
4. The broadcast request sends the secret key in the `apikey` header only (new Supabase secret keys are not JWTs).
5. The Express CSP gains the Supabase origin in `connect-src` so the websocket works when Express serves the app.

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20260920000001_houses.sql` | new | houses, drill_runs, users columns, indexes, RLS |
| `server/avatar.js` | new | avatar allowlist and `cleanAvatar()` |
| `server/week.js` | new | `weekStart(now)` |
| `server/houses.js` | new | house rules, drill runs, house view, doorbell lookup |
| `server/doorbell.js` | new | Supabase Realtime broadcast |
| `server/rows.js` | modify | map `house_id`, `avatar` |
| `server/store.js` | modify | export shared helpers, `addXp`, `setUserAvatar`, sign-up changes; drop `getFamily`/`getLeaderboard` |
| `server/index.js` | modify | house routes, sign-up changes, no anonymous fallback, doorbell calls, CSP |
| `server/testdb.mjs` | modify | new tables in reset |
| `server/avatar.test.mjs`, `server/week.test.mjs`, `server/houses.test.mjs`, `server/doorbell.test.mjs` | new | unit and store tests |
| `server/routes.test.mjs`, `server/store.test.mjs`, `server/store.concurrency.test.mjs` | modify | route, sign-up and race tests |
| `src/app/api.ts` | new | session token, `authHeaders`, `apiGet`, `apiPost` |
| `src/app/house.ts` | new | house types, API calls, `useHouse()` |
| `src/vite-env.d.ts` | modify | `VITE_SUPABASE_*` types |
| `src/app/App.tsx` | modify | onboarding, members context, home, leaderboard, house drill, house screens |
| `.claude/launch.json` | modify | local preview on PGlite |
| `server/README.md`, `.env.example`, `DEPLOY.md`, spec | modify | docs |

---

### Task 1: Migration, row mapping and test reset

**Files:**
- Create: `supabase/migrations/20260920000001_houses.sql`
- Modify: `server/rows.js` (`userFromRow`), `server/testdb.mjs:11-14`
- Test: `server/rows.test.mjs`, `server/db.test.mjs`

**Interfaces:**
- Produces: tables `safespace.houses`, `safespace.drill_runs`; columns `users.house_id`, `users.joined_house_at`, `users.avatar`. `userFromRow(row)` adds `houseId` and `avatar` only when non-null (so existing JSON is unchanged for users without them).

- [ ] **Step 1: Write failing tests**

Append to `server/rows.test.mjs`:

```js
test('userFromRow carries house and avatar only when set', () => {
  const base = {
    id: 'usr_1', name: 'A', role: 'ROOKIE', consent_to_drills: true, level: 1, xp: 0,
    xp_max: 500, streak: 0, times_safe: 0, times_scammed: 0, primary_color: '#4ecdc4',
    badge_count: 0, badge_total: 9, room_name: 'R', room_bg: '#000', safe_this_week: true,
    recent_drill_result: null,
  };
  const plain = userFromRow({ ...base, house_id: null, avatar: null });
  assert.equal('houseId' in plain, false);
  assert.equal('avatar' in plain, false);
  const avatar = { color: '#ff6b35', glow: '#00ff88', hat: 'Cap', eyes: 'Visor', outfit: 'Neon' };
  const housed = userFromRow({ ...base, house_id: 'house_1', avatar });
  assert.equal(housed.houseId, 'house_1');
  assert.deepEqual(housed.avatar, avatar);
});
```

(`userFromRow` is already imported at the top of that file; if not, add it to the existing import from `./rows.js`.)

Append to `server/db.test.mjs` (it already calls `setupTestDb()` and imports `query`; reuse those):

```js
test('houses migration: tables exist with row-level security', async () => {
  const { rows } = await query(
    `select c.relname, c.relrowsecurity from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'safespace' and c.relname in ('houses', 'drill_runs')
      order by c.relname`,
  );
  assert.deepEqual(rows.map((r) => [r.relname, r.relrowsecurity]), [
    ['drill_runs', true], ['houses', true],
  ]);
  const cols = await query(
    `select column_name from information_schema.columns
      where table_schema = 'safespace' and table_name = 'users'
        and column_name in ('house_id', 'joined_house_at', 'avatar') order by column_name`,
  );
  assert.deepEqual(cols.rows.map((r) => r.column_name), ['avatar', 'house_id', 'joined_house_at']);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test server/rows.test.mjs server/db.test.mjs`
Expected: FAIL — `houseId` missing; `drill_runs`/`houses` not found.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260920000001_houses.sql`:

```sql
-- Houses: optional groups of up to 6 players (sub-project 2).
-- Plain Postgres only, so it applies unchanged to Supabase, PGlite and CI.

create table safespace.houses (
  id text primary key,
  name text not null check (char_length(name) between 1 and 30),
  owner_id text not null references safespace.users (id),
  -- Null when there is no live code. The alphabet has no 0/O/1/I/L.
  invite_code text unique check (invite_code ~ '^[2-9A-HJKMNP-Z]{6}$'),
  invite_expires_at timestamptz,
  -- Random Realtime topic. Knowing it is what lets a client hear the doorbell.
  doorbell text not null unique,
  created_at timestamptz not null default now(),
  check ((invite_code is null) = (invite_expires_at is null))
);

alter table safespace.users
  add column house_id text references safespace.houses (id) on delete set null,
  add column joined_house_at timestamptz,
  add column avatar jsonb;
create index users_house_id_idx on safespace.users (house_id) where house_id is not null;

-- One row per finished house drill. Only the first run of a week earns XP.
create table safespace.drill_runs (
  id text primary key,
  user_id text not null references safespace.users (id),
  client_key text not null check (char_length(client_key) between 1 and 200),
  correct integer not null check (correct >= 0),
  cautious integer not null check (cautious >= 0),
  wrong integer not null check (wrong >= 0),
  xp_gained integer not null check (xp_gained >= 0),
  at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index drill_runs_user_at_idx on safespace.drill_runs (user_id, at);

-- "Safe this week" and "active this week" read results by user and time.
create index drill_results_user_at_idx on safespace.drill_results (user_id, at);

alter table safespace.houses enable row level security;
alter table safespace.drill_runs enable row level security;
```

- [ ] **Step 4: Map the new columns**

In `server/rows.js`, inside `userFromRow`, after the existing `setIfPresent(user, 'emailVerificationTokenHash', …)` line add:

```js
  setIfPresent(user, 'houseId', row.house_id);
  setIfPresent(user, 'avatar', row.avatar);
```

`house_id` and `avatar` are deliberately NOT added to `USER_FIELDS`: only `server/houses.js` and `setUserAvatar` write them, so `saveUser` can never overwrite a membership change made by another transaction.

- [ ] **Step 5: Reset the new tables in tests**

In `server/testdb.mjs` replace the `TABLES` constant:

```js
const TABLES = [
  'sessions', 'consent_events', 'rate_limit_hits', 'drill_runs', 'drill_results',
  'drill_attempts', 'tactic_cards', 'houses', 'users',
];
```

- [ ] **Step 6: Run the whole suite**

Run: `node --test server/*.test.mjs`
Expected: all pass (the previous 169 + 2 new; 6 skipped).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260920000001_houses.sql server/rows.js server/testdb.mjs server/rows.test.mjs server/db.test.mjs
git commit -m "feat(db): houses, drill runs and avatar columns"
```

---

### Task 2: Avatar allowlist and week boundary

**Files:**
- Create: `server/avatar.js`, `server/week.js`, `server/avatar.test.mjs`, `server/week.test.mjs`
- Modify: `server/store.js` (add `setUserAvatar`)

**Interfaces:**
- Produces: `cleanAvatar(input) → {color, glow, hat, eyes, outfit} | null`; `DEFAULT_AVATAR`; `weekStart(now: Date) → Date`; store `setUserAvatar(userId, avatar) → user` (throws `Error('avatar is invalid')`).

- [ ] **Step 1: Write failing tests**

`server/avatar.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAvatar, DEFAULT_AVATAR } from './avatar.js';

test('cleanAvatar keeps exactly the five allowed keys', () => {
  const input = { color: '#ff6b35', glow: '#00ff88', hat: 'Crown', eyes: 'Shades', outfit: 'Camo', extra: 'x' };
  assert.deepEqual(cleanAvatar(input), {
    color: '#ff6b35', glow: '#00ff88', hat: 'Crown', eyes: 'Shades', outfit: 'Camo',
  });
});

test('cleanAvatar rejects anything outside the allowlist', () => {
  assert.equal(cleanAvatar(null), null);
  assert.equal(cleanAvatar([]), null);
  assert.equal(cleanAvatar('Crown'), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, color: '#000000' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, hat: 'Tiara' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, outfit: undefined }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, eyes: '<script>' }), null);
});
```

`server/week.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart } from './week.js';

test('the week starts Monday 00:00 in Singapore', () => {
  // Sunday 20 Sep 2026, 23:59:59 SGT belongs to the week of Monday 14 Sep.
  assert.equal(weekStart(new Date('2026-09-20T15:59:59Z')).toISOString(), '2026-09-13T16:00:00.000Z');
  // Monday 21 Sep 2026, 00:00:00 SGT starts a new week.
  assert.equal(weekStart(new Date('2026-09-20T16:00:00Z')).toISOString(), '2026-09-20T16:00:00.000Z');
  // Wednesday afternoon.
  assert.equal(weekStart(new Date('2026-09-23T06:00:00Z')).toISOString(), '2026-09-20T16:00:00.000Z');
});
```

Append to `server/store.test.mjs` (add `setUserAvatar` to the destructured import from `./store.js`):

```js
test('setUserAvatar stores an allowlisted avatar and rejects others', async () => {
  await freshStore();
  const u = await registerVerifiedUser({ phone: '+6591110001', name: 'Ava' });
  const avatar = { color: '#c77dff', glow: '#ffe66d', hat: 'Helmet', eyes: 'Goggles', outfit: 'Stealth' };
  assert.deepEqual((await setUserAvatar(u.id, avatar)).avatar, avatar);
  await assert.rejects(() => setUserAvatar(u.id, { ...avatar, hat: 'Tiara' }), /avatar is invalid/);
  assert.deepEqual((await getUser(u.id)).avatar, avatar);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test server/avatar.test.mjs server/week.test.mjs server/store.test.mjs`
Expected: FAIL — modules not found / `setUserAvatar` is not a function.

- [ ] **Step 3: Implement**

`server/avatar.js`:

```js
// The mascot a player designs. Values must match AvatarCustomisationScreen in
// src/app/App.tsx; anything else is rejected so stored JSON stays predictable.
export const AVATAR_PALETTE = ['#4ecdc4', '#ff6b35', '#c77dff', '#ffe66d', '#ff2d55', '#00ff88'];
export const AVATAR_OPTIONS = {
  color: AVATAR_PALETTE,
  glow: AVATAR_PALETTE,
  hat: ['None', 'Cap', 'Helmet', 'Crown'],
  eyes: ['Default', 'Shades', 'Visor', 'Goggles'],
  outfit: ['Standard', 'Camo', 'Neon', 'Stealth'],
};
export const DEFAULT_AVATAR = { color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard' };

/** A copy with exactly the allowed keys, or null if any value is not allowed. */
export function cleanAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const avatar = {};
  for (const [key, allowed] of Object.entries(AVATAR_OPTIONS)) {
    if (!allowed.includes(input[key])) return null;
    avatar[key] = input[key];
  }
  return avatar;
}
```

`server/week.js`:

```js
// Weekly house stats reset at Monday 00:00 in Singapore. Singapore has no daylight
// saving, so a fixed offset is exact and needs no time-zone database.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function weekStart(now = new Date()) {
  const local = new Date(now.getTime() + SGT_OFFSET_MS); // UTC fields now read as SGT
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - daysSinceMonday * DAY_MS - SGT_OFFSET_MS);
}
```

In `server/store.js` add `import { cleanAvatar } from './avatar.js';` with the other imports, and after `setUserName` add:

```js
export async function setUserAvatar(userId, avatar) {
  const clean = cleanAvatar(avatar);
  if (!clean) throw new Error('avatar is invalid');
  const { rows } = await query(
    'update safespace.users set avatar = $2::jsonb where id = $1 returning *',
    [String(userId), JSON.stringify(clean)],
    'setUserAvatar',
  );
  if (!rows[0]) throw new Error(`unknown user ${userId}`);
  return userFromRow(rows[0]);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test server/avatar.test.mjs server/week.test.mjs server/store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/avatar.js server/week.js server/avatar.test.mjs server/week.test.mjs server/store.js server/store.test.mjs
git commit -m "feat(server): avatar allowlist and Singapore week boundary"
```

---

### Task 3: Sign-up keeps returning names and accepts an avatar

**Files:**
- Modify: `server/store.js` (`registerVerifiedUser`)
- Test: `server/store.test.mjs`

**Interfaces:**
- Produces: `registerVerifiedUser({ phone, name, email, avatar })`. `name` may be empty for an existing account (name kept). For an unknown number with no name it throws an `Error('name is required for a new account')` with `code = 'NO_ACCOUNT'` and creates nothing. A valid `avatar` is saved (replacing any old one); an invalid one throws `Error('avatar is invalid')`.

- [ ] **Step 1: Write failing tests**

Replace the existing `'registerVerifiedUser requires a name'` test in `server/store.test.mjs` with:

```js
test('registerVerifiedUser needs a name only for a new account', async () => {
  await freshStore();
  await assert.rejects(
    () => registerVerifiedUser({ phone: '+6591234567', name: '   ' }),
    (error) => error.code === 'NO_ACCOUNT' && /name is required/.test(error.message),
  );
  const { rows } = await query('select count(*) as n from safespace.users where phone = $1', ['+6591234567']);
  assert.equal(Number(rows[0].n), 0, 'no account is created');

  const created = await registerVerifiedUser({ phone: '+6591234567', name: 'Judge' });
  const again = await registerVerifiedUser({ phone: '+6591234567', name: '' });
  assert.equal(again.id, created.id);
  assert.equal(again.name, 'JUDGE', 'a returning number keeps its name');
  await freshStore();
});

test('registerVerifiedUser saves the designed avatar', async () => {
  await freshStore();
  const avatar = { color: '#ff2d55', glow: '#4ecdc4', hat: 'Cap', eyes: 'Shades', outfit: 'Neon' };
  const u = await registerVerifiedUser({ phone: '+6591110002', name: 'Neo', avatar });
  assert.deepEqual(u.avatar, avatar);
  const next = { ...avatar, hat: 'Crown' };
  assert.deepEqual((await registerVerifiedUser({ phone: '+6591110002', avatar: next })).avatar, next);
  await assert.rejects(
    () => registerVerifiedUser({ phone: '+6591110003', name: 'Bad', avatar: { hat: 'Tiara' } }),
    /avatar is invalid/,
  );
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test server/store.test.mjs`
Expected: FAIL — error has no `NO_ACCOUNT` code; returning name overwritten to `''` fails.

- [ ] **Step 3: Implement**

In `registerVerifiedUser`:

1. Change the signature and the first lines to:

```js
export async function registerVerifiedUser({ phone, name, email, avatar } = {}) {
  const cleanName = normaliseUserName(name);
  const cleanAvatarValue = avatar == null ? null : cleanAvatar(avatar);
  if (avatar != null && !cleanAvatarValue) throw new Error('avatar is invalid');
```

(delete the old `if (!cleanName) throw new Error('name is required');`).

2. Right after `const isNew = !user;` insert:

```js
    if (isNew && !cleanName) {
      const error = new Error('name is required for a new account');
      error.code = 'NO_ACCOUNT';
      throw error;
    }
```

3. Replace `user.name = cleanName;` with `if (cleanName) user.name = cleanName;`.

4. Replace the final lines of the transaction (`const saved = …; await logConsent(…); return saved;`) with:

```js
    let saved = isNew ? await insertUser(tx, user) : await saveUser(tx, user);
    if (cleanAvatarValue) {
      const { rows: updated } = await tx.query(
        'update safespace.users set avatar = $2::jsonb where id = $1 returning *',
        [saved.id, JSON.stringify(cleanAvatarValue)],
      );
      saved = userFromRow(updated[0]);
    }
    await logConsent(tx, { userId: saved.id, type: 'granted', channel: 'otp', at });
    return saved;
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test server/store.test.mjs server/store.concurrency.test.mjs`
Expected: PASS (concurrency tests skipped on PGlite).

- [ ] **Step 5: Commit**

```bash
git add server/store.js server/store.test.mjs
git commit -m "feat(server): returning sign-in keeps the name; sign-up takes an avatar"
```

---

### Task 4: House rules in `server/houses.js`

**Files:**
- Create: `server/houses.js`, `server/houses.test.mjs`
- Modify: `server/store.js` (export shared helpers, add `addXp`)

**Interfaces:**
- Consumes: `transaction`, `query` (db.js); `lockUser`, `saveUser`, `lockRateLimits`, `recordRateLimitHits`, `retryAfterForWindow`, `addXp` (store.js, newly exported); `userFromRow` (rows.js); `weekStart` (week.js).
- Produces (all `async`, all take `now` for tests):
  - `class HouseError extends Error { code; retryAfterMs }`
  - `createHouse(userId, name, { now }) → { houseId, ring: string[] }`
  - `joinHouse(userId, code, { requesterKey, now }) → { houseId, ring }`
  - `regenerateInviteCode(userId, { now }) → { ring }`
  - `renameHouse(userId, name) → { ring }`
  - `removeMember(userId, memberId) → { ring }` (ring = the OLD doorbell)
  - `leaveHouse(userId) → { ring }`
  - `recordHouseRun(userId, { clientKey, correct, cautious, wrong }, { now }) → { status: 'completed'|'duplicate', run, user }`
  - `getHouseView(userId, { now }) → { self: MemberView, house: HouseView | null }`
  - `doorbellForUser(userId) → string | null`
  - `normaliseInviteCode(input) → string | null`, `formatInviteCode(code) → 'ABC-DEF'`
  - Constants `HOUSE_MAX_MEMBERS = 6`, `INVITE_TTL_MS`, `HOUSE_RUN_XP = { correct: 100, cautious: 50, wrong: 25 }`
  - `MemberView = { id, name, avatar|null, level, xp, xpMax, streak, timesSafe, timesScammed, badgeCount, badgeTotal, recentDrillResult, isOwner, activeThisWeek, safeThisWeek, weekRun: {correct,cautious,wrong}|null }`
  - `HouseView = { id, name, ownerId, inviteCode: 'ABC-DEF'|null, inviteExpiresAt: ISO|null, doorbell, members: MemberView[] }`
  - HouseError codes: `NOT_IN_HOUSE`, `ALREADY_IN_HOUSE`, `CODE_INVALID`, `HOUSE_FULL`, `NOT_OWNER`, `NOT_A_MEMBER`, `CANNOT_REMOVE_SELF`, `JOIN_RATE_LIMITED`, `INVALID_HOUSE_NAME`, `INVALID_DRILL_RUN`.

- [ ] **Step 1: Export store helpers and factor out `addXp`**

In `server/store.js`:
- Add `export` to `async function lockUser`, `async function saveUser`, `async function lockRateLimits`, `async function recordRateLimitHits`, `function retryAfterForWindow`, and add above them the comment `// Exported for server/houses.js, which shares these locking rules.` once, near `lockUser`.
- Replace the level-up loop in `scoreUser` with a call to a new exported function:

```js
/** Add XP and apply the level-up rule. Mutates and returns the user. */
export function addXp(user, xp) {
  user.xp += xp;
  while (user.xp >= user.xpMax) {
    user.xp -= user.xpMax;
    user.level += 1;
    user.xpMax = Math.round(user.xpMax * 1.2);
  }
  return user;
}
```

so `scoreUser` begins `const r = computeResult(outcome, { practice }); addXp(user, r.xp);`.

Run: `node --test server/*.test.mjs` — Expected: all still pass.

- [ ] **Step 2: Write failing store tests**

`server/houses.test.mjs`:

```js
// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'houses-test-identity-lookup-secret-over-32-chars';
await setupTestDb();
after(teardownTestDb);

const { registerVerifiedUser, applyOutcome, getUser } = await import('./store.js');
const houses = await import('./houses.js');
const { query } = await import('./db.js');

const DAY = 24 * 60 * 60 * 1000;
let phoneSeq = 0;
async function player(name = 'Player') {
  phoneSeq += 1;
  return registerVerifiedUser({ phone: `+659200${String(phoneSeq).padStart(4, '0')}`, name });
}
async function codeOf(userId) {
  return (await houses.getHouseView(userId)).house.inviteCode;
}
// Joins are spaced one second apart, in the past, so join order (which decides the next
// owner) is deterministic and later real-time joins sort after them.
async function houseWith(count) {
  const t0 = Date.now() - 60_000;
  const owner = await player('Owner');
  await houses.createHouse(owner.id, 'The Tans', { now: new Date(t0) });
  const code = await codeOf(owner.id);
  const members = [owner];
  for (let i = 1; i < count; i += 1) {
    const p = await player(`M${i}`);
    await houses.joinHouse(p.id, code, { now: new Date(t0 + i * 1000) });
    members.push(p);
  }
  return { owner, members, code };
}
const rejectsWith = (fn, code) => assert.rejects(fn, (error) => error.code === code);

test('solo players have a self view and no house', async () => {
  await resetDb();
  const p = await player('Solo');
  const view = await houses.getHouseView(p.id);
  assert.equal(view.house, null);
  assert.equal(view.self.id, p.id);
  assert.equal(view.self.name, 'SOLO');
  assert.equal(view.self.activeThisWeek, false);
  assert.equal(view.self.safeThisWeek, true);
});

test('create makes the creator owner with a live 24h code', async () => {
  await resetDb();
  const p = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  const created = await houses.createHouse(p.id, '  the   tans ', { now });
  const { house } = await houses.getHouseView(p.id, { now });
  assert.equal(house.id, created.houseId);
  assert.equal(house.name, 'THE TANS');
  assert.equal(house.ownerId, p.id);
  assert.match(house.inviteCode, /^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$/);
  assert.equal(house.inviteExpiresAt, new Date(now.getTime() + DAY).toISOString());
  assert.deepEqual(created.ring, [house.doorbell]);
  assert.deepEqual(house.members.map((m) => [m.id, m.isOwner]), [[p.id, true]]);
  await rejectsWith(() => houses.createHouse(p.id, 'Second'), 'ALREADY_IN_HOUSE');
});

test('house names are validated', async () => {
  await resetDb();
  const p = await player();
  await rejectsWith(() => houses.createHouse(p.id, '   '), 'INVALID_HOUSE_NAME');
  await rejectsWith(() => houses.createHouse(p.id, 'x'.repeat(31)), 'INVALID_HOUSE_NAME');
  await rejectsWith(() => houses.createHouse(p.id, '<b>hi</b>'), 'INVALID_HOUSE_NAME');
});

test('join accepts any case and dash, and caps the house at 6', async () => {
  await resetDb();
  const { code, members } = await houseWith(5);
  const sixth = await player('Sixth');
  await houses.joinHouse(sixth.id, code.toLowerCase().replace('-', ' '));
  const view = await houses.getHouseView(sixth.id);
  assert.equal(view.house.members.length, 6);
  assert.deepEqual(view.house.members.map((m) => m.id), [...members.map((m) => m.id), sixth.id]);
  const seventh = await player('Seventh');
  await rejectsWith(() => houses.joinHouse(seventh.id, code), 'HOUSE_FULL');
});

test('wrong, expired and replaced codes are all CODE_INVALID', async () => {
  await resetDb();
  const owner = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  await houses.createHouse(owner.id, 'Tans', { now });
  const oldCode = (await houses.getHouseView(owner.id, { now })).house.inviteCode;
  const joiner = await player('Joiner');
  await rejectsWith(() => houses.joinHouse(joiner.id, 'ZZZ-ZZZ', { now }), 'CODE_INVALID');
  await rejectsWith(() => houses.joinHouse(joiner.id, 'nonsense', { now }), 'CODE_INVALID');
  const later = new Date(now.getTime() + DAY + 1000);
  await rejectsWith(() => houses.joinHouse(joiner.id, oldCode, { now: later }), 'CODE_INVALID');
  await houses.regenerateInviteCode(owner.id, { now });
  await rejectsWith(() => houses.joinHouse(joiner.id, oldCode, { now }), 'CODE_INVALID');
  const newCode = (await houses.getHouseView(owner.id, { now })).house.inviteCode;
  assert.notEqual(newCode, oldCode);
  await houses.joinHouse(joiner.id, newCode, { now });
});

test('an expired code is hidden from the house view', async () => {
  await resetDb();
  const owner = await player('Owner');
  const now = new Date('2026-09-22T02:00:00Z');
  await houses.createHouse(owner.id, 'Tans', { now });
  const later = new Date(now.getTime() + DAY + 1000);
  const { house } = await houses.getHouseView(owner.id, { now: later });
  assert.equal(house.inviteCode, null);
  assert.equal(house.inviteExpiresAt, null);
});

test('10 wrong codes per account per hour, then JOIN_RATE_LIMITED', async () => {
  await resetDb();
  const { code } = await houseWith(1);
  const guesser = await player('Guesser');
  for (let i = 0; i < 10; i += 1) {
    await rejectsWith(() => houses.joinHouse(guesser.id, 'ZZZ-ZZZ'), 'CODE_INVALID');
  }
  await assert.rejects(
    () => houses.joinHouse(guesser.id, code),
    (error) => error.code === 'JOIN_RATE_LIMITED' && error.retryAfterMs > 0,
  );
});

test('30 wrong codes per network address per hour', async () => {
  await resetDb();
  const requesterKey = '203.0.113.9';
  for (let i = 0; i < 30; i += 1) {
    const p = await player(`G${i}`);
    await rejectsWith(() => houses.joinHouse(p.id, 'ZZZ-ZZZ', { requesterKey }), 'CODE_INVALID');
  }
  const last = await player('Last');
  await rejectsWith(() => houses.joinHouse(last.id, 'ZZZ-ZZZ', { requesterKey }), 'JOIN_RATE_LIMITED');
});

test('only the owner regenerates, renames and removes', async () => {
  await resetDb();
  const { owner, members } = await houseWith(2);
  const member = members[1];
  await rejectsWith(() => houses.regenerateInviteCode(member.id), 'NOT_OWNER');
  await rejectsWith(() => houses.renameHouse(member.id, 'Mine'), 'NOT_OWNER');
  await rejectsWith(() => houses.removeMember(member.id, owner.id), 'NOT_OWNER');
  await houses.renameHouse(owner.id, 'New Name');
  assert.equal((await houses.getHouseView(member.id)).house.name, 'NEW NAME');
  await rejectsWith(() => houses.removeMember(owner.id, owner.id), 'CANNOT_REMOVE_SELF');
  const stranger = await player('Stranger');
  await rejectsWith(() => houses.removeMember(owner.id, stranger.id), 'NOT_A_MEMBER');
});

test('removing a member rotates the doorbell and rings the old one', async () => {
  await resetDb();
  const { owner, members } = await houseWith(3);
  const before = (await houses.getHouseView(owner.id)).house.doorbell;
  const result = await houses.removeMember(owner.id, members[1].id);
  assert.deepEqual(result.ring, [before]);
  const after = (await houses.getHouseView(owner.id)).house;
  assert.notEqual(after.doorbell, before);
  assert.equal(after.members.length, 2);
  assert.equal((await houses.getHouseView(members[1].id)).house, null);
  assert.equal(await houses.doorbellForUser(members[1].id), null);
});

test('an owner leaving hands the house to the earliest joiner', async () => {
  await resetDb();
  const { owner, members } = await houseWith(3);
  await houses.leaveHouse(owner.id);
  const { house } = await houses.getHouseView(members[1].id);
  assert.equal(house.ownerId, members[1].id);
  assert.deepEqual(house.members.map((m) => m.id), [members[1].id, members[2].id]);
  assert.equal((await houses.getHouseView(owner.id)).house, null);
});

test('the last member leaving deletes the house', async () => {
  await resetDb();
  const { owner, code } = await houseWith(1);
  await houses.leaveHouse(owner.id);
  const { rows } = await query('select count(*) as n from safespace.houses');
  assert.equal(Number(rows[0].n), 0);
  const p = await player();
  await rejectsWith(() => houses.joinHouse(p.id, code), 'CODE_INVALID');
  await rejectsWith(() => houses.leaveHouse(owner.id), 'NOT_IN_HOUSE');
});

test('personal progress travels with a member who joins mid-way', async () => {
  await resetDb();
  const veteran = await player('Veteran');
  await applyOutcome({ userId: veteran.id, outcome: 'hung_up', practice: true });
  const stats = await getUser(veteran.id);
  const { code } = await houseWith(2);
  await houses.joinHouse(veteran.id, code);
  const me = (await houses.getHouseView(veteran.id)).house.members.find((m) => m.id === veteran.id);
  assert.equal(me.xp, stats.xp);
  assert.equal(me.timesSafe, stats.timesSafe);
});

test('weekly flags: a LOST result makes you unsafe until Monday', async () => {
  await resetDb();
  const p = await player('Weekly');
  await applyOutcome({ userId: p.id, outcome: 'shared_data' });
  let { self } = await houses.getHouseView(p.id);
  assert.equal(self.activeThisWeek, true);
  assert.equal(self.safeThisWeek, false);
  ({ self } = await houses.getHouseView(p.id, { now: new Date(Date.now() + 8 * DAY) }));
  assert.equal(self.activeThisWeek, false);
  assert.equal(self.safeThisWeek, true);
});

test('only the first house drill run of the week earns XP; keys are idempotent', async () => {
  await resetDb();
  const p = await player('Runner');
  const before = await getUser(p.id);
  const first = await houses.recordHouseRun(p.id, { clientKey: 'run-1', correct: 4, cautious: 1, wrong: 1 });
  assert.equal(first.status, 'completed');
  assert.equal(first.run.xpGained, 4 * 100 + 50 + 25);
  const replay = await houses.recordHouseRun(p.id, { clientKey: 'run-1', correct: 6, cautious: 0, wrong: 0 });
  assert.equal(replay.status, 'duplicate');
  assert.equal(replay.run.xpGained, first.run.xpGained);
  const second = await houses.recordHouseRun(p.id, { clientKey: 'run-2', correct: 6, cautious: 0, wrong: 0 });
  assert.equal(second.run.xpGained, 0);
  const after = await getUser(p.id);
  assert.equal(after.level * 100000 + after.xp > before.level * 100000 + before.xp, true);
  const { self } = await houses.getHouseView(p.id);
  assert.deepEqual(self.weekRun, { correct: 10, cautious: 1, wrong: 1 });
  assert.equal(self.activeThisWeek, true);
  const nextWeek = await houses.recordHouseRun(
    p.id, { clientKey: 'run-3', correct: 1, cautious: 0, wrong: 0 }, { now: new Date(Date.now() + 8 * DAY) },
  );
  assert.equal(nextWeek.run.xpGained, 100);
});

test('house drill runs are validated', async () => {
  await resetDb();
  const p = await player();
  const bad = [
    { clientKey: '', correct: 1, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: 0, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: -1, cautious: 2, wrong: 0 },
    { clientKey: 'k', correct: 1.5, cautious: 0, wrong: 0 },
    { clientKey: 'k', correct: 21, cautious: 0, wrong: 0 },
    { clientKey: 'k'.repeat(201), correct: 1, cautious: 0, wrong: 0 },
  ];
  for (const run of bad) await rejectsWith(() => houses.recordHouseRun(p.id, run), 'INVALID_DRILL_RUN');
});

test('the house view never carries phone, email or lookup hashes', async () => {
  await resetDb();
  const { owner } = await houseWith(3);
  const text = JSON.stringify(await houses.getHouseView(owner.id));
  for (const leak of ['phone', 'email', 'Hash', '+659']) assert.ok(!text.includes(leak), leak);
});
```

Run: `node --test server/houses.test.mjs`
Expected: FAIL — `Cannot find module './houses.js'`.

- [ ] **Step 3: Implement `server/houses.js`**

```js
// Houses: optional groups of up to six players who see each other's progress.
//
// Every write is one transaction. Lock order is always: rate-limit advisory locks, then
// the house row, then user rows. A user's house_id is re-checked under their row lock,
// so nobody can end up in two houses, and joins lock the house row before counting, so
// a house can never pass HOUSE_MAX_MEMBERS.
import crypto from 'crypto';
import { query, transaction } from './db.js';
import { userFromRow } from './rows.js';
import { weekStart } from './week.js';
import {
  addXp,
  lockRateLimits,
  lockUser,
  recordRateLimitHits,
  retryAfterForWindow,
  saveUser,
} from './store.js';

export const HOUSE_MAX_MEMBERS = 6;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const HOUSE_RUN_XP = { correct: 100, cautious: 50, wrong: 25 };
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const JOIN_WINDOW_MS = 60 * 60 * 1000;
const JOIN_LIMITS = { house_join_account: 10, house_join_requester: 30 };
const HOUSE_NAME_RE = /^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'&-]{0,29}$/u;
const MAX_ROUNDS = 20;

// Codes must stay longer than five characters: db.js treats a five-character upper-case
// code as a Postgres SQLSTATE.
export class HouseError extends Error {
  constructor(code, { retryAfterMs = 0 } = {}) {
    super(code);
    this.name = 'HouseError';
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function generateInviteCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

/** 'k7p 3qx', 'K7P-3QX' → 'K7P3QX'; anything else → null. */
export function normaliseInviteCode(input) {
  const code = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

export function formatInviteCode(code) {
  return code ? `${code.slice(0, 3)}-${code.slice(3)}` : null;
}

function newDoorbell() {
  return `house-${crypto.randomBytes(16).toString('hex')}`;
}

function cleanHouseName(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!HOUSE_NAME_RE.test(clean)) throw new HouseError('INVALID_HOUSE_NAME');
  return clean;
}

async function freshInviteCode(tx) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const { rows } = await tx.query('select 1 from safespace.houses where invite_code = $1', [code]);
    if (!rows[0]) return code;
  }
  throw new Error('could not generate a unique invite code');
}

async function lockHouse(tx, houseId) {
  const { rows } = await tx.query('select * from safespace.houses where id = $1 for update', [houseId]);
  return rows[0] ?? null;
}

async function unlockedHouseId(tx, userId) {
  const { rows } = await tx.query('select house_id from safespace.users where id = $1', [String(userId)]);
  return rows[0]?.house_id ?? null;
}

/**
 * Lock the caller's house, then the caller, and confirm they are still a member.
 * Returns { house, user }.
 */
async function lockOwnHouse(tx, userId) {
  const houseId = await unlockedHouseId(tx, userId);
  if (!houseId) throw new HouseError('NOT_IN_HOUSE');
  const house = await lockHouse(tx, houseId);
  const user = await lockUser(tx, userId);
  if (!house || !user || user.houseId !== house.id) throw new HouseError('NOT_IN_HOUSE');
  return { house, user };
}

async function memberIds(tx, houseId) {
  const { rows } = await tx.query(
    'select id from safespace.users where house_id = $1 order by joined_house_at, id',
    [houseId],
  );
  return rows.map((row) => row.id);
}

export async function createHouse(userId, name, { now = new Date() } = {}) {
  const clean = cleanHouseName(name);
  return transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.houseId) throw new HouseError('ALREADY_IN_HOUSE');
    const id = `house_${crypto.randomUUID()}`;
    const doorbell = newDoorbell();
    await tx.query(
      `insert into safespace.houses (id, name, owner_id, invite_code, invite_expires_at, doorbell, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, clean, user.id, await freshInviteCode(tx), new Date(now.getTime() + INVITE_TTL_MS).toISOString(),
        doorbell, now.toISOString()],
    );
    await tx.query(
      'update safespace.users set house_id = $2, joined_house_at = $3 where id = $1',
      [user.id, id, now.toISOString()],
    );
    return { houseId: id, ring: [doorbell] };
  }, 'createHouse');
}

export async function joinHouse(userId, code, { requesterKey = null, now = new Date() } = {}) {
  const clean = normaliseInviteCode(code);
  const nowMs = now.getTime();
  // Failures are returned, not thrown, so the failed attempt's rate-limit hit commits.
  const outcome = await transaction(async (tx) => {
    const subjects = [{ scope: 'house_join_account', subject: userId }];
    if (requesterKey) subjects.push({ scope: 'house_join_requester', subject: requesterKey });
    const buckets = await lockRateLimits(tx, subjects, { nowMs, windowMs: JOIN_WINDOW_MS });
    for (const bucket of buckets) {
      if (bucket.hits.length >= JOIN_LIMITS[bucket.scope]) {
        return {
          error: 'JOIN_RATE_LIMITED',
          retryAfterMs: retryAfterForWindow(bucket.hits, nowMs, JOIN_WINDOW_MS),
        };
      }
    }
    let house = null;
    if (clean) {
      // Postgres re-checks the where clause after waiting for the lock, so a code that
      // was replaced or a house that was deleted meanwhile no longer matches.
      const { rows } = await tx.query(
        `select * from safespace.houses
          where invite_code = $1 and invite_expires_at > $2
          for update`,
        [clean, now.toISOString()],
      );
      house = rows[0] ?? null;
    }
    if (!house) {
      await recordRateLimitHits(tx, buckets, { nowMs, windowMs: JOIN_WINDOW_MS });
      return { error: 'CODE_INVALID' };
    }
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    if (user.houseId) return { error: 'ALREADY_IN_HOUSE' };
    if ((await memberIds(tx, house.id)).length >= HOUSE_MAX_MEMBERS) return { error: 'HOUSE_FULL' };
    await tx.query(
      'update safespace.users set house_id = $2, joined_house_at = $3 where id = $1',
      [user.id, house.id, now.toISOString()],
    );
    return { houseId: house.id, ring: [house.doorbell] };
  }, 'joinHouse');
  if (outcome.error) throw new HouseError(outcome.error, { retryAfterMs: outcome.retryAfterMs });
  return outcome;
}

export async function regenerateInviteCode(userId, { now = new Date() } = {}) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    await tx.query(
      'update safespace.houses set invite_code = $2, invite_expires_at = $3 where id = $1',
      [house.id, await freshInviteCode(tx), new Date(now.getTime() + INVITE_TTL_MS).toISOString()],
    );
    return { ring: [house.doorbell] };
  }, 'regenerateInviteCode');
}

export async function renameHouse(userId, name) {
  const clean = cleanHouseName(name);
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    await tx.query('update safespace.houses set name = $2 where id = $1', [house.id, clean]);
    return { ring: [house.doorbell] };
  }, 'renameHouse');
}

export async function removeMember(userId, memberId) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    if (house.owner_id !== user.id) throw new HouseError('NOT_OWNER');
    if (String(memberId) === user.id) throw new HouseError('CANNOT_REMOVE_SELF');
    const target = await lockUser(tx, memberId);
    if (!target || target.houseId !== house.id) throw new HouseError('NOT_A_MEMBER');
    await tx.query(
      'update safespace.users set house_id = null, joined_house_at = null where id = $1',
      [target.id],
    );
    // A new topic, so the removed player's open app stops hearing this house.
    await tx.query('update safespace.houses set doorbell = $2 where id = $1', [house.id, newDoorbell()]);
    // Ring the old topic: everyone listening refetches, and the others pick up the new one.
    return { ring: [house.doorbell] };
  }, 'removeMember');
}

export async function leaveHouse(userId) {
  return transaction(async (tx) => {
    const { house, user } = await lockOwnHouse(tx, userId);
    await tx.query(
      'update safespace.users set house_id = null, joined_house_at = null where id = $1',
      [user.id],
    );
    const remaining = await memberIds(tx, house.id);
    if (!remaining.length) {
      await tx.query('delete from safespace.houses where id = $1', [house.id]);
      return { ring: [] };
    }
    if (house.owner_id === user.id) {
      await tx.query('update safespace.houses set owner_id = $2 where id = $1', [house.id, remaining[0]]);
    }
    return { ring: [house.doorbell] };
  }, 'leaveHouse');
}

function runFromRow(row) {
  return {
    id: row.id,
    correct: row.correct,
    cautious: row.cautious,
    wrong: row.wrong,
    xpGained: row.xp_gained,
    at: new Date(row.at).toISOString(),
  };
}

function validRoundCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_ROUNDS;
}

export async function recordHouseRun(userId, { clientKey, correct, cautious, wrong } = {}, { now = new Date() } = {}) {
  const key = String(clientKey ?? '').trim();
  const counts = [correct, cautious, wrong];
  if (!key || key.length > 200 || !counts.every(validRoundCount)) throw new HouseError('INVALID_DRILL_RUN');
  const total = correct + cautious + wrong;
  if (total < 1 || total > MAX_ROUNDS) throw new HouseError('INVALID_DRILL_RUN');

  return transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (!user) throw new Error(`unknown user ${userId}`);
    const existing = await tx.query(
      'select * from safespace.drill_runs where user_id = $1 and client_key = $2',
      [user.id, key],
    );
    if (existing.rows[0]) return { status: 'duplicate', run: runFromRow(existing.rows[0]), user };
    const earlier = await tx.query(
      'select count(*) as n from safespace.drill_runs where user_id = $1 and at >= $2',
      [user.id, weekStart(now).toISOString()],
    );
    const xpGained = Number(earlier.rows[0].n) === 0
      ? correct * HOUSE_RUN_XP.correct + cautious * HOUSE_RUN_XP.cautious + wrong * HOUSE_RUN_XP.wrong
      : 0;
    let saved = user;
    if (xpGained) saved = await saveUser(tx, addXp(user, xpGained));
    const { rows } = await tx.query(
      `insert into safespace.drill_runs (id, user_id, client_key, correct, cautious, wrong, xp_gained, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [`run_${crypto.randomUUID()}`, user.id, key, correct, cautious, wrong, xpGained, now.toISOString()],
    );
    return { status: 'completed', run: runFromRow(rows[0]), user: saved };
  }, 'recordHouseRun');
}

// --- Read model -------------------------------------------------------------------

async function weeklyStats(userIds, since) {
  const results = await query(
    `select user_id, bool_or(result = 'LOST') as lost
       from safespace.drill_results
      where user_id = any($1) and at >= $2
      group by user_id`,
    [userIds, since],
    'weeklyResults',
  );
  const runs = await query(
    `select user_id, sum(correct) as correct, sum(cautious) as cautious, sum(wrong) as wrong
       from safespace.drill_runs
      where user_id = any($1) and at >= $2
      group by user_id`,
    [userIds, since],
    'weeklyRuns',
  );
  const stats = new Map(userIds.map((id) => [id, { active: false, lost: false, weekRun: null }]));
  for (const row of results.rows) Object.assign(stats.get(row.user_id), { active: true, lost: row.lost });
  for (const row of runs.rows) {
    Object.assign(stats.get(row.user_id), {
      active: true,
      weekRun: { correct: Number(row.correct), cautious: Number(row.cautious), wrong: Number(row.wrong) },
    });
  }
  return stats;
}

// Explicit field list: never spread a user row, so private fields cannot leak.
function memberView(user, stats, ownerId) {
  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    level: user.level,
    xp: user.xp,
    xpMax: user.xpMax,
    streak: user.streak,
    timesSafe: user.timesSafe,
    timesScammed: user.timesScammed,
    badgeCount: user.badgeCount,
    badgeTotal: user.badgeTotal,
    recentDrillResult: user.recentDrillResult ?? null,
    isOwner: user.id === ownerId,
    activeThisWeek: stats.active,
    safeThisWeek: !stats.lost,
    weekRun: stats.weekRun,
  };
}

export async function getHouseView(userId, { now = new Date() } = {}) {
  const since = weekStart(now).toISOString();
  const { rows: selfRows } = await query('select * from safespace.users where id = $1', [String(userId)], 'houseSelf');
  const self = userFromRow(selfRows[0]);
  if (!self) throw new Error(`unknown user ${userId}`);
  if (!self.houseId) {
    const stats = await weeklyStats([self.id], since);
    return { self: memberView(self, stats.get(self.id), null), house: null };
  }
  const { rows: houseRows } = await query('select * from safespace.houses where id = $1', [self.houseId], 'house');
  const house = houseRows[0];
  const { rows: memberRows } = await query(
    'select * from safespace.users where house_id = $1 order by joined_house_at, id',
    [house.id],
    'houseMembers',
  );
  const members = memberRows.map(userFromRow);
  const stats = await weeklyStats(members.map((m) => m.id), since);
  const views = members.map((m) => memberView(m, stats.get(m.id), house.owner_id));
  const codeLive = house.invite_code && new Date(house.invite_expires_at).getTime() > now.getTime();
  return {
    self: views.find((m) => m.id === self.id),
    house: {
      id: house.id,
      name: house.name,
      ownerId: house.owner_id,
      inviteCode: codeLive ? formatInviteCode(house.invite_code) : null,
      inviteExpiresAt: codeLive ? new Date(house.invite_expires_at).toISOString() : null,
      doorbell: house.doorbell,
      members: views,
    },
  };
}

export async function doorbellForUser(userId) {
  const { rows } = await query(
    `select h.doorbell from safespace.users u
       join safespace.houses h on h.id = u.house_id
      where u.id = $1`,
    [String(userId)],
    'doorbellForUser',
  );
  return rows[0]?.doorbell ?? null;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test server/houses.test.mjs`
Expected: PASS. If `= any($1)` fails on PGlite with an array parameter, change both queries to `user_id = any($1::text[])`.

- [ ] **Step 5: Run the whole suite**

Run: `node --test server/*.test.mjs`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/houses.js server/houses.test.mjs server/store.js
git commit -m "feat(server): house rules, weekly flags and house drill runs"
```

---

### Task 5: Join races on real Postgres

**Files:**
- Modify: `server/store.concurrency.test.mjs`

**Interfaces:**
- Consumes: `houses.createHouse`, `joinHouse`, `leaveHouse`, `getHouseView` from Task 4.

- [ ] **Step 1: Add the race tests**

Append (the file already defines `skip`, `race`, `fulfilled`, `rejected`, `store`, `query`):

```js
const houses = await import('./houses.js');
let racePhone = 0;
const racer = (name) => {
  racePhone += 1;
  return store.registerVerifiedUser({ phone: `+659300${String(racePhone).padStart(4, '0')}`, name });
};
async function raceHouse(size) {
  const owner = await racer('Owner');
  await houses.createHouse(owner.id, 'Race House');
  const code = (await houses.getHouseView(owner.id)).house.inviteCode;
  for (let i = 1; i < size; i += 1) await houses.joinHouse((await racer(`M${i}`)).id, code);
  return { owner, code };
}
async function houseInvariants() {
  const { rows } = await query(
    `select h.id, h.owner_id, count(u.id) as n, bool_or(u.id = h.owner_id) as owner_is_member
       from safespace.houses h left join safespace.users u on u.house_id = h.id
      group by h.id, h.owner_id`,
  );
  for (const row of rows) {
    assert.ok(Number(row.n) >= 1 && Number(row.n) <= houses.HOUSE_MAX_MEMBERS, `house size ${row.n}`);
    assert.equal(row.owner_is_member, true, 'the owner must be a member');
  }
  return rows;
}

test('7 people joining a house of 5 at once: exactly one gets in', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(5);
  const joiners = await Promise.all(Array.from({ length: 7 }, (_, i) => racer(`J${i}`)));
  const results = await race(7, (i) => houses.joinHouse(joiners[i].id, code));
  assert.equal(fulfilled(results).length, 1);
  assert.ok(rejected(results).every((r) => r.reason?.code === 'HOUSE_FULL'));
  assert.equal((await houses.getHouseView(owner.id)).house.members.length, 6);
  await houseInvariants();
});

test('one person joining two houses at once ends up in one', { skip }, async () => {
  await resetDb();
  const a = await raceHouse(1);
  const b = await raceHouse(1);
  const p = await racer('Double');
  const results = await Promise.allSettled([houses.joinHouse(p.id, a.code), houses.joinHouse(p.id, b.code)]);
  assert.equal(fulfilled(results).length, 1);
  assert.equal(rejected(results)[0].reason?.code, 'ALREADY_IN_HOUSE');
  await houseInvariants();
});

test('the owner leaving while others join leaves a valid owner', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(2);
  const joiners = await Promise.all(Array.from({ length: 3 }, (_, i) => racer(`L${i}`)));
  const results = await Promise.allSettled([
    houses.leaveHouse(owner.id),
    ...joiners.map((j) => houses.joinHouse(j.id, code)),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  const rows = await houseInvariants();
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].owner_id, owner.id);
});

test('the last member leaving while someone joins never strands the joiner', { skip }, async () => {
  await resetDb();
  const { owner, code } = await raceHouse(1);
  const joiner = await racer('Late');
  const [leave, join] = await Promise.allSettled([houses.leaveHouse(owner.id), houses.joinHouse(joiner.id, code)]);
  assert.equal(leave.status, 'fulfilled');
  const rows = await houseInvariants();
  if (join.status === 'fulfilled') {
    assert.equal(rows.length, 1);
    assert.equal(rows[0].owner_id, joiner.id);
  } else {
    assert.equal(join.reason?.code, 'CODE_INVALID');
    assert.equal(rows.length, 0);
  }
});
```

- [ ] **Step 2: Run on real Postgres**

Run: `npm run test:pg`
Expected: all pass, 0 skipped. (Needs Docker running.)

- [ ] **Step 3: Prove the cap test catches a missing lock**

Temporarily delete `for update` from the invite-code `select` in `joinHouse`, run `npm run test:pg`, confirm "7 people joining a house of 5" FAILS (more than one joins), then restore the line with `git checkout server/houses.js` and re-run to confirm PASS. Do the same by replacing `lockUser(tx, userId)` in `joinHouse` with `readUser`-style `select … where id = $1` without `for update` to confirm "one person joining two houses" fails, then restore.

- [ ] **Step 4: Commit**

```bash
git add server/store.concurrency.test.mjs
git commit -m "test(houses): join and leave races on real Postgres"
```

---

### Task 6: The doorbell

**Files:**
- Create: `server/doorbell.js`, `server/doorbell.test.mjs`

**Interfaces:**
- Produces: `doorbellConfig(env) → { url, key } | null`; `ring(topics: string[], { timeoutMs = 2000, env = process.env }) → Promise<boolean>` (never throws).

- [ ] **Step 1: Write failing tests**

`server/doorbell.test.mjs`:

```js
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { doorbellConfig, ring } from './doorbell.js';

const env = { SUPABASE_URL: 'https://proj.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_test' };
const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });

test('unconfigured or empty rings do nothing', async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; return new Response('{}'); };
  assert.equal(doorbellConfig({}), null);
  assert.equal(await ring(['house-a'], { env: {} }), false);
  assert.equal(await ring([], { env }), false);
  assert.equal(called, false);
});

test('a ring is one empty broadcast per topic, with the secret only in apikey', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 202 }); };
  assert.equal(await ring(['house-a', 'house-a', 'house-b'], { env }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://proj.supabase.co/realtime/v1/api/broadcast');
  assert.equal(calls[0].init.headers.apikey, 'sb_secret_test');
  assert.equal(calls[0].init.headers.authorization, undefined);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    messages: [
      { topic: 'house-a', event: 'changed', payload: {}, private: false },
      { topic: 'house-b', event: 'changed', payload: {}, private: false },
    ],
  });
});

test('failures and timeouts are swallowed', async () => {
  globalThis.fetch = async () => new Response('nope', { status: 500 });
  assert.equal(await ring(['house-a'], { env }), false);
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  assert.equal(await ring(['house-a'], { env }), false);
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const started = Date.now();
  assert.equal(await ring(['house-a'], { env, timeoutMs: 50 }), false);
  assert.ok(Date.now() - started < 1000);
});
```

Run: `node --test server/doorbell.test.mjs` — Expected: FAIL (module not found).

- [ ] **Step 2: Implement**

`server/doorbell.js`:

```js
// The "doorbell": after a house changes, tell that house's open apps to refetch.
//
// It is a Supabase Realtime broadcast with no content. Clients learn what changed only
// by calling GET /api/house with their own session, so nothing private travels through
// Supabase. A ring is best-effort: it is bounded by a timeout and never fails a request;
// apps also refetch on focus and every five minutes.
const DEFAULT_TIMEOUT_MS = 2000;

export function doorbellConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

export async function ring(topics, { timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env } = {}) {
  const config = doorbellConfig(env);
  const unique = [...new Set((topics || []).filter(Boolean))];
  if (!config || !unique.length) return false;
  try {
    const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: config.key },
      body: JSON.stringify({
        messages: unique.map((topic) => ({ topic, event: 'changed', payload: {}, private: false })),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error(`[doorbell] broadcast returned ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[doorbell] broadcast failed:', error?.name || 'error');
    return false;
  }
}
```

- [ ] **Step 3: Run to verify they pass**

Run: `node --test server/doorbell.test.mjs` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/doorbell.js server/doorbell.test.mjs
git commit -m "feat(server): Supabase Realtime doorbell"
```

---

### Task 7: Sessions required; demo family and public leaderboard removed

**Files:**
- Modify: `server/index.js` (imports, `DEFAULT_USER`, `actingUserId`, `/api/me`, `/api/family`, `/api/leaderboard`, pending/practice/simulate routes), `server/store.js` (delete `getFamily`, `getLeaderboard`)
- Test: `server/routes.test.mjs`

**Interfaces:**
- Produces: `requireUserId(req, res) → Promise<string | null>` in `index.js` (sends 401 `{ error: 'sign in first' }` and returns null when there is no session). Used by Tasks 8–9.

- [ ] **Step 1: Update the route tests first**

In `server/routes.test.mjs`:

1. Replace the `GET /api/family never exposes phone or email` test with:

```js
test('the demo-family and public leaderboard routes are gone', async () => {
  assert.equal((await fetch(base + '/api/family')).status, 404);
  assert.equal((await fetch(base + '/api/leaderboard')).status, 404);
});
```

2. Replace the `GET /api/me ignores a client-supplied ?user=` test with:

```js
test('GET /api/me needs a session and ignores ?user=', async () => {
  assert.equal((await fetch(base + '/api/me?user=you')).status, 401);
  await freshStore();
  const user = await registerVerifiedUser({ phone: '+6592220001', name: 'Me' });
  const token = await createSession(user.id);
  const res = await fetch(base + '/api/me?user=you', { headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.status, 200);
  const me = await res.json();
  assert.equal(me.id, user.id);
  assert.equal(me.phone, undefined);
});

test('practice results and pending results need a session', async () => {
  assert.equal((await fetch(base + '/api/drills/pending-result')).status, 401);
  assert.equal((await post('/api/drills/pending-result/x/ack')).status, 401);
  assert.equal(
    (await post('/api/drills/practice-result', { outcome: 'hung_up', channel: 'call', attemptId: 'a1' })).status,
    401,
  );
});
```

3. Every other test that relied on the anonymous `'you'` account through HTTP (the pending-result read/ack block near "no-answer must not alter XP", and the practice-result block that asserts `record.userId === 'you'`) must now sign in. In each, at the top create an account and pass its bearer header on every `fetch`/`post` to those routes, and replace `'you'` with `user.id` in the store calls and assertions:

```js
  const user = await registerVerifiedUser({ phone: '+6592220002', name: 'Tester' });
  const auth = { authorization: `Bearer ${await createSession(user.id)}` };
```

The file's `post(path, body)` helper takes no headers today; extend it to `post(path, body, headers = {})` and merge `headers` into its fetch init so these calls read `post('/api/drills/practice-result', payload, auth)`. Tests that use `'you'` only through store functions (`createDrillAttempt({ userId: 'you' })` with signed links, and webhook tests) keep working: the seed user still exists.

Run: `node --test server/routes.test.mjs`
Expected: FAIL — `/api/family` returns 200, `/api/me` returns 200 without a session.

- [ ] **Step 2: Implement**

In `server/index.js`:
- Delete `const DEFAULT_USER = …` and `async function actingUserId(req) { … }`.
- Add after `sessionUserId`:

```js
/** The signed-in user's id, or null after sending 401. Every account route needs one. */
async function requireUserId(req, res) {
  const userId = await sessionUserId(req);
  if (!userId) res.status(401).json({ error: 'sign in first' });
  return userId;
}
```

- `/api/me`: `const userId = await requireUserId(req, res); if (!userId) return; const user = await getUser(userId);` (keep the 404 branch).
- Delete the `/api/family` and `/api/leaderboard` routes and remove `getFamily`, `getLeaderboard` from the import.
- `/api/drills/pending-result`, `/api/drills/pending-result/:resultId/ack`, `/api/drills/practice-result`, and the demo `/api/drills/simulate`: start each handler with `const userId = await requireUserId(req, res); if (!userId) return;` and use `userId` where `await actingUserId(req)` was.

In `server/store.js` delete `getLeaderboard` and `getFamily` (and their comments). In `server/store.test.mjs` remove any test that imports them (search `getFamily`/`getLeaderboard`; the PII invariant they covered is now tested on `getHouseView` in Task 4).

- [ ] **Step 3: Run the suite**

Run: `node --test server/*.test.mjs`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/store.js server/store.test.mjs server/routes.test.mjs
git commit -m "feat(server)!: accounts required; drop the demo family and public leaderboard"
```

---

### Task 8: Sign-up route: optional name, avatar, `NO_ACCOUNT`; avatar route

**Files:**
- Modify: `server/index.js` (`/api/verify/check`, new `/api/me/avatar`)
- Test: `server/routes.test.mjs`

**Interfaces:**
- Consumes: `registerVerifiedUser({ phone, name, email, avatar })` (Task 3), `setUserAvatar` (Task 2), `cleanAvatar` (Task 2), `requireUserId` (Task 7).
- Produces: `POST /api/verify/check` body `{ phone, code, name?, email?, avatar? }` → 200 `{ ok, token, userId, name, emailVerified }` | 404 `{ code: 'NO_ACCOUNT', error }` | 400. `POST /api/me/avatar` `{ avatar }` → `{ ok, user }`.

- [ ] **Step 1: Write failing tests**

The route tests run with verification in production shape (no dev bypass), so `checkVerification` must be stubbed. Check how the existing `/api/verify/check` tests in `routes.test.mjs` get an approved code (search `verify/check`); reuse that mechanism. If none exists, add a Twilio mock to the file's `globalThis.fetch` override: set `process.env.TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` to test values before importing the app, and answer requests whose URL contains `/VerificationCheck` with `new Response(JSON.stringify({ status: 'approved' }), { status: 200, headers: { 'content-type': 'application/json' } })`. Then add:

```js
const AVATAR = { color: '#c77dff', glow: '#00ff88', hat: 'Crown', eyes: 'Visor', outfit: 'Neon' };

test('verify/check: returning numbers need no name; unknown ones get NO_ACCOUNT', async () => {
  await freshStore();
  const missing = await post('/api/verify/check', { phone: '+6592220010', code: '123456' });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, 'NO_ACCOUNT');

  const created = await post('/api/verify/check', { phone: '+6592220010', code: '123456', name: 'Nova', avatar: AVATAR });
  assert.equal(created.status, 200);
  const first = await created.json();
  assert.deepEqual((await getUser(first.userId)).avatar, AVATAR);

  const again = await post('/api/verify/check', { phone: '+6592220010', code: '123456' });
  assert.equal(again.status, 200);
  const second = await again.json();
  assert.equal(second.userId, first.userId);
  assert.equal(second.name, 'NOVA');
});

test('verify/check and /api/me/avatar reject avatars outside the allowlist', async () => {
  await freshStore();
  const bad = await post('/api/verify/check', { phone: '+6592220011', code: '123456', name: 'Bad', avatar: { hat: 'Tiara' } });
  assert.equal(bad.status, 400);
  const user = await registerVerifiedUser({ phone: '+6592220012', name: 'Av' });
  const auth = { authorization: `Bearer ${await createSession(user.id)}` };
  assert.equal((await post('/api/me/avatar', { avatar: AVATAR })).status, 401);
  assert.equal((await post('/api/me/avatar', { avatar: { ...AVATAR, eyes: 'Laser' } }, auth)).status, 400);
  const ok = await post('/api/me/avatar', { avatar: AVATAR }, auth);
  assert.equal(ok.status, 200);
  assert.deepEqual((await ok.json()).user.avatar, AVATAR);
});
```

Run: `node --test server/routes.test.mjs` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `server/index.js` add imports: `setUserAvatar` from `./store.js`, `cleanAvatar` from `./avatar.js`.

Replace the validation block of `/api/verify/check` (from `const name = …` through the `NAME_RE` check) with:

```js
  const name = String(req.body?.name || '').trim();
  const email = req.body?.email == null ? '' : String(req.body.email).trim();
  const avatarInput = req.body?.avatar ?? null;
  const avatar = avatarInput == null ? null : cleanAvatar(avatarInput);

  if (!E164.test(phone) || !code) return res.status(400).json({ error: 'phone and code required' });
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'email is not a valid address' });
  }
  // A name is needed only to create an account; a returning number keeps its own.
  if (name && !NAME_RE.test(name)) {
    return res.status(400).json({ error: 'name must use letters, spaces, apostrophes or hyphens' });
  }
  if (avatarInput != null && !avatar) return res.status(400).json({ error: 'avatar is invalid' });
```

and in the `try` block replace the `registerVerifiedUser` line with:

```js
    let user;
    try {
      user = await registerVerifiedUser({ phone, name, email: email || undefined, avatar: avatar ?? undefined });
    } catch (error) {
      if (error?.code === 'NO_ACCOUNT') {
        return res.status(404).json({ code: 'NO_ACCOUNT', error: 'no account for this number yet' });
      }
      throw error;
    }
```

Add after `/api/me/name`:

```js
api.post('/api/me/avatar', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  if (!cleanAvatar(req.body?.avatar)) return res.status(400).json({ error: 'avatar is invalid' });
  const user = await setUserAvatar(userId, req.body.avatar);
  await ringUser(userId);
  return res.json({ ok: true, user: accountView(user) });
});
```

(`ringUser` is added in Task 9; until then, add a stub right after `requireUserId`: `async function ringUser() {}` — Task 9 replaces it.)

- [ ] **Step 3: Run the suite**

Run: `node --test server/*.test.mjs` — Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/routes.test.mjs
git commit -m "feat(server): sign in without a name, avatar at sign-up, NO_ACCOUNT"
```

---

### Task 9: House routes, drill-run route, doorbell wiring, CSP

**Files:**
- Modify: `server/index.js`
- Test: `server/routes.test.mjs`

**Interfaces:**
- Consumes: everything exported by `server/houses.js` (Task 4), `ring` (Task 6), `requireUserId` (Task 7).
- Produces routes (all 401 without a session):
  - `GET /api/house` → `{ self, house }`
  - `POST /api/house` `{ name }` → `{ self, house }`
  - `POST /api/house/join` `{ code }` → `{ self, house }`
  - `POST /api/house/code` → `{ self, house }`
  - `POST /api/house/name` `{ name }` → `{ self, house }`
  - `POST /api/house/members/:id/remove` → `{ self, house }`
  - `POST /api/house/leave` → `{ self, house: null }`
  - `POST /api/drills/house-run` `{ clientKey, correct, cautious, wrong }` → `{ status, run, user }`
  - Errors: `{ error, code }` with statuses NOT_IN_HOUSE 404, ALREADY_IN_HOUSE 409, CODE_INVALID 400, HOUSE_FULL 409, NOT_OWNER 403, NOT_A_MEMBER 404, CANNOT_REMOVE_SELF 400, JOIN_RATE_LIMITED 429 (+ `Retry-After`), INVALID_HOUSE_NAME 400, INVALID_DRILL_RUN 400.

- [ ] **Step 1: Write failing tests**

In `server/routes.test.mjs`, before the app import add:

```js
process.env.SUPABASE_URL = 'https://doorbell.test';
process.env.SUPABASE_SECRET_KEY = 'route-test-doorbell-key';
```

In the `globalThis.fetch` override, before the final `return nativeFetch(...)` add:

```js
  if (String(url).startsWith('https://doorbell.test/')) {
    if (doorbellMode === 'fail') throw new TypeError('doorbell down');
    doorbellRings.push(...JSON.parse(String(init?.body || '{}')).messages.map((m) => m.topic));
    return new Response('{}', { status: 202 });
  }
```

with `const doorbellRings = []; let doorbellMode = 'ok';` declared next to `relayRequests`. Then add:

```js
let signedInSeq = 0;
async function signedIn(name) {
  signedInSeq += 1;
  const user = await registerVerifiedUser({
    phone: `+6594${String(signedInSeq).padStart(6, '0')}`, name,
  });
  return { user, auth: { authorization: `Bearer ${await createSession(user.id)}` } };
}
const getJson = async (path, headers) => {
  const res = await fetch(base + path, { headers });
  return { status: res.status, body: await res.json() };
};

test('house routes need a session', async () => {
  assert.equal((await fetch(base + '/api/house')).status, 401);
  for (const path of ['/api/house', '/api/house/join', '/api/house/code', '/api/house/name',
    '/api/house/members/x/remove', '/api/house/leave', '/api/drills/house-run']) {
    assert.equal((await post(path, {})).status, 401, path);
  }
});

test('create, join, rename, remove and leave over HTTP, ringing after each change', async () => {
  await freshStore();
  const owner = await signedIn('Owner');
  const guest = await signedIn('Guest');
  assert.deepEqual((await getJson('/api/house', owner.auth)).body.house, null);

  doorbellRings.length = 0;
  const created = await post('/api/house', { name: 'The Tans' }, owner.auth);
  assert.equal(created.status, 200);
  const { house } = await created.json();
  assert.deepEqual(doorbellRings, [house.doorbell]);

  const joined = await post('/api/house/join', { code: house.inviteCode }, guest.auth);
  assert.equal(joined.status, 200);
  assert.equal((await joined.json()).house.members.length, 2);

  assert.equal((await post('/api/house/name', { name: 'Mine' }, guest.auth)).status, 403);
  assert.equal((await post('/api/house/code', {}, guest.auth)).status, 403);
  assert.equal((await post('/api/house/name', { name: 'Renamed' }, owner.auth)).status, 200);

  const removed = await post(`/api/house/members/${guest.user.id}/remove`, {}, owner.auth);
  assert.equal(removed.status, 200);
  assert.equal((await getJson('/api/house', guest.auth)).body.house, null);

  const left = await post('/api/house/leave', {}, owner.auth);
  assert.deepEqual((await left.json()).house, null);
});

test('wrong and expired codes get the same answer', async () => {
  await freshStore();
  const p = await signedIn('Guesser');
  const res = await post('/api/house/join', { code: 'ZZZ-ZZZ' }, p.auth);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, 'CODE_INVALID');
  assert.doesNotMatch(body.error, /expire/i);
});

test('GET /api/house never exposes phone or email', async () => {
  await freshStore();
  const owner = await signedIn('Owner');
  const { house } = await (await post('/api/house', { name: 'Private' }, owner.auth)).json();
  const guest = await signedIn('Guest');
  await post('/api/house/join', { code: house.inviteCode }, guest.auth);
  const text = JSON.stringify((await getJson('/api/house', owner.auth)).body);
  for (const leak of ['"phone"', '"email"', 'Hash', '+6594']) assert.ok(!text.includes(leak), leak);
});

test('a failing doorbell never fails the request', async () => {
  await freshStore();
  const p = await signedIn('Owner');
  doorbellMode = 'fail';
  try {
    assert.equal((await post('/api/house', { name: 'Quiet' }, p.auth)).status, 200);
  } finally {
    doorbellMode = 'ok';
  }
});

test('house drill runs record once and ring the house', async () => {
  await freshStore();
  const p = await signedIn('Runner');
  const { house } = await (await post('/api/house', { name: 'Runners' }, p.auth)).json();
  doorbellRings.length = 0;
  const run = { clientKey: 'k1', correct: 5, cautious: 1, wrong: 0 };
  const first = await (await post('/api/drills/house-run', run, p.auth)).json();
  assert.equal(first.status, 'completed');
  assert.equal(first.run.xpGained, 550);
  assert.equal((await (await post('/api/drills/house-run', run, p.auth)).json()).status, 'duplicate');
  assert.ok(doorbellRings.includes(house.doorbell));
  assert.equal((await post('/api/drills/house-run', { clientKey: 'k2', correct: 0, cautious: 0, wrong: 0 }, p.auth)).status, 400);
});

test('the CSP allows the Supabase realtime origin', async () => {
  const csp = (await fetch(base + '/api/health')).headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self' https:\/\/doorbell\.test wss:\/\/doorbell\.test/);
});
```

Run: `node --test server/routes.test.mjs` — Expected: FAIL (routes 404).

- [ ] **Step 2: Implement**

In `server/index.js`:

1. Imports:

```js
import {
  HouseError,
  createHouse,
  doorbellForUser,
  getHouseView,
  joinHouse,
  leaveHouse,
  recordHouseRun,
  regenerateInviteCode,
  removeMember,
  renameHouse,
} from './houses.js';
import { ring } from './doorbell.js';
```

2. CSP: add above the security-header middleware

```js
// The app's realtime socket goes straight to Supabase, so allow that one origin.
function supabaseConnectSources() {
  try {
    const url = new URL(process.env.SUPABASE_URL || '');
    return url.protocol === 'https:' ? [url.origin, `wss://${url.host}`] : [];
  } catch {
    return [];
  }
}
```

and replace the `"connect-src 'self'",` entry with `["connect-src 'self'", ...supabaseConnectSources()].join(' '),`.

3. Replace the Task 8 `ringUser` stub with:

```js
/** Ring the house of a user whose visible stats just changed. Never throws. */
async function ringUser(userId) {
  try {
    const topic = await doorbellForUser(userId);
    if (topic) await ring([topic]);
  } catch (error) {
    console.error('[doorbell] lookup failed:', error?.message || error);
  }
}

const HOUSE_ERRORS = {
  NOT_IN_HOUSE: [404, "you're not in a house"],
  ALREADY_IN_HOUSE: [409, 'leave your current house first'],
  CODE_INVALID: [400, "that code isn't valid; ask for a new one"],
  HOUSE_FULL: [409, 'that house is full (6 players)'],
  NOT_OWNER: [403, 'only the house owner can do that'],
  NOT_A_MEMBER: [404, "that player isn't in your house"],
  CANNOT_REMOVE_SELF: [400, 'use LEAVE HOUSE to leave your own house'],
  JOIN_RATE_LIMITED: [429, 'too many wrong codes; try again later'],
  INVALID_HOUSE_NAME: [400, 'house names are 1–30 letters, numbers or spaces'],
  INVALID_DRILL_RUN: [400, 'that drill run is not valid'],
};

function houseFail(res, error) {
  if (!(error instanceof HouseError)) throw error;
  const [status, message] = HOUSE_ERRORS[error.code] ?? [400, 'house request failed'];
  if (error.retryAfterMs) res.set('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterMs / 1000))));
  return res.status(status).json({ error: message, code: error.code });
}

/** Run a house change for the signed-in user, ring, and answer with the fresh view. */
function houseRoute(change) {
  return async (req, res) => {
    const userId = await requireUserId(req, res);
    if (!userId) return;
    try {
      const result = await change(userId, req);
      await ring(result?.ring ?? []);
      return res.json(await getHouseView(userId));
    } catch (error) {
      return houseFail(res, error);
    }
  };
}
```

4. Routes (after `/api/me/avatar`):

```js
// --- Houses -------------------------------------------------------------------

api.get('/api/house', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  return res.json(await getHouseView(userId));
});

api.post('/api/house', houseRoute((userId, req) => createHouse(userId, req.body?.name)));
api.post('/api/house/join', houseRoute((userId, req) =>
  joinHouse(userId, req.body?.code, { requesterKey: req.ip })));
api.post('/api/house/code', houseRoute((userId) => regenerateInviteCode(userId)));
api.post('/api/house/name', houseRoute((userId, req) => renameHouse(userId, req.body?.name)));
api.post('/api/house/members/:memberId/remove', houseRoute((userId, req) =>
  removeMember(userId, req.params.memberId)));
api.post('/api/house/leave', houseRoute((userId) => leaveHouse(userId)));

api.post('/api/drills/house-run', async (req, res) => {
  const userId = await requireUserId(req, res);
  if (!userId) return;
  const body = req.body || {};
  try {
    const result = await recordHouseRun(userId, {
      clientKey: body.clientKey,
      correct: body.correct,
      cautious: body.cautious,
      wrong: body.wrong,
    });
    if (result.status === 'completed') await ringUser(userId);
    return res.json({ status: result.status, run: result.run, user: accountView(result.user) });
  } catch (error) {
    return houseFail(res, error);
  }
});
```

5. Ring on other stat changes. Add `await ringUser(…)` right before the success `return res.json(…)` in:
   - `/api/drills/practice-result`: `if (result.applied) await ringUser(userId);`
   - `/api/me/name`: capture the user first, `await ringUser(userId);` then respond.
   - `/api/verify/check`: after `registerVerifiedUser`, `await ringUser(user.id);` (a returning player may have changed their mascot).
   - each call site of `completeDrillAttempt` (the in-app complete route, the drill-link confirm handler and the Vapi webhook): after the call, `if (result.applied) await ringUser(result.record.userId);` (use the local variable name at that site, e.g. `completion`).
   - `/api/drills/simulate`: `await ringUser(userId);`

- [ ] **Step 3: Run the suite**

Run: `node --test server/*.test.mjs` — Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add server/index.js server/routes.test.mjs
git commit -m "feat(server): house API with doorbell rings"
```

---

### Task 10: Client API helpers and `useHouse()`

**Files:**
- Create: `src/app/api.ts`, `src/app/house.ts`
- Modify: `src/vite-env.d.ts`, `src/app/App.tsx:1-92` (remove the helpers that move)

**Interfaces:**
- Produces (`api.ts`): `sessionToken()`, `setSessionToken(token|null)`, `authHeaders()`, `handleApiAuth(res)`, `apiGet<T>(path) → T|null`, `apiPost<T>(path, body) → { ok, status, data: T | {error?, code?} }`.
- Produces (`house.ts`): types `Avatar`, `MemberView`, `HouseView`, `HouseState = { self: MemberView|null, house: HouseView|null }`; functions `createHouse(name)`, `joinHouse(code)`, `regenerateCode()`, `renameHouse(name)`, `removeMember(id)`, `leaveHouse()`, `postHouseRun(run)`, `saveAvatar(avatar)`; hook `useHouse(enabled: boolean) → { state, loading, refresh, apply(next: HouseState) }`; `formatCodeInput(raw) → string`; invite helpers `takePendingInvite()`, `peekPendingInvite()`, `captureInviteFromUrl()`.

- [ ] **Step 1: Move the session helpers**

Create `src/app/api.ts` with the bodies of `TOKEN_KEY`, `sessionToken`, `setSessionToken`, `authHeaders`, `handleApiAuth` and `apiGet` cut from the top of `App.tsx` (unchanged, now `export`ed), plus:

```ts
export type ApiResult<T> = { ok: boolean; status: number; data: T & { error?: string; code?: string } };

export async function apiPost<T = unknown>(path: string, body: unknown = {}): Promise<ApiResult<T>> {
  try {
    const r = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    handleApiAuth(r);
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Could not reach the server." } as T & { error: string } };
  }
}
```

In `App.tsx` replace the removed code with:

```ts
import { apiGet, apiPost, authHeaders, handleApiAuth, sessionToken, setSessionToken } from "./api";
```

Run: `npm run typecheck` — Expected: PASS.

- [ ] **Step 2: Type the build-time env**

Append to `src/vite-env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 3: Write `src/app/house.ts`**

```ts
// House data for the app: API calls plus useHouse(), which keeps one copy of
// GET /api/house fresh. It refetches when the house's doorbell rings (a content-free
// Supabase Realtime broadcast), when the app regains focus, and every five minutes.
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { apiGet, apiPost, sessionToken } from "./api";

export type Avatar = { color: string; glow: string; hat: string; eyes: string; outfit: string };
export type WeekRun = { correct: number; cautious: number; wrong: number };
export type MemberView = {
  id: string; name: string; avatar: Avatar | null;
  level: number; xp: number; xpMax: number; streak: number;
  timesSafe: number; timesScammed: number; badgeCount: number; badgeTotal: number;
  recentDrillResult: "WON" | "LOST" | null;
  isOwner: boolean; activeThisWeek: boolean; safeThisWeek: boolean; weekRun: WeekRun | null;
};
export type HouseView = {
  id: string; name: string; ownerId: string;
  inviteCode: string | null; inviteExpiresAt: string | null;
  doorbell: string; members: MemberView[];
};
export type HouseState = { self: MemberView | null; house: HouseView | null };

export const createHouse = (name: string) => apiPost<HouseState>("/api/house", { name });
export const joinHouse = (code: string) => apiPost<HouseState>("/api/house/join", { code });
export const regenerateCode = () => apiPost<HouseState>("/api/house/code");
export const renameHouse = (name: string) => apiPost<HouseState>("/api/house/name", { name });
export const removeMember = (id: string) =>
  apiPost<HouseState>(`/api/house/members/${encodeURIComponent(id)}/remove`);
export const leaveHouse = () => apiPost<HouseState>("/api/house/leave");
export const saveAvatar = (avatar: Avatar) => apiPost<{ user: unknown }>("/api/me/avatar", { avatar });
export const postHouseRun = (run: { clientKey: string } & WeekRun) =>
  apiPost<{ status: string; run: { xpGained: number } }>("/api/drills/house-run", run);

/** Upper-case, drop anything outside the code alphabet, and add the dash: "k7p3q" → "K7P-3Q". */
export function formatCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "").slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)}-${clean.slice(3)}` : clean;
}

// Invite links look like /?house=K7P3QX. The code waits in storage through sign-up
// and pre-fills the join box; nothing joins until the player taps JOIN.
const INVITE_KEY = "safespace_pending_invite";
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("house");
    if (!code) return;
    localStorage.setItem(INVITE_KEY, formatCodeInput(code));
    url.searchParams.delete("house");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch { /* storage blocked: the player can type the code */ }
}
export function peekPendingInvite(): string | null {
  try { return localStorage.getItem(INVITE_KEY); } catch { return null; }
}
export function takePendingInvite(): string | null {
  const code = peekPendingInvite();
  try { localStorage.removeItem(INVITE_KEY); } catch { /* ignore */ }
  return code;
}

let realtime: SupabaseClient | null | undefined;
function realtimeClient(): SupabaseClient | null {
  if (realtime !== undefined) return realtime;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  realtime = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return realtime;
}

const BACKUP_REFRESH_MS = 5 * 60 * 1000;

export function useHouse(enabled: boolean) {
  const [state, setState] = useState<HouseState>({ self: null, house: null });
  const [loading, setLoading] = useState(enabled);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionToken()) return;
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      const next = await apiGet<HouseState>("/api/house");
      if (next) setState(next);
      setLoading(false);
    })().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void refresh(), BACKUP_REFRESH_MS);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [enabled, refresh]);

  const doorbell = state.house?.doorbell ?? null;
  useEffect(() => {
    const client = realtimeClient();
    if (!enabled || !doorbell || !client) return;
    const channel = client
      .channel(doorbell)
      .on("broadcast", { event: "changed" }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [enabled, doorbell, refresh]);

  return { state, loading, refresh, apply: setState };
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build` — Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api.ts src/app/house.ts src/vite-env.d.ts src/app/App.tsx
git commit -m "feat(app): API helpers and useHouse with a realtime doorbell"
```

---

### Task 11: Real members replace the hardcoded family

**Files:**
- Modify: `src/app/App.tsx` (FamilyMember data and every `FAMILY_MEMBERS`/`MEMBER_MAP`/`FamilyChar`/`activeMemberId` use)

**Interfaces:**
- Consumes: `useHouse`, `MemberView`, `HouseState` (Task 10).
- Produces (inside `App.tsx`): `toFamilyMember(m: MemberView): FamilyMember` (adds `avatar`), `MembersContext`, `useMembers(): FamilyMember[]`, `useMemberMap(): Record<string, FamilyMember>`, `SelfIdContext`, `useSelfId(): string`, `MemberChar({ member, size })`.

The `FamilyMember` shape stays so the existing screens keep compiling; only its source changes.

- [ ] **Step 1: Replace the data**

1. Add `avatar: AvatarConfig` to `type FamilyMember` and delete `FAMILY_MEMBERS`, `MEMBER_MAP`, `familyShameFallback`, `FAMILY_NAME_TO_ID`, `CharGrandma`, `CharMum`, `CharDad`, `CharKid`, `FamilyChar`, `AnimatedFamilyChar`, and the non-PIXI entries in `INITIAL_CHAT` (keep only the first PIXI message, reworded to "Hi! I'm PIXI, your scam-fighter coach. I'll drop by after drills to share tips and celebrate wins.").

2. Add in their place:

```tsx
const ROOM_BACKGROUNDS: Record<string, string> = {
  "#4ecdc4": "#081420", "#ff6b35": "#1a0e08", "#c77dff": "#100c20",
  "#ffe66d": "#161408", "#ff2d55": "#1a0810", "#00ff88": "#0c1a10",
};
const DEFAULT_AVATAR: AvatarConfig = DEFAULT_PROFILE.avatar;

function toFamilyMember(m: MemberView): FamilyMember {
  const avatar = { ...DEFAULT_AVATAR, ...(m.avatar ?? {}) };
  return {
    id: m.id, name: m.name, role: m.isOwner ? "HOUSE OWNER" : "HOUSEMATE",
    level: m.level, xp: m.xp, xpMax: m.xpMax, streak: m.streak,
    timesSafe: m.timesSafe, timesScammed: m.timesScammed,
    safeThisWeek: m.safeThisWeek, recentDrillResult: m.recentDrillResult,
    primaryColor: avatar.color, roomName: `${m.name}'S ROOM`,
    roomBg: ROOM_BACKGROUNDS[avatar.color] ?? "#081420",
    badgeCount: m.badgeCount, badgeTotal: m.badgeTotal, coins: 0, avatar,
  };
}

const MembersContext = createContext<FamilyMember[]>([]);
const SelfIdContext = createContext<string>("");
const useMembers = () => useContext(MembersContext);
const useSelfId = () => useContext(SelfIdContext);
function useMemberMap(): Record<string, FamilyMember> {
  const members = useMembers();
  return useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
}

function MemberChar({ member, size = 44 }: { member: Pick<FamilyMember, "avatar">; size?: number }) {
  const a = member.avatar;
  return <PixelMascot size={size} animate color={a.color} hat={a.hat} eyes={a.eyes} outfit={a.outfit} />;
}
```

Add `createContext, useContext` to the React import and `import { useHouse, type MemberView } from "./house";`.

- [ ] **Step 2: Provide members from `App()`**

In `App()`:
- Delete `activeMemberId`/`setActiveMemberId`, `customizeMemberId`, `lastViewedMemberId` state.
- Add:

```tsx
  const signedIn = !!sessionToken();
  const house = useHouse(signedIn);
  const selfView = house.state.self;
  const selfId = selfView?.id ?? "me";
  const members = useMemo(() => {
    const views = house.state.house?.members ?? (selfView ? [selfView] : []);
    return views.map(toFamilyMember);
  }, [house.state, selfView]);
  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const activeMemberId = selfId; // one player per phone now
```

- Wrap the returned JSX root in `<MembersContext.Provider value={members}><SelfIdContext.Provider value={selfId}>…</SelfIdContext.Provider></MembersContext.Provider>`.
- In `App()` helpers, replace `MEMBER_MAP[x]` with `memberMap[x]` and `FAMILY_MEMBERS` with `members`.
- `claimedDailyToday`: `{ [selfId]: rewardClaims.dailyByMember[selfId] === todayKey }`.
- `collectPayday`: pay only `selfId` (base, plus bonus when `selfView?.safeThisWeek`); `emitNotifPayday` body: `selfView?.safeThisWeek ? "You earned the safety bonus" : "Stay safe this week to earn the bonus"`.
- `handleFamilyComplete`: `emitFamilyRoundEvent(selfId, outcome);` (drop the `FAMILY_NAME_TO_ID` lookup).
- `openCustomize(memberId)`: only opens for `memberId === selfId`; the `customize` screen uses `selfId`; `ProfileEditScreen onHouse={() => setScreen("customize")}`.
- Remove `onSelectMember` from `ShopScreen` usage.

- [ ] **Step 3: Update components that read the old globals**

Use these exact replacements (search each symbol; `npm run typecheck` lists any you miss):

| Where | Replace with |
|---|---|
| `loadHomeInventory` / `defaultHomeInventory` defaults built from `FAMILY_MEMBERS` | `coins: {}`, `purchasedItems: {}`; keep parsing of stored maps as-is |
| `DollhouseRoom`, `MemberProfileOverlay`: `useIdleFrame`/`charSize` by role, `<FamilyChar id=…>` | `<MemberChar member={member} size={44} />` (overlay: `size={56}`) |
| `FamilySafetyBar` | `const members = useMembers();` then use `members` instead of `FAMILY_MEMBERS`; label `HOUSE SAFETY`; coin box label `YOU` and show `coins[useSelfId()] ?? 0` |
| `ResultScreen`: `MEMBER_MAP[activeMemberId]` | `useMemberMap()[activeMemberId]` |
| `ShopScreen` | delete the member-picker `<div style={{ display: "flex", gap: 8 }}>…</div>` block and the `onSelectMember` prop; `member = useMemberMap()[activeMemberId]`; header `SHOPPING FOR` → `YOUR COINS` |
| `ProfileScreen`: `MEMBER_MAP[…] ?? FAMILY_MEMBERS[1]` | `useMemberMap()[activeMemberId]`; guard `if (!activeMember) return null;` |
| `CustomizeScreen`: `FAMILY_MEMBERS.find(…) ?? FAMILY_MEMBERS[1]` | `useMemberMap()[memberId]`; guard `if (!member) return null;` |
| `FamilyChatScreen`, `NotificationsScreen`, `NotificationDetailScreen`: `MEMBER_MAP[…]`, `<FamilyChar id=…>` | `useMemberMap()[…]`, `<MemberChar member={member} size={…} />` (same size as before) |
| `PaydayScreen` member list | `useMembers().filter((m) => m.id === useSelfId())` — call both hooks at the top of the component |
| `FamilyDrillIntroScreen` row of four `AnimatedFamilyChar` | `useMembers().slice(0, 6).map((m) => <MemberChar key={m.id} member={m} size={44} />)` with the member name under each |
| `FamilyRoundScreen`: `memberColors[…]`, `<AnimatedFamilyChar name={scenario.targetMember}>`, `{scenario.targetMember.toUpperCase()}` | color `#4ecdc4`; `<PixelMascot size={36} animate />`; text `A HOUSEMATE` |
| `FamilySummaryScreen` "FAMILY RESULTS" per-member list | delete that block (a run is one player's answers); keep totals and badges |

Scenario copy: in `FAMILY_SCENARIOS` keep `targetMember` (it is no longer displayed). In any scenario `body`/`sender` text that names Grandma/Mum/Dad/Kid as the reader, leave it — those are in-story characters, not players.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run build` — Expected: PASS. Run `grep -n "FAMILY_MEMBERS\|MEMBER_MAP\|FamilyChar\|CharGrandma\|setActiveMemberId" src/app/App.tsx` — Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(app): house members replace the hardcoded family"
```

---

### Task 12: Home — full-screen solo room or dollhouse

**Files:**
- Modify: `src/app/App.tsx` (`FamilyHomeScreen`, `MemberProfileOverlay`, `HouseRoof`)

**Interfaces:**
- Consumes: `useMembers`, `useSelfId`, `MemberChar` (Task 11); `HouseView` (Task 10).
- Produces: `FamilyHomeScreen` props gain `house: HouseView | null`, `onPlayWithOthers: () => void`, `onRemoveMember: (id: string) => void`.

- [ ] **Step 1: Solo room component**

Add above `FamilyHomeScreen`:

```tsx
function SoloRoom({ member, coins, purchasedItems, inviteCode, onTap, onPlayWithOthers }: {
  member: FamilyMember; coins: number; purchasedItems: string[];
  inviteCode: string | null; onTap: () => void; onPlayWithOthers: () => void;
}) {
  return (
    <div style={{ position: "relative", flex: 1, minHeight: 420, backgroundColor: member.roomBg, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 15px,rgba(255,255,255,0.015) 15px,rgba(255,255,255,0.015) 16px),repeating-linear-gradient(90deg,transparent,transparent 15px,rgba(255,255,255,0.015) 15px,rgba(255,255,255,0.015) 16px)" }} />
      <button
        onClick={onPlayWithOthers}
        style={{ position: "absolute", top: 12, right: 12, zIndex: 2, backgroundColor: "#0a0e1a", border: "3px solid #4ecdc4", padding: "6px 8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#4ecdc4" }}
      >
        {inviteCode ? `+ INVITE · ${inviteCode}` : "+ PLAY WITH OTHERS"}
      </button>
      <div style={{ position: "absolute", top: 14, left: 14, fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: member.primaryColor }}>{member.roomName}</div>
      <div style={{ position: "absolute", top: 30, left: 14, fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#6b8ba4" }}>LVL {member.level} · {member.streak} STREAK</div>
      <div style={{ position: "absolute", top: 46, left: 14, display: "flex", alignItems: "center", gap: 4 }}>
        <IconCoin size={10} color="#ffe66d" />
        <span style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 8, color: "#ffe66d" }}>{coins}</span>
      </div>
      <PurchasedRoomFurniture itemIds={purchasedItems} accent={member.primaryColor} />
      <button onClick={onTap} style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <SafetyBadge safe={member.safeThisWeek} size={22} />
        <MemberChar member={member} size={112} />
        <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: member.primaryColor }}>{member.name}</div>
      </button>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 6, background: `linear-gradient(90deg,${member.primaryColor}22,${member.primaryColor}55,${member.primaryColor}22)` }} />
    </div>
  );
}
```

- [ ] **Step 2: Switch home on house size**

In `FamilyHomeScreen`:
- Add the new props; read `const members = useMembers(); const selfId = useSelfId(); const self = members.find((m) => m.id === selfId);`.
- `const together = members.length >= 2;`
- When `!together` and `self`: render the header bar with `<FamilySafetyBar coins={coins} />` is skipped; render `<SoloRoom member={self} coins={coins[selfId] ?? 0} purchasedItems={purchasedItems[selfId] ?? []} inviteCode={house?.inviteCode ?? null} onTap={() => setSelectedMember(self)} onPlayWithOthers={onPlayWithOthers} />` followed by the existing buttons block (with `[ START FAMILY DRILL ]` renamed `[ START HOUSE DRILL ]`).
- When `together`: keep the current layout, mapping `members` into `DollhouseRoom` (coins: `m.id === selfId ? coins[selfId] ?? 0 : null`), and add a small `+ INVITE` `PixelBtn` under the roof calling `onPlayWithOthers`.
- In `DollhouseRoom` make `coins: number | null` and hide the coin row when null; drop the starter-furniture `FURNITURE_STORE.filter(item => item.memberId === member.id …)` block's role dependence by leaving it (it naturally renders nothing for real ids); pass `purchasedItems` only for `selfId` (others `[]`, since furniture is still per phone).
- The "OPT IN TO REAL CALL DRILLS" button: every player is now signed in, so always render the "RUN A REAL DRILL" variant.
- `HouseRoof` label: `house?.name ?? "YOUR HOUSE"` — pass it as a prop `title`.
- Footer text: `Train together. Protect the whole house.`

- [ ] **Step 3: Owner can remove from the profile overlay**

`MemberProfileOverlay` gains `canRemove: boolean` and `onRemove: () => void`. Under the CUSTOMIZE ROOM button (which now shows only when `member.id === useSelfId()`), render when `canRemove`:

```tsx
<PixelBtn onClick={() => { if (window.confirm(`Remove ${member.name} from the house?`)) { onRemove(); onClose(); } }} color="#ff2d55" textColor="#0a0e1a" size="sm" full>
  REMOVE FROM HOUSE
</PixelBtn>
```

`canRemove = !!house && house.ownerId === selfId && member.id !== selfId`. Hide the coin panel for members other than self.

- [ ] **Step 4: Wire in `App()`**

```tsx
  const handleRemoveMember = async (id: string) => {
    const r = await removeMember(id);
    if (r.ok) house.apply(r.data); else window.alert(r.data.error ?? "Could not remove that player.");
  };
```

Pass `house={house.state.house}`, `onPlayWithOthers={() => setScreen("house")}`, `onRemoveMember={handleRemoveMember}` (the `"house"` screen is added in Task 14; add `"house" | "house-settings"` to `type Screen` now so this compiles).

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run build` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(app): solo room fills the screen; houses show the dollhouse"
```

---

### Task 13: Leaderboard and house drill from the server

**Files:**
- Modify: `src/app/App.tsx` (`LeaderboardScreen`, `FameBoard`, `ShameBoard`, `HALL_OF_FAME`, `handleFamilyNext`, family-round `onEnd`, `FamilySummaryScreen`)

**Interfaces:**
- Consumes: `useMembers`, `useSelfId` (Task 11); `postHouseRun` (Task 10).
- Produces: `FamilySummaryScreen` prop `serverXp: number | null | "pending"`.

- [ ] **Step 1: Boards from members**

- Delete `HALL_OF_FAME` and the `apiGet("/api/leaderboard")`/`apiGet("/api/shame")` effects.
- `FameBoard({ onPlayWithOthers })`: `const board = [...useMembers()].sort((a, b) => b.level - a.level || b.xp - a.xp).map((m, i) => ({ rank: i + 1, member: m }));` Each row shows `<MemberChar member={m} size={28} />`, name, `{m.timesSafe} WINS · LVL {m.level}`, and `{m.xp} XP`. Intro text: `Ranks celebrate safe practice in your house.`
- `ShameBoard({ onPlayWithOthers })`: rows are members with `!safeThisWeek`, sorted by `timesScammed` desc. Banner: `SCAMMED THIS WEEK`. Empty state: `NOBODY SCAMMED THIS WEEK. KEEP IT THAT WAY.` "YOU" highlighting uses `useSelfId()`.
- When `useMembers().length < 2`, both boards end with a panel: `PLAY WITH OTHERS TO COMPARE` and a `PixelBtn` `+ CREATE OR JOIN A HOUSE` calling `onPlayWithOthers`.
- `LeaderboardScreen({ onPlayWithOthers })` replaces its `activeMemberId` prop; in `App()` pass `onPlayWithOthers={() => setScreen("house")}`.

- [ ] **Step 2: Post finished house drills**

In `App()` add:

```tsx
  const [houseRunXp, setHouseRunXp] = useState<number | null | "pending">(null);
  // The latest answers, readable synchronously when the drill ends (state lags a render).
  const familyAnswersRef = useRef<typeof familyAnswers>([]);
  // One post per run, even if the end handler fires twice.
  const houseRunKeyRef = useRef<string | null>(null);

  const finishHouseDrill = () => {
    const answers = familyAnswersRef.current;
    const count = (o: FamilyOutcome) => answers.filter((a) => a.outcome === o).length;
    const run = { correct: count("correct"), cautious: count("cautious"), wrong: count("wrong") };
    if (run.correct + run.cautious + run.wrong === 0 || houseRunKeyRef.current) {
      if (!houseRunKeyRef.current) setHouseRunXp(null);
      return;
    }
    const clientKey = createAttemptId("house-run");
    houseRunKeyRef.current = clientKey;
    setHouseRunXp("pending");
    void postHouseRun({ clientKey, ...run }).then((r) => {
      setHouseRunXp(r.ok ? r.data.run.xpGained : null);
      if (r.ok) void house.refresh();
    });
  };
```

- In `goFamilyDrill` also reset `familyAnswersRef.current = []; houseRunKeyRef.current = null; setHouseRunXp(null);`.
- In `handleFamilyComplete`, build the answer once and keep the ref in step: `const next = [...familyAnswersRef.current, { scenarioId: scenario.id, action, outcome, foundClues }]; familyAnswersRef.current = next; setFamilyAnswers(next);` (replacing the functional `setFamilyAnswers((prev) => …)`).
- Call `finishHouseDrill()` immediately before each `setScreen("family-summary")` (in `handleFamilyNext` and in the `FamilyRoundScreen` `onEnd` handler).

Pass `serverXp={houseRunXp}` to `FamilySummaryScreen` and replace its local `totalXP` display with:

```tsx
{serverXp === "pending" ? "SAVING…" : serverXp === null ? "NOT SAVED — CHECK YOUR CONNECTION" : serverXp > 0 ? `+${serverXp} XP` : "XP ALREADY EARNED THIS WEEK"}
```

Rename header texts `FAMILY SAFE!` → `HOUSE SAFE!`.

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(app): leaderboards and house drill runs use real data"
```

---

### Task 14: First launch, sign-in and house screens

**Files:**
- Modify: `src/app/App.tsx` (`TitleScreen` usage, `RegisterScreen`, `AvatarCustomisationScreen`, `App()` routing, settings list)

**Interfaces:**
- Consumes: `apiPost`, `setSessionToken` (Task 10); house API functions and invite helpers (Task 10); `useHouse` (Task 11).
- Produces screens: `"start"`, `"new-character"`, `"sign-in"`, `"house"`, `"house-settings"` in `type Screen`; components `StartScreen`, `HouseChoiceScreen`, `HouseSettingsScreen`; `RegisterScreen` prop `mode: "new" | "returning"`.

- [ ] **Step 1: Title routes by session**

In `App()` `TitleScreen onNext`: after `unlock(); playSfx("select");`:

```tsx
if (sessionToken()) { goHome(); if (!hasSeenTutorial()) setTourOpen(true); }
else setScreen("start");
```

Call `captureInviteFromUrl()` once in a mount effect in `App()`.

Session expiry: in the existing `safespace-session-expired` listener also `setScreen("sign-in"); setSignInMode("returning");` (new state `const [signInMode, setSignInMode] = useState<"new" | "returning">("new");`).

- [ ] **Step 2: Start screen**

```tsx
function StartScreen({ onNew, onReturning }: { onNew: () => void; onReturning: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 gap-6">
      <Stars />
      <div className="relative z-10 flex flex-col items-center gap-6 w-full">
        <PixelMascot size={96} animate />
        <PixelBtn onClick={onNew} color="#00ff88" size="lg" full>[ NEW PLAYER ]</PixelBtn>
        <PixelBtn onClick={onReturning} color="#1a2340" textColor="#4ecdc4" size="md" full>I HAVE AN ACCOUNT</PixelBtn>
      </div>
    </div>
  );
}
```

Routing: `onNew → setSignInMode("new"); setScreen("new-character")`, `onReturning → setSignInMode("returning"); setScreen("sign-in")`.

- [ ] **Step 3: Character designer with a name**

Give `AvatarCustomisationScreen` optional props `onboarding?: { name: string; onName: (n: string) => void; onContinue: () => void }` and `onChange?: (a: AvatarConfig) => void`:
- `set` also calls `onChange?.(next)` so the draft is saved as the player goes.
- When `onboarding` is set: header title `DESIGN YOUR CHARACTER`; above the preview render

```tsx
<div style={{ marginBottom: 12 }}>
  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#6b8ba4", marginBottom: 8 }}>WHAT SHOULD WE CALL YOU?</div>
  <input maxLength={30} value={onboarding.name} onChange={(e) => onboarding.onName(e.target.value)} placeholder="YOUR NAME" autoComplete="nickname"
    style={{ width: "100%", padding: 12, backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", color: "#e8f4f8", fontFamily: "'Share Tech Mono', monospace", fontSize: 16, outline: "none" }} />
</div>
```

  and replace the SAVE/CANCEL row with one `PixelBtn` `[ CONTINUE ]`, disabled unless the name matches `/^[\p{L}][\p{L}\p{M} .'-]{0,29}$/u`, calling `onboarding.onContinue()`.

In `App()` render for `"new-character"`:

```tsx
<AvatarCustomisationScreen
  avatar={profile.avatar}
  onChange={(avatar) => updateProfile({ avatar })}
  onSave={(avatar) => updateProfile({ avatar })}
  onBack={() => setScreen("start")}
  onboarding={{
    name: profile.name === DEFAULT_PROFILE.name ? "" : profile.name,
    onName: (name) => updateProfile({ name }),
    onContinue: () => setScreen("sign-in"),
  }}
/>
```

- [ ] **Step 4: Sign-in screen modes**

`RegisterScreen({ mode, name, avatar, onDone, onNewPlayer, onBack })`:
- Remove the name field, `validName` checks and the `handleSave` name validation (save phone/email only).
- Header: `mode === "new" ? "SIGN UP" : "SIGN IN"`; intro copy: `Verify your phone. We only ever call this number, and you can stop anytime.`
- `verify()` body: `{ phone, code, email: email.trim() || undefined, ...(mode === "new" ? { name: name.trim(), avatar } : {}) }`.
- On `404` with `d.code === "NO_ACCOUNT"`: `setMsg("No account for this number yet.")` and show a `PixelBtn` `[ NEW PLAYER ]` calling `onNewPlayer`.
- On success: `setSessionToken(d.token)`, then `onDone(d.name)`.

In `App()` render `"sign-in"`:

```tsx
<RegisterScreen
  mode={signInMode}
  name={profile.name}
  avatar={profile.avatar}
  onNewPlayer={() => { setSignInMode("new"); setScreen("new-character"); }}
  onBack={() => setScreen(signInMode === "new" ? "new-character" : "start")}
  onDone={(name) => { finishSignIn(name); }}
/>
```

with

```tsx
  const finishSignIn = async (name: string) => {
    updateProfile({ name });
    setSessionEpoch((v) => v + 1);
    await house.refresh();
    const invite = peekPendingInvite();
    goHome();
    if (!hasSeenTutorial()) setTourOpen(true);
    if (invite) setScreen("house");
  };
```

Keep the existing `"register"` screen for the drill-intro "opt in" buttons, but render it as `mode="returning"` (everyone is signed in by then, so it is effectively a re-verify).

Sync the server avatar into the local profile: in an effect on `selfView?.avatar`, when it differs from `profile.avatar`, `updateProfile({ avatar: { ...DEFAULT_PROFILE.avatar, ...selfView.avatar } })`. When the player saves an avatar from profile editing while signed in, also `void saveAvatar(avatar).then(() => house.refresh())`.

- [ ] **Step 5: House choice screen**

```tsx
function HouseChoiceScreen({ initialCode, onCreate, onJoin, onBack }: {
  initialCode: string; onBack: () => void;
  onCreate: (name: string) => Promise<string | null>; onJoin: (code: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(formatCodeInput(initialCode));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true); setMsg("");
    const error = await action();
    setBusy(false);
    if (error) setMsg(error);
  };
  const input: React.CSSProperties = { width: "100%", padding: 12, backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", color: "#e8f4f8", fontFamily: "'Share Tech Mono', monospace", fontSize: 16, outline: "none" };
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PLAY WITH OTHERS" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#00ff88", marginBottom: 8 }}>CREATE A HOUSE</div>
          <input style={input} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. THE TANS" />
          <div style={{ height: 10 }} />
          <PixelBtn onClick={() => run(() => onCreate(name))} color="#00ff88" size="md" full disabled={busy || !name.trim()}>[ CREATE ]</PixelBtn>
        </PixelPanel>
        <PixelPanel accent="#4ecdc4" className="w-full">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 9, color: "#4ecdc4", marginBottom: 8 }}>JOIN WITH A CODE</div>
          <input style={{ ...input, letterSpacing: 6, textAlign: "center", fontSize: 22 }} value={code} onChange={(e) => setCode(formatCodeInput(e.target.value))} placeholder="K7P-3QX" autoCapitalize="characters" />
          <div style={{ height: 10 }} />
          <PixelBtn onClick={() => run(() => onJoin(code))} color="#4ecdc4" size="md" full disabled={busy || code.length !== 7}>[ JOIN ]</PixelBtn>
        </PixelPanel>
        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 13, color: "#ff6b35", textAlign: "center" }}>{msg}</div>}
      </div>
    </div>
  );
}
```

Extend the imports at the top of `App.tsx`: `type ApiResult` from `./api`, and `createHouse, joinHouse, leaveHouse, regenerateCode, renameHouse, removeMember, saveAvatar, postHouseRun, formatCodeInput, captureInviteFromUrl, peekPendingInvite, takePendingInvite, type HouseState, type HouseView` from `./house` (some were added in earlier tasks). In `App()`:

```tsx
  const houseAction = async (call: () => Promise<ApiResult<HouseState>>) => {
    const r = await call();
    if (!r.ok) return r.data.error ?? "Something went wrong.";
    house.apply(r.data);
    takePendingInvite();
    goHome();
    return null;
  };
```

Render `"house"`: when `house.state.house` exists, render `HouseSettingsScreen` instead (Step 6); otherwise `<HouseChoiceScreen initialCode={peekPendingInvite() ?? ""} onCreate={(n) => houseAction(() => createHouse(n))} onJoin={(c) => houseAction(() => joinHouse(c))} onBack={goHome} />`.

- [ ] **Step 6: House settings screen**

`HouseSettingsScreen({ house, selfId, onRegenerate, onRename, onRemove, onLeave, onBack })` shows:
- the house name (owner: an input + `[ RENAME ]` calling `onRename`),
- the invite code in large text with its expiry (`EXPIRES IN 23H`, computed from `inviteExpiresAt`; `NO LIVE CODE` when null), a `[ SHARE ]` button that calls `navigator.share?.({ title: "Join my house", text: \`Join my house in Drill Mode with code ${code}\`, url: \`${location.origin}/?house=${code.replace("-", "")}\` })` and falls back to `navigator.clipboard.writeText(url)` with a `COPIED` message, and for the owner `[ NEW CODE ]` calling `onRegenerate`,
- the member list (`MemberChar`, name, `OWNER` tag; owner sees `REMOVE` on others, confirmed with `window.confirm`),
- `[ LEAVE HOUSE ]` (confirm text: owners are told the earliest joiner becomes owner; the last member is told the house will be deleted).

Each callback uses `houseAction`-style handling but stays on the screen (except leave, which returns home and shows `alert("You left the house.")`).

Add a `HOUSE` row to `SettingsScreen`'s list that calls `onNav("house")`.

Removed-player note: keep `const prevHouseId = useRef<string | null>(null)`; in an effect on `house.state.house?.id`, when it goes from a value to `null` without this client having called leave (track a `leavingRef`), `appendNotification({ kind: "payday", memberId: selfId, title: "You're no longer in a house", body: "Your progress is still yours. Create or join another any time." })`. (Reuse an existing `NotificationKind`; add `"house"` to that union if a distinct icon is wanted, mapping it to `IconHouse` in `iconForNotifKind`.)

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run build` — Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(app): new/returning start, character-first sign-up, house screens"
```

---

### Task 15: Copy sweep and local end-to-end check

**Files:**
- Modify: `src/app/App.tsx` (copy), `.claude/launch.json`

- [ ] **Step 1: Copy**

Run `grep -n -i "family" src/app/App.tsx | grep -v "^\s*//"` and change player-facing strings: `FAMILY DRILL` → `HOUSE DRILL`, `FAMILY HOME` → the house name, `FAMILY SAFETY` → `HOUSE SAFETY`, `asked-family`-related button labels `ASK FAMILY` → `ASK SOMEONE YOU TRUST`, PIXI and notification texts ("the family stays safe" → "your house stays safe", "Family drill complete" → "House drill complete"). Leave identifiers (`FamilyHomeScreen`, `"family-round"`, outcome value `asked-family`) unchanged: they are internal and the outcome value is part of the API.

- [ ] **Step 2: A local server that cannot touch production**

Add to `.claude/launch.json` `configurations`:

```json
{
  "name": "houses-local",
  "runtimeExecutable": "env",
  "runtimeArgs": ["DOTENV_CONFIG_PATH=/dev/null", "ALLOW_DEV_VERIFY=true", "PORT=3001", "PGLITE_DIR=server/.pglite-houses", "node", "server/index.js"],
  "port": 3001
}
```

`DOTENV_CONFIG_PATH=/dev/null` stops `dotenv/config` loading the repo `.env` (which points at production), so the server uses PGlite. Add `server/.pglite-houses/` to `.gitignore`.

- [ ] **Step 3: Play it**

`npm run build`, then `preview_start` `houses-local` and, in the browser pane:
1. PRESS START → NEW PLAYER → set a name and mascot → CONTINUE → phone `+6590000001` → SEND CODE → enter the dev code → lands in the full-screen room.
2. `+ PLAY WITH OTHERS` → create `THE TESTERS` → note the code.
3. Open a second tab (`tabs_create`), clear its storage with `javascript_tool` (`localStorage.clear()`), sign up as a second player (`+6590000002`), JOIN with the code → dollhouse with two rooms.
4. Back in tab 1, trigger focus (reload) → dollhouse with two rooms, the house name on the roof.
5. Tab 1 (owner): open the second player's room → REMOVE → tab 2 after reload is back to the solo room.
6. Play a house drill in tab 1 → summary shows `+N XP`; play again → `XP ALREADY EARNED THIS WEEK`.
7. Leaderboard: both boards render; solo tab shows the `+ CREATE OR JOIN A HOUSE` panel.
8. Tab 2: open `http://localhost:3001/?house=<code without dash>` while signed out (after `localStorage.clear()`), sign in as returning `+6590000002` → the join box is pre-filled.
9. `read_console_messages` with `onlyErrors: true` → no errors. `resize_window` `mobile` → no horizontal scroll; reset to `desktop`.

Fix anything found, re-run `npm run typecheck && npm run build && node --test server/*.test.mjs`. The realtime doorbell cannot be exercised locally without Supabase keys; it is verified on production in Task 17.

- [ ] **Step 4: Commit**

```bash
git add src/app/App.tsx .claude/launch.json .gitignore
git commit -m "feat(app): house wording; local PGlite preview config"
```

---

### Task 16: Docs and spec

**Files:**
- Modify: `server/README.md`, `.env.example`, `DEPLOY.md`, `docs/superpowers/specs/2026-09-19-households-design.md`

- [ ] **Step 1: server/README.md**

- API table: remove `/api/family` and `/api/leaderboard`; change `/api/me` to "Current account (session required)"; change `/api/verify/check` to "Verify OTP; name required only for a new account; optional avatar; `NO_ACCOUNT` for unknown numbers"; add rows for `GET /api/house`, `POST /api/house`, `/api/house/join`, `/api/house/code`, `/api/house/name`, `/api/house/members/:id/remove`, `/api/house/leave`, `/api/me/avatar`, `/api/drills/house-run`.
- Tests table: add `houses.test.mjs` (house rules, weekly flags, drill runs, PII), `doorbell.test.mjs`, `avatar.test.mjs`, `week.test.mjs`; extend the `store.concurrency.test.mjs` row with "house joins and leaves".
- New section "Houses and the doorbell": one house per player, max 6, 24h codes, lock order house → user, doorbell semantics (content-free broadcast, 2s timeout, never fails a request, topic rotates on removal).

- [ ] **Step 2: .env.example**

Under the Supabase section add:

```bash
# Realtime doorbell (optional). The server rings with the secret key; the browser
# listens with the publishable key. Both are safe to leave unset: the app then
# refreshes houses on focus and every five minutes.
# SUPABASE_URL=https://<project-ref>.supabase.co
# SUPABASE_SECRET_KEY=
# VITE_SUPABASE_URL=https://<project-ref>.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=
```

(If `SUPABASE_URL`/`SUPABASE_SECRET_KEY` already appear, add only the comment and the two `VITE_` lines.)

- [ ] **Step 3: DEPLOY.md**

Add a "Households rollout" section with the Task 17 checklist.

- [ ] **Step 4: Spec**

Apply the five "Spec clarifications made while planning" at the top of this plan to the spec (sections 2, 4 and 5).

- [ ] **Step 5: Commit**

```bash
git add server/README.md .env.example DEPLOY.md docs/superpowers/specs/2026-09-19-households-design.md
git commit -m "docs: households API, doorbell and rollout"
```

---

### Task 17: Rollout (the user runs the production steps)

- [ ] **Step 1:** Push `feat/houses` (`git push -u origin feat/houses`) and confirm CI is green (both the PGlite and Postgres runs).
- [ ] **Step 2 (user):** `npx supabase db push` — applies `20260920000001_houses.sql`. Confirm with `npx supabase migration list`.
- [ ] **Step 3 (user):** Supabase dashboard → Realtime → Settings: make sure public channels are allowed ("Allow public access" on / private-only off).
- [ ] **Step 4 (user):** Vercel → Project → Settings → Environment Variables → Production: add `SUPABASE_URL` (`https://pjogbcoomkbxfeqsxlny.supabase.co`), `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → secret), `VITE_SUPABASE_URL` (same URL), `VITE_SUPABASE_PUBLISHABLE_KEY` (the publishable key).
- [ ] **Step 5 (user):** a one-off broadcast check from the laptop, with the secret pasted by the user into their own terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://pjogbcoomkbxfeqsxlny.supabase.co/realtime/v1/api/broadcast" -H "apikey: $SUPABASE_SECRET_KEY" -H "content-type: application/json" -d '{"messages":[{"topic":"house-check","event":"changed","payload":{},"private":false}]}'
```

Expected: `202`. If it is `401`, the key needs the `Authorization: Bearer` header too; add it in `server/doorbell.js` and its test, and redeploy.
- [ ] **Step 6:** Merge `feat/houses` into `main` locally; the user pushes `main`.
- [ ] **Step 7:** Verify production: `/api/health/db` ok; `/api/family` and `/api/leaderboard` 404; `/api/house` 401 without a session; two phones (or phone + laptop) sign up, create/join a house, and a drill on one updates the other within a couple of seconds without reloading (the doorbell).
