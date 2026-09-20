# SafeSpace backend

The Express service owns authentication, consent, provider calls, signed drill links,
exactly-once scoring and persistence. It also serves the production Vite build.

Use Node 22.9 or newer.

## Run

```sh
npm install
npm run build
npm run server            # http://localhost:3000
# or
npm start                 # build, then serve
npm test
```

Provider integrations are opt-in. Missing or partial live configuration returns 503;
practice drills and normal UI reads remain available.

## Tests

`npm test` uses Node's built-in `node:test` runner. Provider calls are mocked, and each
test file gets its own in-memory PGlite database, so no account, network or install is
needed. `npm run test:pg` runs the same suite against Postgres 17 in Docker, including
the race tests PGlite cannot run; CI runs both.

| File | Coverage |
|---|---|
| `xp.test.mjs` | Shared outcome → XP/streak policy, including neutral distress exits |
| `avatar.test.mjs` | Avatar allowlist: exact allowed keys kept, anything outside it rejected |
| `week.test.mjs` | Monday 00:00 Asia/Singapore week boundary |
| `verify.test.mjs` | Twilio Verify modes, explicit dev bypass and rate limiting |
| `drill-links.test.mjs` | HMAC signatures, expiry, action binding and email ownership links |
| `sms.test.mjs` | Fictional scenarios, reserved domains, Twilio schedule-before-bait ordering and cancellation |
| `email.test.mjs` | First-party links, durable follow-up ordering, relay escaping and rejection of arbitrary HTML |
| `vapi.test.mjs` | Structured call analysis, role-aware fallback, operational/unscored endings and attempt metadata |
| `store.test.mjs` | PII projection, sessions, attempts, exactly-once completion and pending ACK |
| `houses.test.mjs` | House rules, weekly flags, drill runs, PII |
| `doorbell.test.mjs` | Supabase Realtime broadcast: apikey-only auth, dedup and payload shape, no-op when unconfigured, failures/timeouts swallowed |
| `store.concurrency.test.mjs` | Races on real Postgres: lost updates, cooldowns, OTP caps, duplicate webhooks, duplicate registration, house joins and leaves |
| `db.test.mjs` | Schema placement and row-level security, migrations, database selection, retries, error redaction |
| `rows.test.mjs` | Row ↔ object mapping that keeps the API's JSON unchanged |
| `routes.test.mjs` | HTTP authentication, ownership, replay, input validation and production-shaped fail-closed behavior |

## HTTP API

All account and real-drill routes use the bearer session created after a successful
phone OTP. A request-body user id, phone or email is never accepted as proof of
identity.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Minimal liveness response |
| GET | `/api/me` | Current account (session required) |
| GET | `/api/drills/pending-result` | Non-destructively peek at the next result |
| POST | `/api/drills/pending-result/:resultId/ack` | Remove the result only after the UI displayed it |
| POST | `/api/drills/practice-result` | Idempotent half-XP practice result; requires a client `attemptId` |
| POST | `/api/verify/start` | Send phone ownership OTP |
| POST | `/api/verify/check` | Verify OTP; name required only for a new account; optional avatar; `NO_ACCOUNT` for unknown numbers |
| POST | `/api/me/name` | Update the name used by future drills |
| POST | `/api/me/avatar` | Set the mascot avatar (allowlisted color/glow/hat/eyes/outfit) |
| GET | `/api/house` | `{ self, house }`: `self` is the caller's own member view (weekly flags even when solo); `house` is `null` when solo |
| POST | `/api/house` | Create a house with `{name}`; the creator becomes owner with a fresh 24h code |
| POST | `/api/house/join` | Join with `{code}`; the same message for a wrong or an expired code; refuses at 6 members |
| POST | `/api/house/code` | Owner only: regenerate the invite code with a new 24h expiry |
| POST | `/api/house/name` | Owner only: rename the house |
| POST | `/api/house/members/:memberId/remove` | Owner only: remove a member (not themself); rotates the doorbell |
| POST | `/api/house/leave` | Leave; an owner leaving hands ownership to the earliest joiner, the last member leaving deletes the house |
| POST | `/api/drills/house-run` | Record a house drill run `{clientKey, correct, cautious, wrong}`; only the first run of the week earns XP; replaying a key returns the stored run |
| POST | `/api/me/phone/detach` | Remove raw phone, preserve keyed recovery lookup, withdraw consent and revoke sessions |
| POST | `/api/me/email/verification/start` | Send an inbox ownership link |
| POST | `/api/me/email` | Compatibility alias for starting ownership verification |
| GET | `/api/me/email/status` | Masked ownership-verification status |
| GET | `/email-verify?token=…` | Validate a signed link and render confirmation; no mutation |
| POST | `/email-verify?token=…` | Explicitly confirm inbox ownership |
| POST | `/api/drills/fire` | Reserve and place a real call |
| POST | `/api/drills/sms` | Reserve and send a real SMS drill |
| POST | `/api/drills/email` | Reserve and send a real email drill |
| POST | `/api/drills/:drillId/complete` | Record an allowed in-app SMS/email action |
| GET | `/drill-reveal?token=…` | Render scanner-safe reveal confirmation; no scoring |
| POST | `/drill-reveal?token=…` | Explicitly confirm reveal/click outcome |
| GET | `/drill-report?token=…` | Render scanner-safe report confirmation; no scoring |
| POST | `/drill-report?token=…` | Explicitly confirm report outcome |
| POST | `/api/webhooks/vapi` | Authenticated Vapi end report → exactly-once outcome |
| POST | `/api/drills/simulate` | Offline result helper; absent unless explicitly enabled |

## Houses and the doorbell

A player belongs to at most one house (`server/houses.js`), of up to 6 members,
created or joined at any time; solo play is the full game. Invite codes are 6
characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L), shown as `K7P-3QX`,
and expire 24 hours after they're generated — regenerating a code replaces the old one
outright, and a wrong or expired code gets the same error either way. Every mutation
(create, join, leave, remove, rename, regenerate) runs in one transaction, and the lock
order is always the house row, then user rows: a join can never push a house past 6
members, and re-checking a user's `house_id` under their own row lock means nobody ends
up owning or belonging to two houses at once.

After a transaction commits, `server/doorbell.js` rings a content-free Supabase
Realtime broadcast on the house's `doorbell` topic — the message carries no house or
member data, only "something changed." The ring has a 2-second timeout and never fails
the request it followed; without `SUPABASE_URL`/`SUPABASE_SECRET_KEY` it's a no-op, and
either way the client falls back to its own on-focus and 5-minute refresh of
`GET /api/house`. Removing a member rotates the doorbell to a fresh topic, so the
removed player's still-open app stops hearing that house while everyone else picks up
the new topic on their next refresh.

## Outcome lifecycle

Every live channel reserves a durable attempt before contacting its provider. The
attempt records `created`, `sent`, and one terminal state. A provider id, reserved
attempt id, or one-use hashed action token resolves that attempt atomically.

- A first valid behavioral outcome applies XP once and queues one result.
- Replayed callbacks or links return the existing result without applying it again.
- Unknown callback identifiers are ignored and cannot fall back to a demo user.
- No-answer, voicemail, provider errors, missing analysis and insufficient evidence
  close the attempt as `UNSCORED`, with 0 XP and no streak change.
- Result reads are non-destructive. The client ACK endpoint removes only the result it
  confirms it displayed.

The scored vocabulary is:

| Outcome | Result | Real XP | Streak |
|---|---|---:|---|
| `hung_up`, `disengaged`, `verified`, `reported`, `asked-family`, `closed_page`, `cancelled_download` | WON | 100 | +1 |
| `caught_flag` | WON | 50 | +1 |
| `complied`, `shared_data`, `clicked_link`, `submitted_details`, `opened_attachment` | LOST | 0 | reset |
| `distress_offramp` | SAFE | 0 | unchanged |
| Operational/missing evidence | UNSCORED | 0 | unchanged |

Practice awards half of positive XP. HTTP routes reject unknown client outcomes.

## Live call analysis

`POST /api/drills/fire` includes the reserved attempt id in Vapi metadata and configures
the transient assistant with:

- a schema-constrained post-call outcome;
- transcript processing for classification, while requesting recording, video, packet
  capture, full message history and provider logging disabled;
- a distress off-ramp and real-data tripwire;
- the verified account name.

The webhook requires `x-vapi-secret`. Structured analysis is preferred. When it is
missing, a conservative role-aware transcript fallback considers only explicit target
behavior. Operational endings are never converted into behavioral wins.

Vapi and the configured transcriber necessarily process call audio/transcript content
to run and classify the call. The SafeSpace store writes the resulting outcome,
unscored reason and attempt metadata, not transcript text or audio. The artifact flags
above are requests to Vapi; do not describe them as a universal provider-retention
guarantee. Confirm provider settings and contractual retention separately.

For a local live test:

```sh
npm start
cloudflared tunnel --url http://localhost:3000
# Put the HTTPS origin in PUBLIC_URL, then restart npm start.
```

## SMS and email safeguards

SMS uses a Twilio Messaging Service because fixed scheduling requires
`MessagingServiceSid`. SafeSpace schedules the plain-text reveal first, confirms Twilio
returned `scheduled`, and only then sends bait. The default reveal delay is 16 minutes
(Twilio's minimum is 15); a signed first-party link provides an immediate confirmation
flow. Its GET cannot score—only the user's explicit POST does.

Email ownership links use the same scanner-safe pattern: GET renders a confirmation
page and POST attaches the inbox. Real email drills then:

1. validate first-party signed reveal/report URLs;
2. ask Apps Script to persist a safety-follow-up job and create a time trigger;
3. send a structured scenario id, name and URLs—never generated HTML.

The relay renders an escaped, allow-listed fictional template. Its required Script
Properties are:

```text
SAFESPACE_SECRET       = GOOGLE_SCRIPT_SECRET
SAFESPACE_LINK_ORIGIN  = PUBLIC_URL or EMAIL_ACTION_ORIGIN
```

Run `_authorise` once in the Apps Script editor before deployment.

After a safety reveal/follow-up is durably scheduled, a timeout while sending bait is
treated as **delivery unconfirmed**. The safety job remains in place because the
provider may have accepted the bait before the response was lost; clients must not
immediately retry that result.

## Offline result-loop demo

Explicitly set `ENABLE_DEMO_ROUTES=true`, restart, then:

```sh
curl -X POST http://localhost:3000/api/drills/simulate \
  -H 'content-type: application/json' \
  -d '{"outcome":"shared_data"}'

curl http://localhost:3000/api/drills/pending-result
# After displaying it:
curl -X POST http://localhost:3000/api/drills/pending-result/RESULT_ID/ack
```

The simulation route writes a non-practice result and must not exist in production.

## Persistence

Data lives in Postgres, in the `safespace` schema: Supabase in production, PGlite
(`server/.pglite/`) locally. Each write is one transaction that locks only the rows it
reads, so different users never wait for each other. Schema changes are SQL files in
`supabase/migrations/`, applied with `npx supabase db push` on Supabase and
automatically on PGlite.

New sessions are stored as hashes and expire after 30 days unless `SESSION_TTL_MS`
overrides the duration. Real attempts have a default five-minute per-user/channel
cooldown (`REAL_DRILL_COOLDOWN_MS`).

### Detached-phone account recovery

Set `IDENTITY_LOOKUP_SECRET` to a stable, random value of at least 32 characters. While
a phone is attached, SafeSpace can store both the verified number and a keyed HMAC
lookup. Detaching:

1. ensures that keyed lookup exists;
2. deletes the raw phone;
3. withdraws drill consent; and
4. revokes every session for the account.

A later OTP verification of the same number recomputes the HMAC and reconnects the
existing account, including its XP and room progress. The lookup is private and never
included in API projections.

If the recovery lookup cannot be created because the secret is unavailable, detach
returns 503 and leaves the raw phone/account attached. Keep the same secret across
instances and redeploys: losing or rotating it without migrating stored lookups prevents
detached accounts from reconnecting.

### Verification abuse limits

Phone OTP starts use the shared file/Redis mutation path, with a five-per-destination
hourly limit, 30-second destination cooldown, and a default 20-per-resolved-client
hourly limit across different numbers. Email ownership sends are limited to five per
account and three per destination per hour, plus the one-minute account cooldown.
Rate-limit subjects are stored as keyed digests when `IDENTITY_LOOKUP_SECRET` is set.

Express uses the direct socket address by default. Behind a known reverse proxy, set
`TRUST_PROXY_HOPS` to its exact hop count only when that proxy overwrites forwarded
headers. `PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR` changes the default requester cap.
Production should also enforce an independent provider/CDN edge limit.
