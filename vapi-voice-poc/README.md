# SafeSpace — Voice Call POC

A standalone proof-of-concept for **one** SafeSpace feature: an AI that places a real,
Claude-driven **scam-drill phone call** to your own mobile, escalates when you push back, and reveals
itself as a drill. Built to answer two questions before we build the rest of SafeSpace:

1. **Viable?** Can we place a real Claude-driven call with acceptable latency / turn-taking?
2. **Convincing?** Does the voice + persona + escalation feel like a real scam call?

**Stack:** Vapi (orchestration + native Claude) + Twilio (a **US Local** number that dials your SG
mobile) + ElevenLabs voice — all on **free trial credits**, so $0 out of pocket for the POC.

> Why a US number? Twilio doesn't sell Singapore local numbers without an IMDA regulatory bundle
> (not available on a trial). A **US Local** number dials your SG mobile fine once Singapore is enabled
> in Geographic Permissions. The +1 caller ID is fine for the POC — you're testing the conversation,
> not the number, and real scams routinely show foreign caller IDs. (A SG-registered caller ID is a
> later production concern; your spec's design is "a declared number or in-app," not a spoofed local one.)

> Safety & scope: this POC only ever calls **your own consenting, verified number**. Personas use
> **fictional** agencies/banks. No caller-ID spoofing. Safeguards here are prompt-level (break-character
> on distress, real-data tripwire, always-reveal) — the production build adds deterministic enforcement.

---

## Part A — One-time account setup (you do this)

I can't create accounts or enter payment for you, so these steps are yours. ~20 minutes.

### 1. Twilio (the phone number) — free $15 trial credit
1. Sign up at <https://www.twilio.com/try-twilio>.
2. **Verify your own mobile as a Verified Caller ID**: Console → Phone Numbers → Manage → Verified
   Caller IDs → add your SG number (e.g. `+65…`). On a trial you can only call verified numbers — that's
   exactly our case.
3. **Enable Singapore as a dialing destination**: Console → Voice → Settings → **Geographic Permissions**
   (aka Dialing Permissions) → tick **Singapore**. Without this, the outbound call to +65 is blocked.
4. Buy a **US Local** number: Console → Phone Numbers → Buy a number → Country **United States**, type
   **Local**, capability **Voice** (works once a verified caller ID exists on the trial). "Local" is just
   the number *type* (vs Toll-Free/Mobile) — it still dials internationally.
5. From the Console dashboard, note your **Account SID** and **Auth Token** (needed to import into Vapi).

### 2. Vapi (the brain + voice) — free $10 trial credit (~150–200 min)
1. Sign up at <https://dashboard.vapi.ai>.
2. **Import your Twilio number**: Dashboard → Phone Numbers → Import → choose Twilio → paste the
   US Twilio number, Account SID, and Auth Token. (Vapi's own free numbers can't dial international,
   so we import the Twilio number to reach your SG mobile.)
3. Click the imported number and copy its **phoneNumberId** (a UUID — *not* the `+1`/`+65` digits).
4. Dashboard → API Keys → copy your **private API key**.
5. Claude is used **Vapi-managed** — no Anthropic account needed; the model cost draws from your Vapi
   credit.

### 3. Fill in `.env`
```sh
cp .env.example .env
```
Set the three required values:
- `VAPI_API_KEY` — from step 2.4
- `VAPI_PHONE_NUMBER_ID` — from step 2.3
- `MY_MOBILE` — your verified mobile in E.164, e.g. `+6591234567`

---

## Part B — Run a drill call

```sh
python3 -m venv .venv && source .venv/bin/activate   # optional but recommended
pip install -r requirements.txt
python call.py
```

Your phone rings. Answer it and run the drill. To actually test the two things that prove viability:

- **Escalation:** deflect with *"I'll check with my bank first."* → a convincing agent should apply
  believable pressure and discourage you from hanging up — not give a canned reply.
- **Safety reveal:** say *"is this a drill?"* or *"stop."* → it must break character, say *"This was a
  SafeSpace drill,"* and end.

Then review the **recording + full transcript in the Vapi dashboard** (Calls → your call). A metadata
record is also saved locally under `transcripts/`.

Finally, fill in **`score_sheet.md`** to decide: viable? convincing enough to build on?

---

## Tuning "convincing" without editing code

Everything volatile is env-overridable in `.env`:
- `VAPI_VOICE_ID` — try different ElevenLabs voices; voice is the single biggest convincingness lever.
- `VAPI_CLAUDE_MODEL` — defaults to a fast Haiku-class Claude for natural turn-taking. A smarter model
  (e.g. Sonnet) gives more nuanced escalation but adds latency — try both and compare on the score sheet.
- `FIRST_MESSAGE` — the spoken opening line.
- `PERSONA_FILE` — swap in other scam scenarios (add more files under `persona/`).

To edit the scam behaviour itself, edit `persona/govt_impersonation.md` (only the text below the
`---` line is sent to the model) and just re-run `python call.py`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `HTTP 400` naming `model` | `VAPI_CLAUDE_MODEL` string not recognised — check Vapi dashboard → Model for the exact current Claude id and set it in `.env`. |
| `HTTP 400` naming `voice` / `voiceId` | Bad `VAPI_VOICE_ID` — pick a voice in the Vapi dashboard and copy its id. |
| Call never rings | On Twilio trial the destination must be a **Verified Caller ID**; confirm `MY_MOBILE` is verified and in E.164. |
| A "you have a trial account" message plays first | Twilio trial preamble — a trial artifact, gone on upgrade. Discount it when scoring the opening. |
| `401 Unauthorized` | Wrong/expired `VAPI_API_KEY`. |
| Call to +65 rejected / `permission to dial` error | Enable **Singapore** in Twilio → Voice → Settings → Geographic Permissions (Part A step 3). |
| A +1 number shows on your SG phone | Expected — the Twilio number is US. Fine for the POC; caller ID is a later production concern. |

## What's intentionally NOT here
SMS drill, debrief engine, dashboard, consent DB, scheduler, and any Huawei integration — those belong
to the full SafeSpace build. This repo is only the voice-call feasibility test.
