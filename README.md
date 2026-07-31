# SafeSpace — Drill Mode

**Consent-based scam drills for families.** SafeSpace turns scam awareness into
practice: realistic call, SMS and email scenarios followed by a clear reveal and
debrief.

Built for Huawei Tech4City 2026.

## What is implemented

| Channel | Live path |
|---|---|
| **Voice call** | Vapi places a real call only to the session user's verified number. The transient assistant uses fictional institutions, a distress off-ramp, an OTP safety tripwire and structured post-call analysis. No-answer, voicemail, provider errors and insufficient evidence are **unscored**, not wins or losses. |
| **Phone ownership** | Twilio Verify sends the registration OTP. Missing provider configuration fails closed; the fixed development code works only when `ALLOW_DEV_VERIFY=true` is explicitly set. |
| **SMS drill** | Twilio Programmable Messaging sends a curated fictional scenario. A signed first-party link opens a confirmation/reveal flow, and a provider-durable reveal SMS is scheduled first as a fallback. |
| **Email ownership** | A signed, 30-minute ownership link opens a confirmation page; ownership changes only after an explicit POST confirmation. Proving a phone number does not prove ownership of an email address. |
| **Email drill** | Google Apps Script renders escaped, allow-listed fictional templates. It rejects arbitrary HTML, uses signed first-party reveal/report links, and durably schedules a safety follow-up before sending bait. No OpenAI key is used. |

Real drills are **manual, explicit “send/call me now” actions**. SafeSpace does not run
a background recurring-drill scheduler. Practice versions of all three channels remain
fully simulated and award half XP.

> **Twilio trial caveat:** trial accounts add a Twilio prefix to outbound SMS and can
> contact only verified destinations. That makes a drill easier to recognise.

## Quick start

SafeSpace requires Node 22.9 or newer because the server scripts use
`--env-file-if-exists`.

```sh
npm install
cp .env.example .env
npm start                 # build + serve at http://localhost:3000
npm test                  # isolated backend regression suite
```

With no provider credentials, the game UI, seeded demo family and in-app practice
drills still work. Real phone registration and live channels correctly return
“not configured.” For an offline registration demo, deliberately set
`ALLOW_DEV_VERIFY=true`; for the result-loop helper, also set
`ENABLE_DEMO_ROUTES=true`. Never use either flag in production.

## Layout

```text
src/               React 18 + Vite 6 + Tailwind 4 pixel-game UI
server/            Express API, provider integrations and persistence
deploy/            nginx and systemd configuration
api/               Vercel serverless entry point
smsdrill/           standalone historical SMS prototype
drill-bot/          standalone Python prototype
vapi-voice-poc/     standalone Python voice proof of concept
```

`main` is the application in `src/` and `server/`; the prototype directories are not
part of its runtime.

Further reading: [backend/API guide](server/README.md),
[deployment guide](DEPLOY.md), [manual test plan](TESTPLAN.md), and
[pitch deck specification](PITCH_SLIDES.md).

## Configuration

Copy [.env.example](.env.example) and use a different random value for each secret.

| Purpose | Required values |
|---|---|
| Real calls | `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID`, HTTPS `PUBLIC_URL`, `VAPI_WEBHOOK_SECRET` (32+ chars) |
| Phone OTP | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| Detach/reconnect account recovery | `IDENTITY_LOOKUP_SECRET` (stable, random, 32+ chars) |
| SMS drills | Twilio account values, `TWILIO_MESSAGING_SERVICE_SID`, `DRILL_LINK_SECRET`, and an HTTPS action origin |
| Email ownership/drills | `GOOGLE_SCRIPT_URL`, `GOOGLE_SCRIPT_SECRET`, `DRILL_LINK_SECRET`, and an HTTPS action origin |
| Persistent serverless storage | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

The action origin is `PUBLIC_URL`, or `EMAIL_ACTION_ORIGIN` when only messaging links
need a public origin. Apps Script must have matching `SAFESPACE_SECRET` and
`SAFESPACE_LINK_ORIGIN` Script Properties and must be authorised once for MailApp and
time-trigger access.

Optional lifecycle controls:

- `SESSION_TTL_MS`: default 30 days, minimum 1 minute.
- `REAL_DRILL_COOLDOWN_MS`: default 5 minutes per user and channel.
- `SMS_REVEAL_DELAY_MS`: 15 minutes–35 days; default 16 minutes.
- `EMAIL_SAFETY_FOLLOWUP_DELAY_MS`: 1 minute–24 hours; default 10 minutes.

## Safety and integrity model

- **Consent and ownership:** real calls/SMS target only the verified phone on the
  authenticated account; email drills require inbox ownership verification.
- **Expiring sessions:** newly issued bearer sessions are hashed at rest and expire
  after 30 days by default. Removing the verified phone withdraws consent and revokes
  every session.
- **Reconnect-safe phone removal:** detaching deletes the raw phone but retains a keyed
  HMAC lookup. Re-verifying the same number reconnects the existing account and
  progress. If SafeSpace cannot create that recovery lookup, removal fails with 503
  instead of orphaning the account. `IDENTITY_LOOKUP_SECRET` must remain stable and
  separate from the other secrets.
- **Durable verification throttles:** OTP starts are capped per destination and per
  resolved client address, while email ownership sends are capped per account and
  destination. Configure `TRUST_PROXY_HOPS` only for a known proxy path, and add a
  provider/CDN edge limit for production defense in depth.
- **Fictional institutions:** production scenarios never impersonate a real bank,
  agency or brand.
- **Distress off-ramp:** asking to stop or identifying the drill ends the call and never
  costs XP or a streak.
- **No ambiguous failures:** structured call analysis is preferred. Conservative
  role-aware fallback scoring requires explicit evidence; no-answer, voicemail, missing
  analysis and ambiguous transcripts are unscored.
- **Scanner-safe, exactly-once outcomes:** signed-link GET requests only render
  confirmation pages, so inbox/link previews cannot mutate state. Explicit POST
  confirmation completes a reserved attempt once; unknown/replayed callbacks cannot
  award or remove XP twice.
- **Recoverable results:** pending results are read non-destructively and removed only
  after the client explicitly acknowledges displaying them.
- **Durable reveals:** SMS uses Twilio fixed scheduling; email uses persisted Apps
  Script jobs and time triggers. Bait is not sent when the safety follow-up cannot be
  scheduled. If bait delivery becomes ambiguous after scheduling, the reveal remains
  active and the client is told not to retry immediately.
- **No arbitrary mail content:** the Apps Script relay accepts structured message kinds
  and renders its own escaped templates.
- **Call-data boundary:** Vapi and its transcriber process call audio and transcript
  content so the drill can be classified. SafeSpace requests audio recording, video,
  packet capture and provider logging off, and its own store persists the outcome and
  attempt metadata—not the transcript. Provider-side processing or retention is still
  governed by the provider configuration and contract.
- **Fails closed:** partial provider configuration disables that live feature rather
  than silently weakening verification or webhook authentication.

## Current operational limits

- There is no automatic recurring-drill scheduler; users explicitly start real drills.
- The file store is safe for one Node process and writes by atomic replacement. Use
  Upstash for multi-instance or serverless deployments.
- Provider acceptance is not the same as carrier/inbox delivery. Delivery status
  monitoring is still an operational concern.
- Call classification is intentionally conservative. Ambiguous interactions may be
  unscored and require a later retry.
