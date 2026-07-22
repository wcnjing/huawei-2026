# SafeSpace — Drill Mode

**Consent-based scam drills for families.** An adaptive AI calls you when you're not
expecting it, plays a realistic scammer, escalates the way a real one would — then turns
it into a debrief. Knowledge isn't a reflex; you can't read your way into staying calm
when a "police officer" says your account is being drained *right now*. So you drill it.

Built for Huawei Tech4City 2026.

---

## What's actually real

Being precise about this matters — it's the difference between a credible demo and a
claim that collapses under a judge's question.

| Channel | Status |
|---|---|
| **Voice call** | ✅ **Real.** Places a genuine phone call (Vapi → Twilio), Claude drives the persona, Azure Singapore-English voice. Verified end to end — a live call ran 2m10s and the real-OTP safety tripwire fired correctly. Cost: **$0.18** per call. |
| **Phone registration (OTP)** | ✅ **Real.** Twilio Verify sends an actual SMS code. Fully self-serve in-app. |
| **SMS drill** | ✅ **Real.** Sends an actual scam text (Twilio Programmable SMS) from a curated scenario library, then a guaranteed reveal text. Verified end to end — both messages delivered. |
| **Email drill** | ⚙️ **Built, needs keys.** Generates a phishing email (OpenAI) and sends it (Google Apps Script). Refuses with 503 until `OPENAI_API_KEY` + `GOOGLE_SCRIPT_URL` are set. |

⚠️ **Trial-account caveat:** while Twilio is on a trial, every outbound SMS is prefixed
`"Sent from your Twilio trial account - "`, which gives the drill away, and both calls and
texts can only reach numbers on the verified-caller-ID list. Upgrading removes both.

The in-app call/SMS/email drills also exist as **practice mode**: fully simulated, free,
and safe to run on stage. Real drills award full XP; practice awards half.

---

## Quick start

```sh
npm install
cp .env.example .env      # works offline as-is; add keys for real calls
npm start                 # build + serve  →  http://localhost:3000
npm test                  # 39 tests
```

Without any credentials you still get: the full game UI, practice drills across all three
channels, XP/streaks/leaderboard, phone registration (via a dev bypass code), and the
simulated surprise-call loop.

---

## Layout

```
src/               React 18 + Vite 6 + Tailwind 4 — the retro pixel game UI
server/            Express backend: drill API + serves the built app  (see server/README.md)
smsdrill/          Standalone static SMS-drill prototype
drill-bot/         Standalone Python drill bot
vapi-voice-poc/    Standalone Python POC that proved the real-call path
```

`main` is the app (`src/` + `server/`). The other three directories are independent
prototypes that don't run as part of it. A separate Next.js email app lives on the
`huawei-webapp` branch; its sending logic has been ported into `server/email.js`.

**Docs:** [`server/README.md`](server/README.md) (API, tests, going live) ·
[`PITCH_SLIDES.md`](PITCH_SLIDES.md) (deck spec) ·
[`FIGMA_TO_REACT.md`](FIGMA_TO_REACT.md) (design→code handoff)

---

## Configuration

Everything lives in `.env` (gitignored). See `.env.example` for the annotated list.

| Purpose | Vars |
|---|---|
| Real calls | `VAPI_API_KEY`, `VAPI_PHONE_NUMBER_ID` |
| Real OTP SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| Call outcomes → XP | `PUBLIC_URL` (a tunnel), `VAPI_WEBHOOK_SECRET` |
| Email drills | `OPENAI_API_KEY`, `GOOGLE_SCRIPT_URL` |
| Offline demo only | `ALLOW_DEV_VERIFY`, `ENABLE_DEMO_ROUTES` |

⚠️ **Turn the last two off before anything public.** They enable a fixed bypass code and
a route that writes drill results. The server prints a warning at startup when either is on.

---

## Safety model

This product calls real people and pretends to be a scammer, so the safeguards are the
core loop, not a polish pass:

- **Consent gate** — nothing fires for a user without a recorded opt-in, and every grant
  is written to a consent audit trail.
- **Proven identity** — a real drill only ever reaches the number *you* verified. The
  target comes from your session, never from the request; a consent flag records past
  consent and is explicitly **not** treated as authorisation.
- **Distress off-ramp** — "stop" / "is this a drill?" breaks character immediately.
- **Real-data tripwire** — start reading a real OTP and the call stops mid-sentence,
  without repeating the digits back. *Verified firing on a live call.*
- **Always reveals** — every drill ends with a scripted, verbatim reveal.
- **Never punishes distress** — bailing out scores neutral, not a loss.
- **Fictional institutions only** — no real bank or agency is ever impersonated.
- **No caller-ID spoofing** — illegal in SG, and we don't.
- **Fails closed everywhere** — missing config disables a feature rather than silently
  degrading it (misconfigured OTP refuses instead of accepting a bypass code; an
  unconfigured webhook rejects instead of accepting forged outcomes).

---

## Known gaps

Honest list — none of these block a demo:

- The Vapi webhook has never been exercised by a real call end to end (needs a tunnel).
  Outcome-scoring logic is unit-tested; the live wiring isn't.
- The JSON store does unsynchronised read-modify-write, so concurrent requests can lose
  an update. Fine for a demo; swap for Postgres before real users.
- Sessions never expire.
- The Home screen renders mock family data — `/api/family` is live but currently unused
  by the UI.
- `smsdrill/` impersonates a real bank, which contradicts the fictional-institution rule.
