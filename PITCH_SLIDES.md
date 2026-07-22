# SafeSpace — Pitch Deck Spec

**How to use this file:** paste it into Claude and say *"Build this as a slide deck."*
Each `## Slide N` is one slide. Follow the Design Direction exactly — the deck should look
like the product (retro 8-bit), not like a generic template.

> ⚠️ **Before presenting:** every `[STAT — VERIFY]` marker is a placeholder. Insert a real,
> cited figure (Singapore Police Force annual scam report, IMDA, etc.) or delete the line.
> Do not present unverified numbers.

---

## Design Direction

**Aesthetic:** 8-bit retro arcade game. It should feel like the product's "Drill Mode" UI.

- **Background:** very dark navy `#0a0e1a`. Panels `#111827`.
- **Accents:** green `#00ff88` (primary/safe), teal `#4ecdc4` (secondary), red `#ff2d55` (danger/scam),
  orange `#ff6b35` (warning/streak), yellow `#ffe66d` (reward/XP), purple `#c77dff` (elder).
- **Type:** `Press Start 2P` for titles/numbers (use sparingly — it's wide);
  a clean mono (`Share Tech Mono` / `VT323`) for body. Body text must stay readable.
- **Motifs:** chunky 3–4px borders, solid offset block shadows (no soft blur), sharp corners,
  everything on an 8px grid, subtle scanline overlay, pixel-star background.
- **Rules:** one idea per slide. Big type. Minimal words — the speaker carries detail.
  Never a wall of text. Use the pixel mascot as a recurring character.

---

## Slide 1 — Title

**DRILL MODE**
*SafeSpace — Scam Fighter*

> "Defend your mind. Defeat the scammers."

Team name · Huawei Tech4City 2026

**Speaker note:** Open cold with the hook, not the team intro.

---

## Slide 2 — The Problem

Scam calls keep working — even on people who *know* about scams.

- `[STAT — VERIFY]` Scam losses in Singapore, most recent year
- `[STAT — VERIFY]` % of victims who had seen scam-awareness material

**Speaker note:** The gap isn't awareness. Victims often *knew*. They still lost the money.

---

## Slide 3 — The Insight

**Knowledge is not a reflex.**

You can't read your way into staying calm when a "police officer" says your account is
being drained *right now*.

We run fire drills for fires. Nobody drills for the most common financial threat there is.

**Speaker note:** This is the whole thesis — land it slowly. Everything else follows.

---

## Slide 4 — The Solution

**SafeSpace: consent-based scam drills for families.**

An adaptive AI calls you when you're not expecting it, plays a realistic scammer,
escalates the way a real one would — then turns it into a guided family debrief.

Three channels: **voice call · SMS · email**

**Speaker note:** Emphasise *consented* and *unexpected*. Both are load-bearing.

---

## Slide 5 — How It Works

1. **Opt in** — verify your number, set a drill window (e.g. weekday evenings)
2. **Surprise drill** — at a random moment, your phone actually rings
3. **Adaptive AI** — it applies pressure, adapts to how you push back
4. **Safeguards** — reveals itself instantly on distress or real data
5. **Debrief** — what went well, what to watch, family discussion prompts

**Speaker note:** Walk the loop once, plainly. This is the product.

---

## Slide 6 — Why This Needs AI

A fixed script is just a scheduler. A **scammer adapts.**

| You say | It responds like a real scammer |
|---|---|
| "I'll call my bank." | "The line is compromised — calling them alerts the suspects." |
| "Send it in writing." | "Written notice takes 3 days. Your account freezes in one hour." |
| "How do I know you're real?" | Offers a fake case reference, presses harder. |

**Escalation ladder:** calm authority → urgency → assert authority → pressure. Never beyond.

**Speaker note:** This is the defensible technical core. Show, don't claim.

---

## Slide 7 — The App

Gamified so families actually come back.

- Pixel **family home** — each member's room, safe/scammed status at a glance
- **XP, levels, safe-streaks**, collectible badges
- **Leaderboard** — friendly competition across the family
- Red-flag spotting **teaches during** the drill, not after

**Speaker note:** Insert screenshots: Title, Family Home, Result (+100 XP).
The retro framing makes a scary topic approachable — that's deliberate, especially for seniors and youth.

---

## Slide 8 — Responsible Design *(our differentiator)*

Safeguards are **core loop, not polish**:

- ✅ **Consent gate** — OTP-verified number, nothing fires without opt-in
- ✅ **Audit trail** — every consent event logged
- ✅ **Distress off-ramp** — "stop" / "is this a drill?" → instant reveal + reassurance
- ✅ **Real-data tripwire** — starts reading a real OTP? Stops immediately. Never stored.
- ✅ **Always reveals** — every drill ends "This was a SafeSpace drill"
- ✅ **No caller-ID spoofing** — illegal, and we don't
- ✅ **Revocable anytime**

**Speaker note:** Judges will probe ethics. Get here before they ask.

---

## Slide 9 — What's Working Today

Not slides — a running system:

- **Real phone call** placed by an AI scammer persona, **Singapore-English voice**
- Adaptive escalation + safety reveal, driven by **Claude**
- **Gamified app** with live data — XP, streaks, family, leaderboard
- **Outcomes auto-score** from the call and flow back into the game
- **In-app registration** — OTP verification + consent audit trail

**Speaker note:** Be precise about what's live vs. next — credibility is worth more than
overclaiming. If doing a live demo, this is the slide you demo from.

---

## Slide 10 — Architecture

```
React (game UI)  →  Node/Express API  →  Vapi + Twilio  →  the phone rings
                          ↓
                    Claude (adaptive caller + debrief)
```

**Production path:** backend on **Huawei Cloud ECS**, models via **ModelArts**,
drill-window notifications via **HarmonyOS Push Kit**.

**Speaker note:** One breath. Don't linger on boxes.

---

## Slide 11 — Roadmap

- **Now:** working drills, gamified app, consent + safeguards
- **Next:** random-schedule drills at scale, family debrief generation
- **Then:** HarmonyOS app, Singlish/code-mixed voices, schools & community deployment

---

## Slide 12 — Close

**Scammers practise on our families every day.**
**It's time our families practised back.**

*SafeSpace — Drill Mode*

**Speaker note:** End on the line, not on a thank-you slide. Then take questions.

---

## Appendix (build only if asked)

- Escalation ladder detail + example transcript
- Safeguard trigger list and what each does
- Data model & consent event schema
- Cost per drill / unit economics
