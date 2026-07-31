# SafeSpace — manual test plan

Default staging target: **https://huawei-2026.vercel.app**

Test the responsive UI on a real phone. Use only a phone number and inbox that belong
to the tester and have explicitly consented to drills.

## Before testing

- Confirm `ALLOW_DEV_VERIFY` and `ENABLE_DEMO_ROUTES` are empty on staging/production.
- Confirm the public origin is HTTPS and matches signed-link and Apps Script settings.
- Record starting XP, streak and coin balance.
- Never enter a real password, OTP, card number or payment instruction during a drill.
- Real calls, SMS and email can incur provider charges. Practice journeys do not.

## A. First run, ownership and session

| # | Action | Expected |
|---|---|---|
| A1 | Open the app | Title fills the phone screen; no desktop phone-frame border |
| A2 | Tap **PRESS START** and complete coach marks | Highlights remain aligned and usable |
| A3 | Start registration with a number missing `+`/country code | Polite E.164 validation; no provider call |
| A4 | Enter a valid owned number and request OTP | One SMS arrives; immediate retry is rate-limited |
| A5 | On isolated staging, set requester max to 2 and request OTPs for three owned test numbers from one client | Third request is 429; no third provider send |
| A6 | Submit a wrong code | “Incorrect or expired”; no session |
| A7 | Submit the correct code with an empty name | Name is required |
| A8 | Submit a valid name | Signed in; the exact name appears in profile and future drills |
| A9 | Force-quit and reopen | Session and progress remain |
| A10 | Remove the verified phone in Account settings | Signed out, raw phone removed, consent withdrawn, call/SMS actions disabled; progress remains |
| A11 | Re-verify the same phone and name | Reconnects the same account, XP, room and history; does not create a blank duplicate |

New sessions are hashed at rest and expire after 30 days by default. To test expiry
without waiting, use a staging-only `SESSION_TTL_MS=60000`, register, wait one minute,
then confirm protected account/drill actions require a fresh OTP.

Detached-account recovery requires one stable `IDENTITY_LOOKUP_SECRET` of at least 32
random characters. On isolated staging, test a legacy/no-lookup fixture with that
secret unavailable: detach must return 503 and leave the phone/account attached. Never
rotate this secret during the reconnect test.

## B. Email ownership

| # | Action | Expected |
|---|---|---|
| B1 | Add an invalid email | Rejected locally/server-side |
| B2 | Add an owned inbox | Verification message arrives; account shows pending, not verified |
| B3 | Request another immediately | Rate-limited with a retry interval |
| B4 | Open the signed email link | A SafeSpace confirmation page appears; the GET alone does not attach the inbox |
| B5 | Explicitly confirm on that page | Inbox becomes verified and can receive drills |
| B6 | Reuse an expired/replaced link | Clear invalid/expired/replaced page; no account change |

Phone ownership must never silently mark an email verified.

## C. Practice call

| # | Action | Expected |
|---|---|---|
| C1 | Start a practice call and answer | Visible **DRILL MODE** indicator |
| C2 | Refuse or hang up | Win and half practice XP |
| C3 | Repeat and materially comply | Loss, no XP, streak resets |
| C4 | Use a distress/stop option | Neutral SAFE result; no XP loss or streak reset |
| C5 | Expand the debrief | Scenario-specific red flags, readable at phone width |

Repeat the result submit with a quick double-tap. The same practice `attemptId` must
apply XP only once.

## D. Practice SMS and email

### SMS

1. Open the practice inbox and the suspicious thread.
2. Exercise report, ask-family, link-click and close-page endings.
3. Confirm each result and explanation match the action.
4. Confirm only positive practice outcomes award half XP.

### Email

1. Open the practice inbox and inspect the sender/domain.
2. Exercise report, submit-details, open-attachment and cancel endings.
3. Confirm distinct debriefs and idempotent XP.

These journeys are simulated. They must never open an external phishing domain.

## E. Real drill lifecycle

Only run this section with complete staging provider configuration.

### Call

| # | Action | Expected |
|---|---|---|
| E1 | Double-tap **CALL ME NOW** | One provider call; the competing attempt is rejected/cooldown-protected |
| E2 | Answer and refuse/hang up | Structured result appears once and scores once |
| E3 | Read a test digit sequence after an OTP request | Assistant stops without repeating digits; loss is based on explicit target behavior |
| E4 | Ask to stop or identify the drill | Immediate reveal; SAFE, never a loss |
| E5 | Let a call go unanswered or to voicemail | `UNSCORED`; XP and streak unchanged |
| E6 | Replay the same Vapi webhook in a controlled test | Duplicate response; no second XP/streak mutation |

Ambiguous or missing analysis must be unscored. It must never be promoted to a win or
guessed as a loss.

### SMS

| # | Action | Expected |
|---|---|---|
| E7 | Tap **TEXT ME NOW** | One curated fictional SMS from the Twilio Messaging Service |
| E8 | Inspect its URL | HTTPS, first-party signed `/drill-reveal` URL; no registrable bait domain |
| E9 | Open the URL | Confirmation/reveal landing page; scanner-style GET alone does not score |
| E10 | Explicitly continue | SafeSpace reveal and exactly one recorded action |
| E11 | Do not open another SMS | Plain-text safety reveal arrives at configured time (default 16 minutes; never below Twilio's 15-minute floor) |

If durable reveal scheduling fails, no bait SMS should be sent. If the bait request
times out after scheduling, the reveal must remain scheduled: provider acceptance is
ambiguous, and an extra reassurance is safer than an unrevealed simulated scam. The UI
must warn that delivery is unconfirmed and must not encourage an immediate retry.

### Email

| # | Action | Expected |
|---|---|---|
| E12 | Try before verifying the inbox | Refused with a verification prompt |
| E13 | Send after ownership verification | Curated fictional email; exact verified name in greeting |
| E14 | Inspect source/content | Exactly the expected first-party reveal/report links; no injected third-party anchors or arbitrary HTML |
| E15 | Open reveal/report URL | Confirmation landing page first; explicit POST action required to score |
| E16 | Wait for safety follow-up | Unambiguous SafeSpace message at configured time (default 10 minutes) |

Apps Script must durably accept the follow-up before bait is sent. Its
`SAFESPACE_LINK_ORIGIN` must exactly match the app origin. An ambiguous bait-send
response keeps the follow-up scheduled and must not be presented as safely retryable.

## F. Pending-result recovery and acknowledgement

1. Produce a live result.
2. Interrupt/reload while the client is fetching it.
3. Reopen: the same result must still appear because GET is non-destructive.
4. Let the result screen finish displaying and ACK it.
5. Reopen again: the acknowledged result must not repeat.
6. Queue two controlled results: they should appear in order, one ACK at a time.

## G. Family, progression and persistence

- Family and leaderboard show the signed-in account plus permitted demo members; no
  phone number, phone lookup HMAC, email, pending email or session token appears.
- Buy furniture, return home, force-quit and reopen: the purchased item still renders.
- Selling and buying cannot duplicate items or make coins negative.
- Daily/payday rewards cannot be reclaimed by reload or rapid double-tap.
- XP, level, streak, room state and name survive force-quit/reopen.

## H. Settings, accessibility and navigation

- Change difficulty, notifications and display settings; reopen and confirm supported
  preferences persist.
- Exercise reduce motion, larger text, high contrast and scanline removal.
- Confirm sticky top navigation remains usable on long drill pages.
- Real drills are manual actions only. Leaving the app open must not imply or schedule
  recurring surprise calls/messages.
- Test back/swipe-back, background/resume, airplane mode and rapid reload.
- Test an SE-sized phone, a large phone and a notched device in portrait.

## I. Security smoke checks

- Unauthenticated real drill/account mutations return 401.
- A body-supplied phone, email or user id cannot redirect a drill.
- Wrong/missing Vapi secret cannot mutate an attempt.
- Unknown Vapi call/attempt ids are ignored; they never score the demo account.
- Repeated signed-link confirmation cannot score twice.
- Detach followed by same-number OTP reconnects the original opaque user id and progress.
- `/drill-reveal`, `/drill-report` and `/email-verify` reach Express confirmation pages,
  not the SPA fallback.
- `/api/drills/simulate` is 404 in production.
- Health/family/leaderboard responses expose no provider configuration or PII.
- After a controlled call, SafeSpace's own file/Redis record contains outcome and
  attempt metadata but no transcript or audio. Separately inspect provider settings:
  the code requests recording/logging off, but provider processing/retention must not
  be inferred solely from the local store.

## Reporting

```text
Screen:
Phone + OS:
Installed app or browser tab:
What I did:
What I expected:
What happened (exact text):
Screenshot/recording:
Reproducible: every time / sometimes / once
```

Report immediately if registration returns 500, XP is applied twice, a provider callback
scores an unknown user, PII appears in a list response, a signed GET mutates state
without confirmation, a bait message is sent without its safety follow-up, or any drill
asks for real credentials/payment. Also report phone detach that loses progress,
creates a duplicate account on re-verification, or succeeds without a recoverable
lookup on the no-secret staging fixture.
