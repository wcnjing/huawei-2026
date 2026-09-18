# Postgres foundation: design

Date: 2026-09-18 · Sub-project 1 of 4 in the [multiplayer roadmap](2026-09-18-multiplayer-roadmap.md)
· Branch: `feat/postgres` · Target: merged by ~1 Oct 2026

## Goal

Move all server state from the whole-document store (`server/data.json` or one Upstash
Redis key) to Postgres on Supabase, **with no change visible to users or to
`server/index.js`**. Households, chat and the coin economy (sub-projects 2–4) are built
on these tables.

## Non-goals

- Households, chat, coins, required login, the Realtime doorbell (sub-projects 2–4).
- Any React change.
- Importing existing Redis data. Production starts fresh; everyone logs in once.
- Shannon's scam-bulletin tables (`bulletins`, `scams`, `scam_variants`,
  `bulletin_scams`). They stay as they are; see [Coordination](#coordination).

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Driver | `pg` (node-postgres) with hand-written SQL | Real multi-statement transactions, which the cooldown, exactly-once scoring and rate-limit logic depend on. Standard SQL keeps Huawei Cloud Postgres possible. |
| Local dev and default tests | PGlite (in-process Postgres) when `DATABASE_URL` is unset | `npm start` and `npm test` keep working with no setup, as the README promises. |
| Race tests | Real Postgres (`postgres:17` container) | PGlite has a single connection and cannot exercise lock contention. |
| Migrations | Supabase CLI format in `supabase/migrations/` | The team already ran `supabase init`. Files are plain SQL, so a small runner also applies them to PGlite and test Postgres. |
| Schema | Our tables in a dedicated `safespace` schema | Supabase publishes `public` through its HTTP API, and sub-project 3 puts that API's key in the browser. |
| Region | Supabase in Singapore; Vercel functions pinned to `sin1` | Several queries per request must not cross the Pacific. |

## Tables

All tables live in schema `safespace`. Row-level security is enabled on every table
with no policies, as a second lock behind the unpublished schema. Our server connects as
the database owner and is unaffected. Migrations use only plain Postgres (no
Supabase-specific roles), so they apply identically to Supabase, PGlite and test
Postgres. The migration also runs `REVOKE ALL ON SCHEMA safespace FROM PUBLIC`.

### `users` (replaces `db.users`)

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | Stays text: `usr_<uuid>` and the demo ids (`you`, `grandma`, `mum`, `dad`), so no API change |
| `name`, `role` | `text not null` | |
| `phone` | `text unique` | Null when absent. The seed's `""` becomes `NULL`. |
| `phone_lookup_hash` | `text unique` | Keyed HMAC kept after detach, as today |
| `consent_to_drills` | `boolean not null` | |
| `level`, `xp`, `xp_max`, `streak`, `times_safe`, `times_scammed` | `integer not null` | Checks: `level >= 1`, `xp_max > 0`, the rest `>= 0` |
| `safe_this_week` | `boolean not null` | |
| `recent_drill_result` | `text` | `WON`, `LOST` or null |
| `primary_color`, `room_name`, `room_bg` | `text not null` | |
| `badge_count`, `badge_total` | `integer not null` | |
| `email`, `pending_email`, `email_verification_token_hash` | `text` | |
| `email_verified_at`, `email_verification_requested_at` | `timestamptz` | |
| `created_at` | `timestamptz not null default now()` | Not returned by the API |

### `sessions` (replaces `db.sessions`)

`token_hash text PK`, `user_id text not null references users on delete cascade`,
`created_at timestamptz not null`, `expires_at timestamptz not null`, index on
`user_id`. The raw bearer token is never stored. The legacy raw-token migration path in
`getUserIdByToken` is deleted: a fresh start has no legacy sessions.

### `drill_attempts` (replaces `db.drillAttempts`)

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `attempt_<uuid>` |
| `user_id` | `text not null references users` | |
| `channel` | `text not null` | Check: `call`, `sms`, `email` |
| `status` | `text not null` | Check: `created`, `sent`, `completed`, `failed` |
| `provider_id` | `text unique` | Replaces `byProviderId` |
| `action_token_hash` | `text unique` | Replaces `byActionTokenHash`; set to null on completion or failure, as today |
| `created_at` | `timestamptz not null` | Index `(user_id, channel, created_at desc)` for cooldowns |
| `sent_at`, `completed_at` | `timestamptz` | |
| `scored` | `boolean` | |
| `outcome`, `failure_reason`, `result_record_id` | `text` | `result_record_id` has no foreign key, to avoid a circular reference with `drill_results.attempt_id` |

### `drill_results` (replaces `db.drills`, `db.pendingResults`, `db.outcomeSourceIds`)

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | `drill_<uuid>` |
| `user_id` | `text not null references users` | |
| `channel` | `text not null` | Check: `call`, `sms`, `email` |
| `outcome` | `text` | Null for unscored results |
| `practice` | `boolean not null` | |
| `result` | `text not null` | Check: `WON`, `LOST`, `SAFE`, `UNSCORED` |
| `screen` | `text` | |
| `xp_gained` | `integer not null` | |
| `at` | `timestamptz not null` | |
| `attempt_id` | `text references drill_attempts` | Unique where not null: one result per attempt |
| `provider_id`, `unscored_reason` | `text` | |
| `practice_source_key` | `text unique` | Replaces `outcomeSourceIds` for idempotent practice scoring |
| `acknowledged_at` | `timestamptz` | Replaces the pending queue |

A **pending result** is a row with `practice = false and acknowledged_at is null`, read
oldest first, with a partial index on `(user_id, at)` for that condition. Acknowledging
sets `acknowledged_at`; it no longer splices an array. The "fired" entries that
`createDrillAttempt` appends to `db.drills` today are dropped: nothing reads them and
`drill_attempts` holds the same facts.

### `consent_events` (replaces `db.consentEvents`)

`id bigint generated always as identity PK`, `user_id text not null references users`,
`type text not null`, `channel text not null`, `at timestamptz not null`. Append-only.

### `rate_limit_hits` (replaces `db.verificationRateLimits`)

`id bigint generated always as identity PK`, `scope text not null`,
`subject_key text not null`, `hit_at timestamptz not null`, index
`(scope, subject_key, hit_at)`. `subject_key` is computed exactly as today by
`rateLimitSubjectKey` (HMAC with `IDENTITY_LOOKUP_SECRET`, SHA-256 without it), so no
raw phone number or email is stored. Each reservation deletes that scope's hits older
than the window, matching today's compaction.

### `tactic_cards` (replaces `db.intel`)

`id text PK`, `card jsonb not null`, `fetched_at timestamptz not null`. The merge keeps
the newest `MAX_TACTIC_CARDS` (10) live cards and deletes the rest. The unused
`db.intel.updatedAt` is dropped.

### Demo family

A second migration inserts `you`, `grandma`, `mum` and `dad` with the values in
`server/data.seed.json`, which is then deleted. It is a migration rather than
`supabase/seed.sql` because production needs the demo family too, and the CLI applies
`seed.sql` only to local databases.

## `store.js` internals

### Contract

Every exported function keeps its name, arguments, return shape and errors:
`DrillAttemptConflict` with `reason`, `retryAfterMs` and `attempt`,
`VerificationRateLimitConflict`, `EmailVerificationConflict`, and the same `code`
values. **`server/index.js` does not change.**

Row mappers reproduce today's objects exactly: camelCase keys, timestamps as ISO
strings, and `created_at` not exposed. A key that today's code always writes stays
present even when null (`recentDrillResult`, an attempt's `providerId`). A key it writes
only conditionally is omitted when null (a user's `email` fields, an attempt's `sentAt`,
a result's `attemptId`, `providerId` and `unscoredReason`). `publicUser`, `publicAttempt` and the
`PRIVATE_FIELDS` list keep working unchanged on the mapped objects.

### `server/db.js`

Exports `query(sql, params)`, `transaction(async (tx) => …)` and `closeDb()`. The
backend is chosen on first use:

- **`DATABASE_URL` set:** a `pg.Pool` with `max: 3`. On Vercel it points at Supabase's
  transaction-mode pooler (port 6543). No named prepared statements are used, and every
  lock is transaction-scoped, which are that mode's two restrictions. TLS is verified
  against Supabase's CA certificate, supplied as PEM in `DATABASE_CA_CERT`. The code
  never sets `rejectUnauthorized: false`. In production (`VERCEL` or
  `NODE_ENV=production`) `DATABASE_CA_CERT` is required, so a missing value fails loudly
  instead of connecting in plaintext. Elsewhere (the CI container) TLS follows the
  connection string.
- **`DATABASE_URL` unset:** PGlite, imported dynamically so production never loads it.
  Data persists in `PGLITE_DIR` (default `server/.pglite/`, gitignored); tests use
  memory. Pending migrations are applied automatically.
- **Guard:** when `VERCEL` or `NODE_ENV=production` is set and `DATABASE_URL` is not, the
  first query throws a clear configuration error instead of using PGlite on a throwaway
  disk.

`transaction()` retries on deadlock (`40P01`) and serialization failure (`40001`) up to
5 times with jittered backoff, as `mutate` does today. Any other error propagates. As
today, ids and timestamps are generated outside the transaction, so a retry reuses them.

### Locking

Transactions run at `READ COMMITTED` with explicit locks:

| Operation | Lock |
|---|---|
| Per-user writes: `applyOutcome`, `applyPracticeOutcomeOnce`, `createDrillAttempt` (the cooldown check), email verification, `setUserName`, `setUserEmail`, `detachVerifiedPhone` | The user row, `SELECT … FOR UPDATE` |
| `markDrillAttemptSent`, `markDrillAttemptFailed`, `completeDrillAttempt` | The attempt row, then the user row, always in that order |
| `reservePhoneVerificationSend`, `beginEmailVerification` rate limits | `pg_advisory_xact_lock` on each `(scope, subject_key)`, taken in sorted order |
| `registerVerifiedUser` | `pg_advisory_xact_lock` on the phone's lookup key; the unique index on `phone` is the backstop |
| `mergeTacticCards` | One fixed advisory lock |

When one operation needs both, it takes the row lock first and the advisory locks
second. `beginEmailVerification` is the only such case today.

Reads (`getUser`, `getFamily`, `getLeaderboard`, `listPendingResults`,
`getDrillAttempt*`, `getUserIdByToken`, `listLiveTacticCards`) are single queries outside
a transaction.

`completeDrillAttempt` keeps its fail-closed rule in JavaScript: if the supplied provider
id, attempt id and action token resolve to more than one attempt, it returns `unknown`
and touches nothing.

### Errors

Postgres errors are logged with only `code`, `constraint` and the operation name.
`detail` and `where` are never logged, because Postgres puts the offending value there
(for example `Key (phone)=(+65…) already exists`). Routes return the same 500s they
return today when the database is unreachable.

## Runtime and configuration

- **Environment variables**
  - Added: `DATABASE_URL`, `DATABASE_CA_CERT`, `PGLITE_DIR` (optional).
  - Documented: `SUPABASE_URL` and `SUPABASE_SECRET_KEY`, which Shannon's bulletin
    scripts already use but `.env.example` lacks.
  - Removed after cutover: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
    `SAFESPACE_DATA_FILE`.
- **Dependencies:** add `pg` and `@electric-sql/pglite`. The `supabase` CLI is already a
  dev dependency.
- **Scripts:**
  - `npm run db:migrate` applies migrations to a non-Supabase `DATABASE_URL` (test
    Postgres, a future Huawei Cloud database), recording them in
    `safespace.schema_migrations`. It refuses a `supabase.co` or `supabase.com` host and
    points to `npx supabase db push`. Otherwise two tools would each track migrations
    and apply them twice.
  - `npm run test:pg` starts a `postgres:17` container, runs the whole suite against
    it, then removes it.
- **`vercel.json`:**
  - Add `"regions": ["sin1"]`.
  - Add a daily cron to `/api/health/db`, a new route that runs `SELECT 1`, so a
    free-tier project does not pause after a week idle.
- **`store.js` cleanup:** delete the Redis backend, the file backend and `mutate`.
- **Docs:** `DEPLOY.md` gets a Supabase section, and its ECS and Vercel guides switch to
  `DATABASE_URL`. The README configuration table is updated to match.

## Testing

- **Default `npm test`:** in-memory PGlite, fresh per test file. `freshStore()`
  becomes `resetDb()`: truncate every `safespace` table, then re-insert the demo family.
- **`store.test.mjs`:** the ~20 assertions that read raw `data.json` are rewritten to
  query tables, keeping each property:
  - Raw session tokens appear in no stored value.
  - `rate_limit_hits` holds no raw phone number or email.
  - Detach removes the phone and every session, and keeps the lookup hash.
  - Acknowledging removes only the confirmed result.

  The atomic-file test is deleted with the file backend.
- **`routes.test.mjs`:** setup changes only.
- **`store.redis.test.mjs`:** deleted, replaced by `store.concurrency.test.mjs` against
  real Postgres. Required properties:

  | Race | Must hold |
  |---|---|
  | 20 concurrent `applyOutcome` for one user | Final XP and level equal applying them one by one |
  | Concurrent `createDrillAttempt` with a cooldown | Exactly one succeeds; the rest throw `DrillAttemptConflict` |
  | Concurrent `reservePhoneVerificationSend` for one number | Successes never exceed the cap |
  | The same webhook completion delivered concurrently | Scored exactly once |
  | Concurrent `registerVerifiedUser` for one new phone | Exactly one account |

  It runs when `TEST_DATABASE_URL` is set, in a throwaway database it creates and drops.
  Without it, it reports itself as skipped rather than passing.
- **Schema tests:**
  - Applying migrations twice is a no-op.
  - No `safespace` table sits in `public`.
  - Row-level security is enabled on every table.
  - The error logger omits `detail`: a unique-phone violation's log line must not
    contain the phone.
- **CI:** a `postgres:17` service container, and the whole suite run twice, once on
  PGlite and once with `TEST_DATABASE_URL`. Typecheck and build are unchanged.

## Rollout

0. ~~Merge `feat/scam-intel` into `main`~~ Done: `main` is at `465a85e`.
1. **Supabase projects.** Two projects in the team's Supabase organisation, both in
   Singapore: dev and prod. Whoever owns the existing project (which holds the bulletin
   pipeline) decides whether it becomes dev or prod. Put the dev `DATABASE_URL` and CA
   certificate in Vercel's Preview environment and the prod ones in Production, with
   different database passwords. They live only in Vercel and local `.env` files.
2. **Build** on `feat/postgres` until CI passes on both PGlite and real Postgres.
3. **Dev check.** Run `npx supabase db push` to dev, then work through `TESTPLAN.md`
   on the branch's Vercel preview:
   - OTP registration (with the demo bypass)
   - practice drills
   - SMS and email drills
   - email verification
   - detach and reconnect
   - leaderboard and family
   - a manual intel refresh
4. **Call drill check.** Vercel protects previews with a login, so Vapi's end-of-call
   webhook cannot reach one. The full call loop is tested locally through a tunnel with
   `DATABASE_URL` pointed at dev.
5. **Go live.** `npx supabase db push` to prod, then merge to `main`. Everyone logs in
   once.

**Rollback:** revert the merge on `main`. The Redis store returns with its data as of
cutover, which is why the Upstash variables stay in Vercel until after the final.
Changes made on Postgres in between are lost; that is acceptable for a prototype.
After the final, delete the Upstash variables and database.

**Unchanged:** `UNSAFE_FORCE_DEV_VERIFY` lives in `verify.js` and behaves as before. It
must still be unset after judging.

## Risks

| Risk | Mitigation |
|---|---|
| PGlite behaves differently from Postgres | CI runs the whole suite on both |
| Pooler or TLS surprises only visible on Supabase | Preview check (step 3) before merging; CA verification is explicit |
| Free-tier project pauses | Daily `SELECT 1` cron. It is unconfirmed whether a direct database query counts as activity, so put prod on Pro for finals week. |
| Cold-start latency (TLS and pool setup) | Region pinning; pool reused across warm invocations |
| This sub-project slips into households' time | Hard stop: if not merged by 3 Oct, cut sub-project 4 from the roadmap |

## Coordination

These are for Shannon and do not block this sub-project:

- Which existing Supabase project becomes dev or prod (rollout step 1).
- The bulletin tables were created in the dashboard, so they are not in
  `supabase/migrations/`. A new project will not have them until they are captured as a
  migration.
- The ScamShield/SPF permission emails should also mention the bulletin PDFs, so one
  reply covers both intel pipelines.
