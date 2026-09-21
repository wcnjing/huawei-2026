# Task 1 report: house chat domain and storage

## Status

DONE

Implementation commit: `0caaba8 feat(chat): persist authorized house messages`

## Changed files in the commit

- `supabase/migrations/20260921000001_house_chat.sql`
- `server/chat.js`
- `server/chat.test.mjs`
- `server/houses.js`
- `server/testdb.mjs`

The report itself is intentionally outside that commit because Task 1 required staging the five named implementation files.

## TDD evidence

### RED 1: missing chat domain

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 1, 0 pass, 1 fail. Node reported `ERR_MODULE_NOT_FOUND` for `server/chat.js`, which was the intended first failure.

### GREEN 1: current-membership history

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 0, 1 pass, 0 fail. A non-member was denied, then could read the earlier message after joining.

### RED 2: input boundary

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 1, 1 pass, 4 fail. Failures showed missing `normalizeText` and `parseCursors`, unnormalized message text/client UUIDs, and accepted malformed keys.

### GREEN 2: input boundary

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 0, 5 pass, 0 fail.

### RED 3: idempotency and rolling quota

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 1, 5 pass, 2 fail. Concurrent and sequential retries both reached the unique constraint (`23505`), proving the missing idempotent lookup; quota behavior was also absent.

### GREEN 3: idempotency and rolling quota

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 0, 7 pass, 0 fail. Exact retries returned the original response without consuming hits; the 21st new send returned retry delays of `60000 ms` and then `1 ms`, and a send at `60001 ms` succeeded.

### RED 4: bounded bigint paging

Command:

```text
node --test server/chat.test.mjs
```

Observed result: exit 1, 12 pass, 1 fail, 1 PostgreSQL-only skip. The latest history returned 125 rows instead of 50.

After adding the 51-row paging query, the focused run exposed a second useful RED: unqualified `order by id` resolved to the selected `id::text` output name and sorted IDs lexically once the sequence reached 100. The test expected IDs 76-125 but received values beginning at 54 with `6`, `7`, `8`, and `9` interleaved. Qualifying `chat_messages.id` made ordering use the bigint source column.

## Final verification

Focused PGlite command:

```text
node --test server/chat.test.mjs server/houses.test.mjs
```

Final observed result: exit 0, 33 tests, 32 pass, 0 fail, 1 skip. The skip is the explicitly PostgreSQL-only multi-connection race.

Real PostgreSQL command:

```text
npm run test:pg
```

Observed result: exit 0, 248 tests, 248 pass, 0 fail, 0 skip. This executed the send/removal race in both launch orders against PostgreSQL 17 in Docker.

Patch checks:

```text
git diff --check
git diff --cached --check
```

Both exited 0. The staged patch contained exactly the five named Task 1 files before commit.

## Self-review

- Reads and sends lock the expected house and then the user, and recheck `user.houseId` under lock.
- Sends acquire the account rate-limit advisory lock before house/user locks.
- Idempotency lookup precedes quota rejection and hit recording; changed normalized text returns `MESSAGE_KEY_REUSED`.
- Message rows expose only explicit fields, preserve bigint IDs as strings, normalize timestamps to ISO, and sanitize avatar snapshots.
- Paging uses fixed validated SQL branches and qualifies the underlying bigint column to avoid lexical ordering from the `id::text` select expression.
- Membership revocation, house switching, prior-history access for new members, sender snapshots, and house-delete cascade have integration coverage.

## Concerns

None blocking. The query differs from the brief's literal `order by id` fragment by using `order by chat_messages.id`; the literal form sorts the `id::text` output alias lexically in both PGlite and PostgreSQL, while the qualified form preserves the required numeric identity order.

## Review fix: deterministic lock race and exhausted-bucket retry

Review found that the original race test constructed both promises before using `sendFirst`, so both loop iterations actually launched `sendMessage` first. It also released the held house lock without proving either contender had reached the lock. The quota test retried a key before filling the bucket, leaving the post-exhaustion behavior uncovered.

The race now uses a separate PostgreSQL monitor connection and `pg_stat_activity` to synchronize on blocked `select ... houses ... for update` statements. It starts only the chosen first operation, waits for one blocked house-lock contender, starts the second operation, waits for two blocked contenders, and only then releases the holder. It asserts completion order and the two distinct outcomes: send-first commits one authorized message before removal; remove-first denies the subsequent send and stores no row.

The quota test now fills all 20 slots, retries the first message with its original key and body, verifies the original response is returned with `created: false`, and recounts exactly 20 rate-limit hits before testing a new rejected send.

Focused PGlite command:

```text
node --test server/chat.test.mjs
```

Observed result after the review fixes: exit 0, 14 tests, 13 pass, 0 fail, 1 PostgreSQL-only skip.

Real PostgreSQL command:

```text
npm run test:pg
```

Observed result after the review fixes: exit 0, 248 tests, 248 pass, 0 fail, 0 skip. The corrected send/removal race ran and passed in both lock-queue orders.
