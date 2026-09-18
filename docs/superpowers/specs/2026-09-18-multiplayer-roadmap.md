# Multiplayer households: roadmap and decisions

Date: 2026-09-18 · Status: agreed in brainstorming · Deadline: Tech4City final, 27 Oct 2026

SafeSpace becomes multiplayer: a family shares one persistent **household** that
members join with a code. This document records the product decisions and splits the
work into four sub-projects. Each sub-project gets its own spec, plan and build.

## Product decisions

| Topic | Decision |
|---|---|
| What "playing together" means | A **shared household**, asynchronous. Real members replace the hardcoded Grandma/Mum/Dad/Kid. Nobody has to be online at the same time. |
| Login | **Phone number + text code**, the existing Twilio Verify flow, made required for household features. |
| Shared in v1 | Dollhouse + leaderboard/Hall of Shame, family chat, coins + furniture, family drill progress. |
| Joining | **Instant join with a code that expires 24 hours after the owner generates it.** Generating a new code invalidates the old one. |
| Membership | One household per person at a time; up to 6 members; the creator is the owner, who can remove members and generate codes. |
| Real drills | Unchanged: a call or SMS still goes only to the member's own verified number. Nobody can fire a drill at someone else. |
| Backend | **Supabase Postgres for all data**, reached from our server. Our own phone login and sessions stay. Supabase Realtime is used only as a content-free "something changed" doorbell; clients fetch through our API. This keeps a path to Huawei Cloud's own Postgres. |
| Existing data | Start fresh. Nothing is imported from Upstash Redis. |
| Horizon | Long-term product, not just the hackathon. |

## Sub-projects

| # | Sub-project | Scope | Target |
|---|---|---|---|
| 1 | **Postgres foundation** | Move everything `server/store.js` holds to Supabase Postgres with no user-visible change. [Spec](2026-09-18-postgres-foundation-design.md) | ~1 Oct |
| 2 | **Households** | Login required for household features; create/join with a 24h code; owner rules; real dollhouse, leaderboard and Hall of Shame; family drill progress | ~9 Oct |
| 3 | **Family chat** | Real messages, PIXI posts, the Realtime doorbell | ~14 Oct |
| 4 | **Coins + furniture on the server** | Server-owned balances and purchases, one-time import of each phone's local inventory | ~20 Oct |

Rehearsal runs from 20 Oct. If the schedule slips, sub-project 4 is cut first: the demo
still works with coins kept on the phone.
