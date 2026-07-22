# SafeSpace backend

Serves the built React drill-mode app **and** the drill API. Two jobs: fire real surprise
calls (Vapi) and turn drill outcomes into XP the UI reads. JSON-file store (`data.json`,
seeded from `data.seed.json`) — swap for Postgres per the spec when it's real.

## Run

```sh
npm install
npm run build        # build the React app into dist/
npm run server       # serve app + API on http://localhost:3000
# or: npm start       (build + serve in one)
npm test             # 39 tests
```

Firing **real** calls needs `.env` (`cp .env.example .env`, add your Vapi keys).
Everything else — the app, practice drills, and the `/simulate` demo loop — works without them.

## Tests

`npm test` runs 39 tests via `node --test`. No framework, no mocking library — plain
`node:test` + `node:assert`.

| File | Covers | Why it exists |
|---|---|---|
| `xp.test.mjs` | outcome → result / XP / streak | The one scoring rule both real and practice drills use. Pins "distress is never punished" and "unknown outcome defaults to a win". |
| `verify.test.mjs` | OTP modes + rate limit | **Regression:** an unconfigured or typo'd `TWILIO_*` deploy used to silently accept the bypass code from anyone. Both fail-closed paths pinned. |
| `store.test.mjs` | `publicUser()` PII projection | **Regression:** `/api/family` and `/api/me` used to return raw records containing `phone`. Also asserts the stored record isn't mutated — the server still needs the phone to dial. |
| `vapi.test.mjs` | webhook outcome heuristic, call guards | **Regression:** the heuristic scored the whole transcript, so the assistant's own "OTP" and its "Stop right there" reveal made nearly every drill score LOST/distress. Only `User:` turns count now. |
| `email.test.mjs` | email fail-closed | An unconfigured deploy must never half-send; requires *both* providers. |
| `routes.test.mjs` | the HTTP layer end to end | Re-runs each security-review exploit against a **production-shaped** env (no demo routes, no dev bypass) and asserts it fails: unauthenticated `fire`/`email`, body-supplied `user`, `?user=` on `/api/me`, unsigned webhook, `simulate` absent. |

`routes.test.mjs` imports the app instead of shelling out, which is why `index.js` calls
`app.listen()` only when it is the entrypoint. Env that `index.js` reads at import time
(demo-route registration) is set at the top of that file, before the import.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me` | Caller's own record (identity from session; PII stripped) |
| GET | `/api/family` | All family members (Home dollhouse), PII stripped |
| GET | `/api/leaderboard` | Ranked list (Leaderboard) |
| GET | `/api/drills/pending-result` | On app open: real-drill result waiting? |
| POST | `/api/drills/email` | Real email drill — auth required, sends only to your own stored address |
| POST | `/api/drills/practice-result` | In-app practice drill finished → half XP |
| POST | `/api/drills/fire` | Fire a real surprise call now (consent-gated) |
| POST | `/api/webhooks/vapi` | Vapi call-end → outcome → XP → queue result |
| POST | `/api/drills/simulate` | Demo the real-call result loop **without** telephony |

## Outcome → XP (see `xp.js`, the single scoring rule)

| Outcome | Result | XP | Streak |
|---|---|---|---|
| `hung_up` / `disengaged` / `verified` / `reported` | WON | full (100) | +1 |
| `caught_flag` | WON | partial (50) | +1 |
| `complied` / `shared_data` / `clicked_link` / … | LOST | 0 | reset |
| `distress_offramp` | SAFE | 0 | untouched (never punished) |

Practice drills award half XP. Unknown outcomes default to a benign win — the system
never punishes on ambiguity.

## Demo the surprise-call loop without a phone

```sh
curl -XPOST localhost:3000/api/drills/simulate -H 'content-type: application/json' -d '{"outcome":"shared_data"}'
curl localhost:3000/api/drills/pending-result        # -> the queued LOST result the app shows on open
```

## Wiring status

The React app is wired to the backend and falls back to mock data if it's offline:
- Home reads `/api/family`, Leaderboard reads `/api/leaderboard`.
- Every drill ending POSTs its outcome (XP persists); the Result screen shows the real XP.
- On load, `/api/drills/pending-result` routes a real surprise-call result to the result screen.

## Going live with real call outcomes (webhook)

Real drills score themselves from Vapi's end-of-call report. Vapi is external, so it needs a
public URL to reach your local backend:

```sh
# 1. start the backend
npm start
# 2. in another terminal, expose it (any of these works):
cloudflared tunnel --url http://localhost:3000      # no account
# or: npx localtunnel --port 3000
# or: ngrok http 3000
# 3. put the https URL it prints into .env, then restart the backend:
#    PUBLIC_URL=https://xxxx.trycloudflare.com
```

Now every `POST /api/drills/fire` call passes that webhook URL to Vapi as the assistant's
`server.url`, so when the call ends Vapi POSTs its report to `/api/webhooks/vapi`, which scores
the outcome → XP → queues the result the app shows on next open. No tunnel? Everything else still
works; use `/api/drills/simulate` to demo the surprise-call loop offline.
