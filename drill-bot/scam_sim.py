"""
scam_sim.py — LIVE scam simulation for the SafeSpace Drill Bot.

The bot role-plays a scammer over several turns. The user replies in their own
words; an LLM (Reka, with optional OpenAI fallback) improvises realistic
pushback and pressure — the reflex-under-stress practice that scripted drills
can't give. Ends with a coach-style debrief.

Commands added:
    /simulate  - start a live scam simulation
    /end       - stop the current simulation and get feedback

Setup:
    pip install reka-api          (and/or openai)
    Put REKA_API_KEY in your .env (optionally OPENAI_API_KEY as fallback).

Everything is consensual role-play for anti-scam training. The scammer persona
never uses real links, real numbers, or real payment details.
"""

import logging
import os
import re

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

log = logging.getLogger("drill_bot.sim")

REKA_API_KEY = os.getenv("REKA_API_KEY", "")
REKA_MODEL = os.getenv("REKA_MODEL", "reka-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

MAX_TURNS = 6  # scammer replies before the sim auto-ends

# ---------------------------------------------------------------------------
# LLM clients (lazy, provider-agnostic)
# ---------------------------------------------------------------------------
_reka = None
_oai = None
if REKA_API_KEY:
    try:
        from reka.client import AsyncReka

        _reka = AsyncReka(api_key=REKA_API_KEY)
    except ImportError:
        log.warning("REKA_API_KEY set but 'reka-api' not installed (pip install reka-api).")
if OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI

        _oai = AsyncOpenAI(api_key=OPENAI_API_KEY)
    except ImportError:
        pass


def llm_available() -> bool:
    return _reka is not None or _oai is not None


async def ask_llm(system: str, convo: list) -> str | None:
    """Return the model's reply text, or None on failure.
    `convo` is a list of {"role": "user"|"assistant", "content": str}."""
    # --- Try Reka first ---
    if _reka is not None:
        try:
            messages = [{"role": "user", "content": system}] + convo
            resp = await _reka.chat.create(model=REKA_MODEL, messages=messages)
            # Response shape: resp.responses[0].message.content
            try:
                return resp.responses[0].message.content.strip()
            except Exception:
                return str(resp).strip()
        except Exception as e:
            log.warning("Reka call failed (%s): %s", type(e).__name__, e)
    # --- Fallback: OpenAI ---
    if _oai is not None:
        try:
            resp = await _oai.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "system", "content": system}] + convo,
                temperature=0.9,
                timeout=20,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            log.warning("OpenAI call failed (%s): %s", type(e).__name__, e)
    return None


# ---------------------------------------------------------------------------
# Scammer personas — opening line is scripted; the LLM improvises from there.
# ---------------------------------------------------------------------------
PERSONAS = [
    {
        "name": "Bank officer (OCBC)",
        "goal": "get the victim to click a fake link and reveal their OTP / online-banking login.",
        "opening": (
            "OCBC Bank: Dear Customer, an unrecognised device has accessed your "
            "account. It will be frozen within 12 hours. Reply here to verify and "
            "keep it active. May I confirm — did you just log in from a new phone?"
        ),
    },
    {
        "name": "Parcel courier (SingPost)",
        "goal": "get the victim to pay a small 'customs/redelivery fee' and enter card details on a fake page.",
        "opening": (
            "[SingPost] Hi, your parcel SP83941SG is on hold — the delivery "
            "address is incomplete and there's a $2.99 redelivery fee outstanding. "
            "Shall I send you the link to update your address and settle it?"
        ),
    },
    {
        "name": "Police / MAS officer",
        "goal": "frighten the victim into transferring money to a 'safety account' for 'verification'.",
        "opening": (
            "Good afternoon, this is Officer Lim from the Anti-Money-Laundering "
            "unit. Your bank account has been linked to a criminal case. This is "
            "very serious. Are you alone and able to talk right now?"
        ),
    },
    {
        "name": "Job recruiter",
        "goal": "hook the victim into a task job, then get them to 'top up' money to unlock commissions.",
        "opening": (
            "Hi! I'm Jamie from HR Recruitment 🌟 We saw your profile — we have a "
            "part-time online job, $80–$300/day just liking merchants on Shopee. "
            "Very easy, paid daily. Would you like to try a few free tasks first?"
        ),
    },
]

SCAMMER_SYSTEM = (
    "You are role-playing a SCAMMER inside a CONSENSUAL anti-scam TRAINING drill "
    "(like a fire drill). The user knows this is a simulation and has opted in. "
    "Stay fully in character as: {name}. Your objective: {goal}\n\n"
    "Behave like a real scammer: be friendly then urgent, invoke authority, "
    "reassure ('this is official, don't worry'), use mild guilt or fear, and "
    "push back when the user hesitates or refuses — try again once or twice with "
    "a new angle. Keep every reply SHORT, like a real SMS/WhatsApp/chat message "
    "(1-3 sentences). Write in the same casual, slightly-off style real scammers "
    "use.\n\n"
    "Hard rules: NEVER use real working links, real phone numbers, or real "
    "payment details — only obvious fakes like 'verify-sg.example.net'. Never give "
    "real instructions for committing fraud or any real harmful content. This is "
    "only conversational role-play to train the user to resist. If the user firmly "
    "refuses and disengages after a couple of attempts, back off. Do not break "
    "character or mention that you are an AI. Reply with only the scammer's next "
    "message."
)

COACH_SYSTEM = (
    "You are a warm anti-scam coach reviewing a training role-play where the user "
    "faced a simulated scammer. Given the transcript, write a short debrief "
    "(3-5 sentences): say whether the user handled it well or would likely have "
    "been scammed, name the exact risky moment(s) and the red flags they should "
    "remember, and end with one concrete tip. Be encouraging, not preachy."
)

_OTP = re.compile(r"\b\d{6}\b")
_COMPROMISE_HINTS = (
    "my otp", "my pin", "my password", "here is my", "here's my", "account number",
    "card number", "cvv", "transferred", "sent the money", "sent you the",
    "i paid", "i've paid", "made the payment", "paynow", "clicked the link",
    "i clicked", "installed the app", "gave them",
)


def _looks_compromised(text: str) -> bool:
    low = text.lower()
    if _OTP.search(text):
        return True
    return any(h in low for h in _COMPROMISE_HINTS)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def simulate_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not llm_available():
        await update.message.reply_text(
            "⚠️ Live simulation needs an LLM key. Add REKA_API_KEY (and run "
            "`pip install reka-api`) to your .env, then restart."
        )
        return
    import random

    persona = random.choice(PERSONAS)
    system = SCAMMER_SYSTEM.format(name=persona["name"], goal=persona["goal"])
    context.user_data["sim"] = {
        "system": system,
        "convo": [{"role": "assistant", "content": persona["opening"]}],
        "turns": 0,
    }
    await update.message.reply_text(
        "🎭 *Simulation started.* I'll play a scammer — reply like you would in "
        "real life. Don't share anything you wouldn't share for real.\n"
        "Type /end anytime to stop and see how you did.\n"
        "━━━━━━━━━━━━━━"
    )
    await update.message.reply_text(persona["opening"])


async def end_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    sim = context.user_data.get("sim")
    if not sim:
        await update.message.reply_text("No simulation running. Send /simulate to start one.")
        return
    context.user_data.pop("sim", None)
    await _debrief(update, sim, compromised=False)


async def sim_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle free-text replies while a simulation is active."""
    sim = context.user_data.get("sim")
    if not sim:
        return  # not in a simulation — ignore plain text
    user_msg = update.message.text
    sim["convo"].append({"role": "user", "content": user_msg})

    if _looks_compromised(user_msg):
        context.user_data.pop("sim", None)
        await _debrief(update, sim, compromised=True)
        return

    sim["turns"] += 1
    reply = await ask_llm(sim["system"], sim["convo"])
    if reply is None:
        await update.message.reply_text(
            "(the scammer went quiet — LLM unavailable). Ending here."
        )
        context.user_data.pop("sim", None)
        await _debrief(update, sim, compromised=False)
        return
    sim["convo"].append({"role": "assistant", "content": reply})
    await update.message.reply_text(reply)

    if sim["turns"] >= MAX_TURNS:
        context.user_data.pop("sim", None)
        await update.message.reply_text("━━━━━━━━━━━━━━\n(That's enough — let's review 👇)")
        await _debrief(update, sim, compromised=False)


async def _debrief(update: Update, sim: dict, compromised: bool):
    lines = []
    for m in sim["convo"]:
        who = "Scammer" if m["role"] == "assistant" else "You"
        lines.append(f"{who}: {m['content']}")
    transcript = "\n".join(lines)
    verdict_hint = (
        "The user appears to have shared sensitive info or agreed to act — treat "
        "this as 'would have been scammed'.\n\n" if compromised else ""
    )
    debrief = await ask_llm(
        COACH_SYSTEM,
        [{"role": "user", "content": verdict_hint + "Transcript:\n" + transcript}],
    )
    header = "🚨 You'd likely have been scammed." if compromised else "🧭 Debrief"
    if debrief:
        await update.message.reply_text(f"{header}\n\n{debrief}")
    else:
        await update.message.reply_text(
            f"{header}\n\nKey rule: never share OTPs/passwords, never pay or move "
            "money because someone pressured you, and verify through official "
            "channels. Send /simulate to try again."
        )


def register(app: Application) -> None:
    """Wire the simulation handlers into the bot."""
    app.add_handler(CommandHandler("simulate", simulate_cmd))
    app.add_handler(CommandHandler("end", end_cmd))
    # Plain text (not commands) drives an active simulation.
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, sim_text))
    log.info("Scam simulation ready (LLM %s).", "on" if llm_available() else "OFF")
