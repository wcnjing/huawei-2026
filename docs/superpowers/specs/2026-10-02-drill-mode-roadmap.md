# Drill Mode: forward roadmap (draft)

Date: 2026-10-02 · Status: **draft for discussion** · Next hard date: Tech4City final, 27 Oct 2026 (rehearsal from 20 Oct)

Follows [the multiplayer roadmap](2026-09-18-multiplayer-roadmap.md). Its four sub-projects are
done or nearly done; this covers everything after, across the whole product.

## Where things stand

| Area | State |
|---|---|
| Real drills (call / SMS / email) | Live. Manual "call me now" only; consent-gated to the user's own verified number. |
| Postgres on Supabase | Live since 19 Sep (one project, Tokyo, no dev project). |
| Households | Live: create/join by code, dollhouse, leaderboards, house drill runs, doorbell. |
| House chat | Live. |
| Coins / furniture / layout | **Saved to the account** (`users.home_inventory`), but the **client is still the authority**: it sends the whole record, the server only shape-checks it. |
| Room styles, daily/weekly reward claims | Browser-only. Don't follow a player to a new phone. |
| Scam-intel pipeline | Built, every source disabled (no permission to scrape). |
| `UNSAFE_FORCE_DEV_VERIFY` | **Still on in production** for the demo. Phone ownership is not checked while it is set. |

## Principles for choosing what's next

1. Nothing ships that weakens the consent guardrail the pitch rests on.
2. Before 27 Oct: demo reliability beats new features. After: product quality.
3. Prefer finishing half-built things (server-owned economy) over adding new surfaces.

## Phase 1: demo hardening (now to 19 Oct)

The goal is that the judges' run cannot embarrass us.

- **Demo script + dry runs.** Run `TESTPLAN.md` end to end on a real phone, in the house flow too (two phones).
- **Pro Supabase for finals week.** A free project pauses when idle, and the keep-alive cron is unconfirmed as sufficient.
- **Failure behavior.** What does the app show when Vapi, Twilio or Supabase is down mid-demo? Add a visible "couldn't reach the server" state where it currently fails silently (the home-inventory sync only `console.warn`s).
- **Trial-account limits.** Twilio trial prefixes SMS and only reaches verified numbers: decide whether to upgrade or script around it.
- **Decide the verify-bypass story** (see open questions). Don't present phone ownership as verified to judges while the flag is on.

Cut if time is short: anything in Phase 2.

## Phase 2: finish the economy (20 Oct to 27 Oct, optional; first thing cut)

Sub-project 4 as originally scoped: **server-owned** coins and purchases.

- Server-side `buy` / `sell` / `claim daily` endpoints that check balance and ownership in one transaction, instead of trusting the client's whole-record write.
- Fixes the cross-device lost-update race and the "edit your own coin balance" hole.
- One-time import of existing `home_inventory` snapshots as the starting balance (so nobody loses what they have).
- Move reward-claim dates server-side (so a daily reward can't be re-claimed on a second device).
- Room style into the same record (or its own column).

Risk: touches the money path late. If it isn't solid by ~22 Oct, ship the demo on the current client-authoritative model and do it in Phase 3.

## Phase 3: after the final (Nov onward)

**Must-do cleanup (not optional):**
- Remove `UNSAFE_FORCE_DEV_VERIFY` (env var in Vercel, `server/verify.js`, tests, `.env.example`).
- Drop the `UPSTASH_*` env vars once rollback is no longer wanted.
- Add a dev/staging Supabase project so local `.env` stops pointing at production.

**Product:**
- **Recurring drills.** There is no scheduler today; users start every real drill. A schedule (opt-in cadence, quiet hours, one-tap pause) is the biggest gap between "app" and "habit". Needs: consent model for unattended calls, per-user cadence, cron/queue, and strict rate limits.
- **Delivery monitoring.** Provider acceptance isn't delivery. Track Twilio/Vapi status callbacks, surface "didn't connect" outcomes, and retry policy.
- **Scenario library.** More scenarios per channel, difficulty tiers, and a debrief that names the specific red flags hit. Human-authored first.
- **Scam intel.** Only via permission or manual input through the existing validate/render gate (see the source-terms note). Don't enable scraping.
- **Family debrief.** Turn a drill outcome into something the house can see and discuss (chat post, weekly summary), without shaming anyone.
- **Accessibility and elders.** Larger text mode is partly there; test with the actual target users (grandparents) before adding more game layers.

**Platform:**
- Huawei Cloud path (the roadmap kept this open: plain Postgres, our own auth, Supabase only as a doorbell). Decide whether it's a real goal or just an option.
- Observability: structured logs, error alerts, an uptime check beyond `/api/health/db`.
- A real frontend test layer. Today it is `tsc` + build + manual; the room editor and sync-gating logic bit us this month.
- Split `App.tsx` (still the bulk of the UI in one file).

## Open questions (need your call)

1. **Verify bypass:** keep it on through 27 Oct (current plan), or switch to real Twilio Verify for the final and use a pre-verified demo number?
2. **Is Phase 2 in or out** of scope for the final, given the 22 Oct cut line?
3. **Recurring drills:** is this the next big feature, or is it out of scope for now (it's the heaviest consent/safety work on the list)?
4. **Who is the target user after the hackathon?** Families in Singapore, or institutions (banks, community groups)? That changes Phase 3 priorities a lot.
5. **Huawei Cloud:** real migration target, or just keeping the option?

## Not planned

Real-time/live multiplayer, firing a drill at someone else, multiple houses per person, hand-transferring house ownership (all still out of scope from the households spec).
