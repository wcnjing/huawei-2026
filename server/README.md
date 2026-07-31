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

`npm test` uses Node's built-in `node:test` runner. Provider calls and Redis are mocked;
no network account is required. File-store tests set `SAFESPACE_DATA_FILE` to isolated
temporary paths, so the suite never resets or deletes the application's
`server/data.json`.

| File | Coverage |
|---|---|
| `xp.test.mjs` | Shared outcome → XP/streak policy, including neutral distress exits |
| `verify.test.mjs` | Twilio Verify modes, explicit dev bypass and rate limiting |
| `drill-links.test.mjs` | HMAC signatures, expiry, action binding and email ownership links |
| `sms.test.mjs` | Fictional scenarios, reserved domains, Twilio schedule-before-bait ordering and cancellation |
| `email.test.mjs` | First-party links, durable follow-up ordering, relay escaping and rejection of arbitrary HTML |
| `vapi.test.mjs` | Structured call analysis, role-aware fallback, operational/unscored endings and attempt metadata |
| `store.test.mjs` | PII projection, sessions, attempts, exactly-once completion, pending ACK and atomic file writes |
| `store.redis.test.mjs` | Upstash compare-and-set retries and concurrent duplicate callback handling |
| `routes.test.mjs` | HTTP authentication, ownership, replay, input validation and production-shaped fail-closed behavior |

## HTTP API

All account and real-drill routes use the bearer session created after a successful
phone OTP. A request-body user id, phone or email is never accepted as proof of
identity.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Minimal liveness response |
| GET | `/api/me` | Current public account view and ownership flags |
| GET | `/api/family` | PII-stripped demo family plus the signed-in account |
| GET | `/api/leaderboard` | PII-stripped ranking |
| GET | `/api/drills/pending-result` | Non-destructively peek at the next result |
| POST | `/api/drills/pending-result/:resultId/ack` | Remove the result only after the UI displayed it |
| POST | `/api/drills/practice-result` | Idempotent half-XP practice result; requires a client `attemptId` |
| POST | `/api/verify/start` | Send phone ownership OTP |
| POST | `/api/verify/check` | Verify OTP, mandatory name, create expiring session |
| POST | `/api/me/name` | Update the name used by future drills |
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

The default backend is `server/data.json`. Writes are serialized within one process and
replace the document atomically, so a crash cannot leave half-written JSON. Set both
Upstash REST variables for multi-instance or serverless deployments; Redis mutations
use versioned compare-and-set with retries.

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
