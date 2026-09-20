# Households: design

Date: 2026-09-19 · Status: agreed in brainstorming · Target: live ~9 Oct 2026 ·
Sub-project 2 of the [multiplayer roadmap](2026-09-18-multiplayer-roadmap.md)

Players design their own character, sign in with their phone and play. Playing alone
is the full game. A player can create a **house** and invite up to five others with a
code; the house then replaces the hardcoded grandma/mum/dad/kid family everywhere.

## Decisions

| Topic | Decision |
|---|---|
| Group | A neutral **house**, not a family. No roles. |
| Character | The existing mascot customiser (`AvatarCustomisationScreen`), done **before** sign-up. |
| Account | Required. The anonymous demo family goes away. |
| Solo play | The full game. A house is optional and can be created or joined at any time. |
| Membership | One house per person; up to 6 members; people can join at any time. |
| Owner | The creator. Only the owner regenerates the code, renames the house and removes members. |
| Updates | A content-free Supabase Realtime "doorbell"; clients then refetch from our API. |
| UI | First pass, redone later. Approach A: new code in `src/app/house.ts` (logic only; new screens live in `App.tsx`). |

## 1. Data

Migration `supabase/migrations/20260920000001_houses.sql`, in schema `safespace`, RLS
enabled with no policies, like every other table.

**`houses`**

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `house_<uuid>` |
| `name` | text not null | 1–30 characters after trimming |
| `owner_id` | text not null → `users(id)` | |
| `invite_code` | text unique, nullable | 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no 0/O/1/I/L); null when no live code |
| `invite_expires_at` | timestamptz, nullable | 24 hours after generation |
| `doorbell` | text not null | random 128-bit topic name; rotated when a member is removed |
| `created_at` | timestamptz not null default now() | |

**`users`** gains:

| Column | Type | Notes |
|---|---|---|
| `house_id` | text → `houses(id)` on delete set null, nullable | one house per person by construction |
| `joined_house_at` | timestamptz, nullable | used for ownership handover |
| `avatar` | jsonb, nullable | `{color, glow, hat, eyes, outfit}`; null means the default mascot |

**`drill_runs`** (house drills, recorded per person so solo players can play them)

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `user_id` | text not null → `users(id)` | |
| `client_key` | text not null | idempotency key from the client; unique with `user_id` |
| `correct`, `cautious`, `wrong` | integer ≥ 0 | round counts |
| `xp_gained` | integer not null | 0 unless this was the person's first run this week |
| `at` | timestamptz not null default now() | |

Index on `(user_id, at)`.

**Codes** are shown as `K7P-3QX` and accepted with or without the dash, in any case.
Any member sees the live code; generating a new one replaces the old one.

**Weeks** start Monday 00:00 Asia/Singapore. Computed, never stored:
- *active this week*: any drill result or drill run since the week started;
- *safe this week*: no `LOST` drill result since the week started.

**Drill run XP**: each round scores `correct 100 / cautious 50 / wrong 25` (the existing
`FAMILY_XP`). Only the person's first run of the week adds XP to their stats; later runs
are recorded with `xp_gained = 0`.

**Avatars** are validated against an allowlist:
- `color`, `glow`: `#4ecdc4 #ff6b35 #c77dff #ffe66d #ff2d55 #00ff88`
- `hat`: `None Cap Helmet Crown`
- `eyes`: `Default Shades Visor Goggles`
- `outfit`: `Standard Camo Neon Stealth`

Existing accounts get `avatar = null` and no house; the app draws the default mascot.

## 2. Rules and API

All routes require a session (401 otherwise). No response ever includes a phone number,
email or recovery lookup.

| Method | Path | Who | Does |
|---|---|---|---|
| GET | `/api/house` | anyone | `{ self, house }`: `self` is the caller's own member view, so solo players get weekly flags too; `house` is `null` when solo, else the house: name, owner, members (id, name, avatar, stats, weekly flags, this week's drill score), code and expiry, doorbell |
| POST | `/api/house` | not in a house | create with `{name}`; the creator is owner and gets a fresh code |
| POST | `/api/house/join` | not in a house | `{code}`; the same "code not valid" message for wrong and expired codes; "house is full" at 6 |
| POST | `/api/house/code` | owner | new code, 24h expiry |
| POST | `/api/house/name` | owner | rename |
| POST | `/api/house/members/:id/remove` | owner | removes a member (not themself); rotates the doorbell |
| POST | `/api/house/leave` | member | an owner leaving hands ownership to the earliest joiner; the last member leaving deletes the house |
| POST | `/api/me/avatar` | anyone | set the avatar |
| POST | `/api/drills/house-run` | anyone | `{clientKey, correct, cautious, wrong}`; replaying a key returns the stored run |

**Join limits:** 10 failed codes per account per hour and 30 per network address per
hour, stored in `rate_limit_hits`. Successful joins don't count.

**Concurrency:** create, join, leave and remove each run in one transaction. Lock order
is always house row, then user rows (sorted by id). Join locks the house, counts members
and adds the joiner in the same transaction, so a house can never exceed 6. A person's
own `house_id` is re-checked under their row lock, so they can't end up in two houses.

**Doorbell** (`server/doorbell.js`): after a transaction commits, the server POSTs an
empty `changed` broadcast to `{SUPABASE_URL}/realtime/v1/api/broadcast` on the house's
`doorbell` topic, with a 2-second timeout. The secret key travels in the `apikey`
header only — new Supabase secret keys are not JWTs, so no `Authorization: Bearer`
header is sent. Failures are logged and never fail the request. It rings on every house
change and whenever a member's stats change (drill results, drill runs, name or
avatar). Without `SUPABASE_URL` or the key it does nothing. The broadcast carries no
data; clients refetch `GET /api/house`. Removing a member rotates the topic so the
removed person stops hearing it. The Express Content-Security-Policy adds the Supabase
origin to `connect-src`, so the browser's own Realtime subscription (using
`VITE_SUPABASE_PUBLISHABLE_KEY`) is allowed when Express serves the built app.

**Sign-up changes** to `POST /api/verify/check`:
- `name` is required only when the number has no account; a returning number keeps its
  name if none is sent.
- An optional `avatar` is accepted and saved (replacing the old one for a returning
  number, because the player just designed it).
- With no name for an unknown number, it answers `404 { code: "NO_ACCOUNT" }` and
  creates nothing, so "I HAVE AN ACCOUNT" can offer "NEW PLAYER".

**Removed:** the anonymous "you" fallback, `GET /api/family` and the public
`GET /api/leaderboard`. The demo-family seed rows stay in the database, unused.

## 3. First launch and sign-in

**New player:** Title → PRESS START → **NEW PLAYER** → design the character plus
**"WHAT SHOULD WE CALL YOU?"** (the draft is saved on the phone as they go) → phone and
code (the name field moves off this screen) → home, then the existing how-to-play tour.
There is no house step on the way in.

**Returning player, new phone:** Title → **I HAVE AN ACCOUNT** → phone and code → home
with their name, mascot, progress and house. `NO_ACCOUNT` offers NEW PLAYER.

**Returning player, same phone:** a valid session goes straight home.

**Houses from solo play:** a small **+ PLAY WITH OTHERS** button on home, and a HOUSE
entry in settings, open the create/join screen:
- *Create*: name box, blank, placeholder "e.g. THE TANS".
- *Join*: 6-character box that adds the dash.
- *Invite link* `…/?house=K7P3QX`: remembered through sign-up, pre-fills the join box;
  nothing happens until the player taps JOIN.

**Leaving or removed:** back to solo play with a one-line note. Progress always belongs
to the person.

**Session expired or phone detached:** back to I HAVE AN ACCOUNT; the saved design stays
on the phone.

## 4. Screens

**New `src/app/house.ts`** holds logic only — no screens, to avoid an import cycle with
`App.tsx`:
- Types and the API client for the routes above.
- `useHouse(enabled)` → `{ state: { self, house }, loading, refresh, apply }`. Fetches
  on start, on a doorbell ring, when the app regains focus and every 5 minutes.
  Subscribes with `@supabase/supabase-js` using `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`; without them it falls back to focus and 5-minute
  refreshes.

Session helpers (`sessionToken`, `authHeaders`, `apiGet`, `apiPost`) live in
`src/app/api.ts` instead. New screens — new/returning choice, create house, join house,
house settings (code with share and copy, rename, member list with remove, leave) — go
in `App.tsx`, next to the UI primitives (`PixelBtn`, `PixelMascot`, …) they use.

**Existing screens:**

| Screen | Change |
|---|---|
| Title / sign-up | Section 3 flow; the name field moves into the customiser. |
| Home | **Solo, or a house of one:** the player's room fills the screen (mascot, furniture, stats) with the + PLAY WITH OTHERS button; a house of one shows its code on the button. **Two or more members:** the dollhouse, one room per member, drawn with `PixelMascot`. |
| Safety bar | "N of M safe this week" from the server. |
| Member profile | Real name, mascot, stats; no phone or email; owner sees REMOVE. |
| Leaderboard | Fame board ranks members; Shame board lists members not safe this week. Solo: the player's own card plus the invite button. |
| House drill | Scenarios name "a housemate" instead of a role; finishing posts to `/api/drills/house-run` and shows the week's result. |
| Chat | Fake family messages removed; PIXI only until sub-project 3. |
| Shop / profile | Member switcher removed; the player is always themself. Coins stay on the phone. |
| Copy | "Family" becomes "house" in player-facing text. |

**Deleted:** `FAMILY_MEMBERS`, `MEMBER_MAP`, the role characters (`CharGrandma` etc.),
pass-and-play member switching, the fake messages in `INITIAL_CHAT`.

## 5. Testing and rollout

**Server tests** (PGlite locally, plus real Postgres in CI):
- *Store*: create/join/leave/remove; owner handover; last member deletes the house; cap
  of 6; one house per person; expired and regenerated codes; weekly flags across the
  Monday SGT boundary; first-run-of-week XP; drill-run idempotency; avatar allowlist.
- *Routes*: 401 without a session; 403 for non-owners on owner routes; identical
  wrong/expired code messages; join rate limits; no phone or email in `GET /api/house`;
  `NO_ACCOUNT`; removed routes return 404.
- *Races* (real Postgres, `server/store.concurrency.test.mjs`): 7 people joining a
  house of 5 at once, so exactly one gets in; one person joining two houses at once; the
  owner leaving while others join; the last member leaving while someone joins, which
  exercises the house-deletion path (member removal and drill runs touch disjoint rows,
  so a race between them was dropped in favor of this one); one person creating a house
  while joining another, since `createHouse` takes no rate-limit lock and only the
  user-row lock keeps it honest. Each race test is proven by temporarily removing its
  lock.
- *Doorbell*: rings only after commit; a failing or slow ring doesn't fail the request;
  no-op when unconfigured.

**Frontend:** `npm run typecheck`, `npm run build`, and a preview run on PGlite: sign up
solo, create a house, join from a second tab, see the dollhouse, and watch the doorbell
update the first tab.

**Rollout** (the user runs the production steps):
1. Build on `feat/houses`; CI green.
2. `npx supabase db push`.
3. In Supabase, confirm Realtime broadcast allows public channels (the topic name is the
   secret).
4. Add to Vercel Production: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Merge, push main, verify production.

## Out of scope

Real chat (sub-project 3); server-side coins and furniture (sub-project 4); a UI
redesign; multiple houses per person; transferring ownership by hand.
