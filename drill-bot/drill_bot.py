"""
SafeSpace AI - Telegram Drill Bot
----------------------------------
Sends harmless drills — text messages modelled on REAL Singapore scams, plus
any real screenshots you drop into the images/ folder. The user decides Scam
or Legit; the bot then explains the tell.

  - Correct call        -> streak up, red flags explained.
  - Falls for a scam    -> bot reveals it was a drill + a review link.
  - Flags a real message -> counted as a false alarm.

No real personal data is ever requested or stored, and no scam content is
AI-generated — drills come from a curated real-scam list and your own images.

Setup:
  1. pip install -r requirements.txt
  2. Copy .env.example to .env and fill in BOT_TOKEN (from @BotFather) and APP_URL.
  3. (Optional) Drop real scam/legit screenshots into images/scam and images/legit.
  4. python drill_bot.py

Scheduled drills:
  Anyone who has ever sent /start is remembered in known_chats.json and will
  automatically receive a random drill every DRILL_INTERVAL_SECONDS (env-
  configurable, default 6 hours), starting DRILL_FIRST_DELAY seconds after
  the bot boots. No command needed from them after that first /start.
"""

import json
import logging
import os
import random
import ssl
import sys
import urllib.request
import uuid
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
)

# ---------------------------------------------------------------------------
# CONFIG - loaded from environment / .env (never hardcode your token)
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv  # optional: pip install python-dotenv

    load_dotenv()
except ImportError:
    pass

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
APP_URL = os.getenv("APP_URL", "https://your-safespace-link.example.com")

# Share of drills that arrive as an image (your own fed screenshots in images/)
# rather than a text message. 0.0 = never, 1.0 = always.
POSTER_PROBABILITY = float(os.getenv("POSTER_PROBABILITY", 0.5))

# How often the bot proactively sends a drill to everyone who has /start'd it.
DRILL_INTERVAL_SECONDS = int(os.getenv("DRILL_INTERVAL_SECONDS", 6 * 60 * 60))
DRILL_FIRST_DELAY = int(os.getenv("DRILL_FIRST_DELAY", 30))

# Weekly "trending scams" broadcast, pulled live from a public advisory feed.
TRENDING_URL = os.getenv("TRENDING_URL", "https://www.scamalert.sg/stories")
TRENDING_INTERVAL_SECONDS = int(os.getenv("TRENDING_INTERVAL_SECONDS", 7 * 24 * 60 * 60))
TRENDING_FIRST_DELAY = int(os.getenv("TRENDING_FIRST_DELAY", 60))

STATS_FILE = Path(__file__).with_name("stats.json")
CHATS_FILE = Path(__file__).with_name("known_chats.json")

# Drop your own real scam / legit screenshots in here to use them as drills:
#   images/scam/   -> pictures whose correct answer is "Scam"
#   images/legit/  -> pictures whose correct answer is "Legit"
#   images/reasons.json -> optional {"filename.png": "why it's a scam/legit"}
# Fed images look 100% real (they are real) and need no API. If this folder is
# empty, the bot falls back to the built-in rendered posters.
IMAGES_DIR = Path(__file__).with_name("images")
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
# python-telegram-bot's HTTP layer is noisy at INFO
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("drill_bot")

# ---------------------------------------------------------------------------
# Persistent stats: {user_id: {"name", "safe", "scammed", "streak", "best_streak"}}
# ---------------------------------------------------------------------------


def load_stats() -> dict:
    if STATS_FILE.exists():
        try:
            return json.loads(STATS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            log.warning("Could not read %s, starting fresh", STATS_FILE)
    return {}


def save_stats() -> None:
    try:
        STATS_FILE.write_text(
            json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8"
        )
    except OSError:
        log.exception("Could not save stats")


stats: dict = load_stats()


def load_known_chats() -> set:
    if CHATS_FILE.exists():
        try:
            return set(json.loads(CHATS_FILE.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            log.warning("Could not read %s, starting fresh", CHATS_FILE)
    return set()


def save_known_chats() -> None:
    try:
        CHATS_FILE.write_text(
            json.dumps(sorted(known_chats), indent=2), encoding="utf-8"
        )
    except OSError:
        log.exception("Could not save known chats")


# Chat IDs that have said /start at least once - the only people the bot is
# allowed to proactively message (Telegram won't let a bot message anyone
# who hasn't opened a chat with it first).
known_chats: set = load_known_chats()


def get_entry(user) -> dict:
    entry = stats.setdefault(
        str(user.id),
        {"name": user.first_name, "safe": 0, "scammed": 0, "streak": 0, "best_streak": 0},
    )
    entry["name"] = user.first_name  # keep name fresh if they change it
    entry.setdefault("false_alarm", 0)  # legit messages wrongly flagged as scams
    return entry


# ---------------------------------------------------------------------------
# Drill scenarios — modelled on REAL scams documented by the Singapore Police
# Force, ScamShield and scamalert.sg (fake links replaced with harmless
# *.example.* placeholders). Each has "is_scam": True/False; "reason" explains
# the tell and cites what the real organisation says it will never do.
# ---------------------------------------------------------------------------
SCENARIOS = [
    # ---- REAL SCAMS ----
    {
        # OCBC SMS-spoofing smishing wave (SPF/OCBC, 2021–): 790+ victims, ~$13.7m.
        "is_scam": True,
        "text": (
            "OCBC Bank: Dear Customer, an unrecognised device has accessed your "
            "account. For your security it will be frozen within 12 hours. Kindly "
            "re-verify immediately to keep it active: "
            "https://ocbc.com-verify-sg.example.net"
        ),
        "reason": (
            "Based on the real OCBC smishing wave. OCBC has stated it will NEVER "
            "SMS you a link to reactivate an account — account issues are sent by "
            "physical letter. Spoofing makes it appear under the 'OCBC' sender ID."
        ),
    },
    {
        # SingPost parcel phishing (SPF advisories 2023–2026): $1m+ lost.
        "is_scam": True,
        "text": (
            "[SingPost] Your parcel (SP83941SG) is on hold due to an invalid "
            "postal code. Kindly update your address within 24 hours or it will "
            "be returned to sender: https://singpost.redelivery-sg.example.net"
        ),
        "reason": (
            "The real SingPost parcel scam. SingPost SMSes come from the sender "
            "ID 'SingPost' and NEVER contain clickable links or ask for payment/"
            "bank details. The link leads to a page harvesting your OTP."
        ),
    },
    {
        # Government-official impersonation (scamalert.sg / SPF): the top scam type.
        "is_scam": True,
        "text": (
            "[Automated Call] This is the Monetary Authority of Singapore. Your "
            "bank account has been flagged for involvement in money laundering. "
            "To avoid immediate arrest, press 1 now to speak to our officer and "
            "transfer your funds to a secured account for verification."
        ),
        "reason": (
            "Classic government-official impersonation. Real authorities (MAS, "
            "police, IRAS) NEVER call to demand transfers to a 'safety account' "
            "or ask for banking details. No agency handles cases this way."
        ),
    },
    {
        # 'Fake friend / relative' call (scamalert.sg): "new number, send money".
        "is_scam": True,
        "text": (
            "Hi, I've changed my number, pls save this as my new contact 🙂 "
            "Are you free now? I need a small favour but I can't call, I'm in a "
            "meeting. Can you help me PayNow $800 first? I'll return it to you "
            "tonight, thanks so much!"
        ),
        "reason": (
            "The real 'fake friend/relative' scam. The tells: a 'new number', "
            "urgency, and a money request they can't discuss by call. Always "
            "verify by calling the person's known number first."
        ),
    },
    {
        # Fake lucky-draw / prize (scamalert.sg: +966 'Starhub' $50k draw).
        "is_scam": True,
        "text": (
            "CONGRATULATIONS!! 🎉 Your mobile number has been selected as a "
            "winner in the StarHub 25th Anniversary Lucky Draw — S$50,000 CASH! "
            "To claim your prize, WhatsApp our agent at +60 11-2xxx xxxx and quote "
            "reference no: SH2026-7788."
        ),
        "reason": (
            "A real reported prize scam. You can't win a draw you never entered, "
            "and no legitimate prize needs an upfront 'processing fee' or your "
            "bank details. Foreign (+xx) numbers claiming local brands are a flag."
        ),
    },
    {
        # Bulk-purchase-order / business impersonation (scamalert.sg: 'Hwa Chong').
        "is_scam": True,
        "text": (
            "Good day, I am Mr Tan, a teacher from Hwa Chong Institution. Our "
            "school is doing a bulk purchase and your company was recommended to "
            "us. Kindly help to order the items from our appointed supplier first "
            "— we will reimburse you together with the school's purchase order "
            "after delivery."
        ),
        "reason": (
            "The real bulk-purchase-order scam hitting SME suppliers. The tell: a "
            "'staff member' asks you to pay a third-party supplier upfront for "
            "reimbursement later. Verify by calling the institution directly."
        ),
    },
    {
        # Job / task scam (SPF: among top scam types by volume).
        "is_scam": True,
        "text": (
            "Hi, I'm Jamie from HR Recruitment 🌟 We are hiring part-timers! "
            "Just like & follow merchants on YouTube/Shopee from your phone. Earn "
            "$80–$300 daily, paid same day, no experience needed. Interested? Add "
            "my WhatsApp to start: wa.me/6591xxxxxx"
        ),
        "reason": (
            "The real job/task scam. 'Top up to unlock commissions' is the hook — "
            "early small payouts build trust, then larger 'top-ups' vanish. Real "
            "employers pay you and never ask you to deposit first."
        ),
    },
    {
        # Real fake GSTV voucher post (Telegram, 2026) — debunked by MOF/gov.sg.
        "is_scam": True,
        "text": (
            "📢 PSA: GST Voucher (GSTV) for Singaporeans\n\n"
            "GSTV – Cash payments of $850 up to $1,000 will be disbursed "
            "starting 14 July 2026 to help with daily living expenses.\n\n"
            "🔍 Check your eligibility and find out more at: dub.sh/gstv-claim"
        ),
        "reason": (
            "The real fake-GSTV post that circulated on Telegram. Red flags: the "
            "amount is inflated (actual GSTV–Cash is up to $850, credited Aug "
            "2026), and gov.sg NEVER sends a link to 'claim' — the 'dub.sh' link "
            "is not a government domain. As the saying goes: the Govt doesn't "
            "Telegram you. Verify only at govbenefits.gov.sg with Singpass."
        ),
    },
    # ---- CURRENTLY TRENDING (SPF / ScamShield advisories, July 2026) ----
    {
        # SPF advisory 15 Jul 2026: courier-impersonation phishing (43+ cases).
        "is_scam": True,
        "text": (
            "[J&T Express] Your parcel SG20260716 could not be delivered due to "
            "an incomplete address. Update your details within 24h to reschedule: "
            "jnt-redelivery.example.top"
        ),
        "reason": (
            "SPF's current courier-phishing wave. Real couriers don't send links "
            "asking you to 'confirm' an address and card details, and the domain "
            "isn't the official one. Track parcels only in the courier's own app."
        ),
    },
    {
        # SPF advisory 1 Jul 2026: crypto 'permit signature' wallet-drain scam.
        "is_scam": True,
        "text": (
            "🎁 Congratulations! You're eligible for a 5,000 USDT airdrop. "
            "Connect your wallet and sign to claim before it expires: "
            "usdt-airdrop-claim.example.app"
        ),
        "reason": (
            "SPF's current crypto scam. The 'signature' is a permit that pre-"
            "authorises the scammer to move funds from your wallet later. Never "
            "sign a wallet request you didn't start; unsolicited airdrops are bait."
        ),
    },
    {
        # SPF advisory 2 Jul 2026: tech-support scam (Microsoft / Crypto.com).
        "is_scam": True,
        "text": (
            "⚠️ MICROSOFT SECURITY ALERT\n\n"
            "Your PC is infected with a trojan and your data is at risk. Do NOT "
            "shut down. Call Microsoft Support now: +65 8000 0000 (Error 0x8007)."
        ),
        "reason": (
            "SPF's current tech-support scam. Microsoft and Crypto.com never put "
            "a phone number in a pop-up or ask to remote into your device. Any "
            "unsolicited 'support' contact is a scam — close the page."
        ),
    },
    {
        # Government-official impersonation via Google Meet (2026 variant).
        "is_scam": True,
        "text": (
            "This is Officer Tan from the Singapore Police Force. Your bank "
            "account is linked to a money-laundering investigation. Join this "
            "Google Meet to verify your identity, and do not tell anyone."
        ),
        "reason": (
            "The current police-impersonation variant. Real officers never "
            "investigate over Google Meet/WhatsApp, never swear you to secrecy, "
            "and never ask you to move money to a 'safety account'. Hang up and "
            "call 1799 to check."
        ),
    },
    # ---- LEGIT (should be trusted) ----
    {
        "is_scam": False,
        "text": (
            "OCBC: A login to OCBC Digital was made from a new device at 9:14pm. "
            "If this wasn't you, call the number on the back of your card. We "
            "will never ask for your PIN, OTP or password."
        ),
        "reason": (
            "How a genuine bank alert reads: it asks for NOTHING, tells you to "
            "use the number on your card (not a link), and states it will never "
            "request your PIN/OTP. Matches OCBC's real security guidance. Safe."
        ),
    },
    {
        "is_scam": False,
        "text": (
            "SingPost: Your parcel SG123456789SG is out for delivery today, "
            "arriving 2–6pm. No action required. Track it in the SingPost app."
        ),
        "reason": (
            "A real SingPost update: it comes with no clickable link, asks for no "
            "payment or details, and points to the official app — exactly what "
            "SingPost says its genuine messages look like. Safe."
        ),
    },
    {
        "is_scam": False,
        "text": (
            "Reminder from your dentist: appointment on Fri 24 Jul at 3:30pm. "
            "Reply Y to confirm or call 6123 4567 to reschedule."
        ),
        "reason": (
            "An ordinary appointment reminder — no money, no credentials, a "
            "normal callback number. Safe, legitimate message."
        ),
    },
    {
        "is_scam": False,
        "text": (
            "gov.sg: GST Voucher 2026 has been credited to eligible Singaporeans. "
            "Check your eligibility at the official portal go.gov.sg/gstv using "
            "Singpass. We never ask for your bank OTP."
        ),
        "reason": (
            "A genuine government payout notice: an official gov.sg address, "
            "Singpass login, automatic credit, no urgency and no OTP request. Safe."
        ),
    },
]

# Live drills awaiting an answer: {drill_id: {"is_scam", "reason"}}. Fed-image
# drills aren't in SCENARIOS, so their verdict + reason are kept here and the
# short id rides along in the callback data (capped at 64 bytes by Telegram).
active_drills: dict = {}
MAX_ACTIVE_DRILLS = 500


def register_drill(scenario: dict) -> tuple:
    """Store the scenario's verdict + reason under a short id and build the
    Scam/Legit keyboard. Returns (drill_id, keyboard)."""
    drill_id = uuid.uuid4().hex[:8]
    active_drills[drill_id] = {
        "is_scam": bool(scenario.get("is_scam", True)),
        "reason": scenario["reason"],
    }
    while len(active_drills) > MAX_ACTIVE_DRILLS:
        active_drills.pop(next(iter(active_drills)))
    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🚩 Scam", callback_data=f"scam:{drill_id}"),
             InlineKeyboardButton("✅ Legit", callback_data=f"legit:{drill_id}")],
        ]
    )
    return drill_id, keyboard


def get_scenario() -> dict:
    """Pick a random real-scam / legit text drill."""
    scenario = random.choice(SCENARIOS)
    scenario.setdefault("is_scam", True)
    return scenario


# ---------------------------------------------------------------------------
# Image drills — sourced ONLY from your own real screenshots in images/
# (images/scam/ and images/legit/). No generated posters.
# ---------------------------------------------------------------------------
DEFAULT_SCAM_REASON = (
    "This was a simulated scam. Tell-tale signs: urgency/countdowns, requests "
    "for personal, bank or OTP details, and lookalike links or unknown senders."
)
DEFAULT_LEGIT_REASON = (
    "This one was legitimate: no pressure, no request for sensitive details, "
    "and it comes from an official source (e.g. a real .gov.sg site or app)."
)


def _load_image_reasons() -> dict:
    f = IMAGES_DIR / "reasons.json"
    if f.exists():
        try:
            return json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            log.warning("Could not read %s — ignoring it", f)
    return {}


def list_user_images() -> list:
    """Scan images/scam and images/legit for user-supplied pictures. Returns
    a list of {path, is_scam, reason}. Empty if the folder isn't set up."""
    reasons = _load_image_reasons()
    items = []
    for sub, is_scam in (("scam", True), ("legit", False)):
        d = IMAGES_DIR / sub
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() not in IMAGE_EXTS:
                continue
            try:
                if not p.is_file() or p.stat().st_size == 0:
                    continue  # skip empty/placeholder files
            except OSError:
                continue
            reason = (
                reasons.get(p.name)
                or reasons.get(f"{sub}/{p.name}")
                or (DEFAULT_SCAM_REASON if is_scam else DEFAULT_LEGIT_REASON)
            )
            items.append({"path": p, "is_scam": is_scam, "reason": reason})
    return items


def posters_available() -> bool:
    """True if there are fed real screenshots to send as image drills."""
    return bool(list_user_images())


async def generate_poster() -> dict | None:
    """Return an image drill from the user's own fed screenshots (images/
    folder), or None if none are available. {image: bytes, is_scam, reason}."""
    fed = list_user_images()
    if not fed:
        return None
    choice = random.choice(fed)
    try:
        return {
            "image": choice["path"].read_bytes(),
            "is_scam": choice["is_scam"],
            "reason": choice["reason"],
        }
    except OSError:
        log.warning("Could not read fed image %s", choice["path"], exc_info=True)
        return None


# ---------------------------------------------------------------------------
# Trending scams — pulled live from a public advisory feed (e.g. scamalert.sg)
# ---------------------------------------------------------------------------
# If the live feed can't be reached or parsed, we still send CONCRETE, real
# recent examples (documented by SPF / scamalert.sg). A random handful is shown
# each time so the alert isn't repetitive.
FALLBACK_TRENDING = [
    "Bank “account frozen / verify now” SMS (OCBC, DBS, UOB lookalikes)",
    "Parcel “update your address” phishing (SingPost, J&T, DHL)",
    "Police / MAS impersonation — “your account is in a money-laundering case”",
    "Fake friend / family — “I changed my number, PayNow me first”",
    "“You’ve won” lucky-draw prizes (StarHub, Singtel, Shopee)",
    "Job “like & earn” task scams — top up to unlock commissions",
    "Fake GST Voucher / govt-payout posts with a “claim” link",
    "Crypto “airdrop — sign to claim” wallet-drain scams",
    "Fake tech-support pop-ups — Microsoft / Crypto.com “virus” warning",
    "Investment groups promising guaranteed daily returns",
]


class _StoryExtractor(HTMLParser):
    """Collect visible text segments so we can surface scam story headlines."""

    def __init__(self):
        super().__init__()
        self._skip = 0
        self.segments = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "nav", "footer", "header"):
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style", "nav", "footer", "header") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if self._skip:
            return
        text = " ".join(data.split())
        if text:
            self.segments.append(text)


_STORY_STOPWORDS = (
    "read more", "scam stories", "home", "login", "sign", "menu", "search",
    "share", "report", "about", "contact", "subscribe", "cookie", "privacy",
    "terms", "follow", "next", "previous", "all rights",
)


def fetch_trending_scams(limit: int = 5) -> list:
    """Fetch and return up to `limit` current scam headlines from TRENDING_URL.
    Falls back to FALLBACK_TRENDING on any network/parse failure."""
    # Full browser-like headers — the site's WAF returns 404 to bare requests.
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": (
            "text/html,application/xhtml+xml,application/xml;q=0.9,"
            "image/avif,image/webp,*/*;q=0.8"
        ),
        "Accept-Language": "en-SG,en;q=0.9",
        "Referer": "https://www.scamalert.sg/",
        "Connection": "close",
    }
    try:
        req = urllib.request.Request(TRENDING_URL, headers=headers)
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            html = r.read().decode("utf-8", "ignore")
        parser = _StoryExtractor()
        parser.feed(html)
        seen, headlines = set(), []
        for seg in parser.segments:
            low = seg.lower()
            if not (15 <= len(seg) <= 140) or " " not in seg:
                continue
            if any(w in low for w in _STORY_STOPWORDS):
                continue
            if low in seen:
                continue
            seen.add(low)
            headlines.append(seg)
            if len(headlines) >= limit:
                break
        if headlines:
            log.info("Fetched %d live trending scam headlines", len(headlines))
            return headlines
        log.warning("Trending feed parsed but yielded no headlines — using fallback")
    except Exception as e:
        # Concise one-line log (no stack trace); fall back to curated examples.
        log.warning("Live trending fetch failed (%s) — using curated examples", e)
    # Show a fresh random handful of concrete real examples each time.
    return random.sample(FALLBACK_TRENDING, min(limit, len(FALLBACK_TRENDING)))


# Map keywords in a trending headline to a drill that replicates that pattern.
# (headline trigger keywords, unique phrases identifying the matching drill).
# Target phrases are chosen to appear in exactly one scenario for precise mapping.
_THEME_KEYWORDS = [
    (("impersonat", "official", "police", "govern", "iras", "cpf", "mas",
      "ocbc", "dbs", "uob", "bank", "laundering", "arrest", "google meet"),
     ("has been frozen", "money laundering", "safety account", "google meet")),
    (("won", "win", "lucky", "prize", "gift", "draw", "reward"),
     ("you've won", "lucky draw")),
    (("friend", "relative", "cousin", "family", "mum", "mother", "kidnap", "son"),
     ("changed my number", "lost my phone")),
    (("job", "task", "part-time", "commission", "recruit", "hiring"),
     ("app-rating", "top up to unlock")),
    (("gstv", "gst voucher", "voucher", "payout", "cdc", "cost of living",
      "handout", "rebate"),
     ("gst voucher", "gstv", "dub.sh")),
    (("bulk", "supplier", "purchase order", "quotation", "business order"),
     ("hwa chong", "appointed supplier", "quotation")),
    (("parcel", "delivery", "package", "courier", "shipment", "j&t", "jnt"),
     ("could not be delivered", "singpost", "reschedule")),
    # Tech-support BEFORE crypto: a tech-support line may mention "Crypto.com".
    (("tech support", "technical support", "microsoft", "crypto.com",
      "virus", "trojan", "malware", "pop-up", "pop up"),
     ("microsoft security alert", "trojan")),
    (("crypto ", "bitcoin", "usdt", "airdrop", "wallet", "permit", "web3", "token"),
     ("usdt airdrop", "connect your wallet")),
]


def pick_drill_for_theme(headline: str) -> dict:
    """Return a scam scenario that best matches a trending headline, so the
    follow-up drill replicates the scam users were just warned about."""
    scams = [s for s in SCENARIOS if s.get("is_scam")]
    low = headline.lower()
    for triggers, targets in _THEME_KEYWORDS:
        if any(t in low for t in triggers):
            matches = [s for s in scams if any(t in s["text"].lower() for t in targets)]
            if matches:
                return random.choice(matches)
    return random.choice(scams)


def trending_real_scams(n: int = 3) -> list:
    """Map the current trending headlines to their ACTUAL scam messages, so the
    alert shows the real thing (deduped). Returns up to n scenario dicts."""
    picked, seen = [], set()
    for h in fetch_trending_scams(limit=8):
        s = pick_drill_for_theme(h)
        key = s["text"][:50]
        if key not in seen:
            seen.add(key)
            picked.append(s)
        if len(picked) >= n:
            break
    return picked


def format_trending_scams(scams: list) -> str:
    """Build the alert text: real scam messages, each with its tell."""
    parts = [
        "🚨 Scam messages going around Singapore right now",
        "(these are simulated copies for practice — the links are fake, "
        "never tap them)",
    ]
    for s in scams:
        parts.append("━━━━━━━━━━━━━━")
        parts.append(s["text"])
        parts.append(f"🔎 {s['reason']}")
    return "\n\n".join(parts)


def scam_images(limit: int = 2) -> list:
    """Up to `limit` real fed scam screenshots (bytes) for the trending alert."""
    imgs = [i for i in list_user_images() if i["is_scam"]]
    random.shuffle(imgs)
    out = []
    for i in imgs[:limit]:
        try:
            out.append(i["path"].read_bytes())
        except OSError:
            continue
    return out


def trending_drill_scenario(shown: list) -> dict:
    """Pick a scam to quiz that ISN'T one of the ones already shown."""
    scams = [s for s in SCENARIOS if s.get("is_scam")]
    shown_texts = {s["text"] for s in shown}
    pool = [s for s in scams if s["text"] not in shown_texts] or scams
    return random.choice(pool)


async def send_trending_alert(context: ContextTypes.DEFAULT_TYPE):
    """Broadcast this week's trending scams to everyone, then a matching drill."""
    if not known_chats:
        return
    scams = trending_real_scams(3)
    if not scams:
        return
    alert = format_trending_scams(scams)
    tip = (
        "🛡 Rule of thumb: no real bank, agency or boss rushes you to pay, share "
        "an OTP, or move money. Pause and check.\n\n"
        "👇 Now try one yourself — is this a scam?"
    )
    images = scam_images(2)
    drill = trending_drill_scenario(scams)
    drill.setdefault("is_scam", True)
    _, keyboard = register_drill(drill)

    for chat_id in list(known_chats):
        try:
            await context.bot.send_message(chat_id=chat_id, text=alert)
            for img in images:
                await context.bot.send_photo(
                    chat_id=chat_id, photo=BytesIO(img),
                    caption="📸 A real scam screenshot circulating now.",
                )
            await context.bot.send_message(chat_id=chat_id, text=tip)
            await context.bot.send_message(
                chat_id=chat_id, text=drill["text"], reply_markup=keyboard
            )
        except Exception:
            log.warning("Could not send trending alert to %s", chat_id, exc_info=True)
            known_chats.discard(chat_id)
            save_known_chats()


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


WELCOME_TEXT = (
    "👋 Welcome to SafeSpace Drill Mode!\n\n"
    "I'll send you realistic (but harmless) messages and posters — some are "
    "scams, some are perfectly genuine. Your job: tell them apart. Nothing "
    "here is real, and I never ask for real personal info. Use the commands "
    "below whenever you want to practice.\n\n"
    "Commands:\n"
    "/drill - get a random drill right now\n"
    "/simulate - live scam role-play (I play the scammer)\n"
    "/trending - this week's real trending scams\n"
    "/stats - see your accuracy and streak\n"
    "/leaderboard - see who's sharpest\n"
    "/help - how it works"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id not in known_chats:
        known_chats.add(chat_id)
        save_known_chats()
    await update.message.reply_text(WELCOME_TEXT)


async def send_welcome_on_startup(context: ContextTypes.DEFAULT_TYPE):
    """Fired once shortly after the bot boots — sends the welcome message to
    everyone who has started the bot before (Telegram won't let a bot message
    anyone who hasn't opened a chat with it first)."""
    for chat_id in list(known_chats):
        try:
            await context.bot.send_message(chat_id=chat_id, text=WELCOME_TEXT)
        except Exception:
            log.warning("Could not send welcome to %s, dropping", chat_id, exc_info=True)
            known_chats.discard(chat_id)
            save_known_chats()


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🛡 How Drill Mode works:\n\n"
        "1. Send /drill and I'll show you a message or poster — it might be a "
        "scam, or it might be genuine.\n"
        "2. Decide: tap 🚩 Scam or ✅ Legit.\n"
        "3. I'll tell you if you're right and explain the tell-tale signs.\n\n"
        "Watch both ways: missing a scam is costly, but flagging a real message "
        "(a false alarm) counts against you too. Everything is simulated — no "
        "real links, payments or data."
    )


def want_poster() -> bool:
    """Decide whether this drill should be an image (fed screenshot or render)."""
    return posters_available() and random.random() < POSTER_PROBABILITY


async def drill(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if want_poster():
        poster = await generate_poster()
        if poster:
            _, keyboard = register_drill(poster)
            await update.message.reply_photo(
                photo=BytesIO(poster["image"]),
                caption="📢 Scam or legit? Decide below.",
                reply_markup=keyboard,
            )
            return
    # text drill (also the fallback if no fed images exist)
    scenario = get_scenario()
    _, keyboard = register_drill(scenario)
    await update.message.reply_text(scenario["text"], reply_markup=keyboard)


async def send_scheduled_drill(context: ContextTypes.DEFAULT_TYPE):
    """Fired automatically by the JobQueue - pushes a drill to every chat
    that has ever said /start, with no command needed from them. One drill
    is generated per run and shared across all chats (one set of API calls)."""
    if not known_chats:
        return

    poster = await generate_poster() if want_poster() else None
    if poster:
        drill_id, keyboard = register_drill(poster)
        image_bytes = poster["image"]
    else:
        scenario = get_scenario()
        drill_id, keyboard = register_drill(scenario)

    for chat_id in list(known_chats):
        try:
            if poster:
                await context.bot.send_photo(
                    chat_id=chat_id,
                    photo=BytesIO(image_bytes),
                    caption="📢 Scam or legit? Decide below.",
                    reply_markup=keyboard,
                )
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=scenario["text"],
                    reply_markup=keyboard,
                )
        except Exception:
            log.warning("Could not message chat %s, dropping from known_chats", chat_id, exc_info=True)
            known_chats.discard(chat_id)
            save_known_chats()


async def button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    try:
        action, drill_id = query.data.split(":")
        info = active_drills[drill_id]
        is_scam = info["is_scam"]
        reason = info["reason"]
    except (ValueError, KeyError):
        # Unknown id: bot restarted since the drill was sent, or the entry
        # was evicted. (Also catches old "report:"/"fall:" callbacks.)
        await query.edit_message_text("⚠️ This drill expired — send /drill for a new one.")
        return

    entry = get_entry(query.from_user)

    # Poster drills are photos (caption, no text); text drills have .text.
    is_photo = bool(query.message.photo)
    original = query.message.caption if is_photo else query.message.text
    said_scam = action == "scam"
    correct = said_scam == is_scam

    streak_line = (
        f"\n\n🔥 Safe streak: {entry['streak']}"
        + (f" (best: {entry['best_streak']})" if entry["best_streak"] > entry["streak"] else "")
    )

    if correct:
        entry["safe"] += 1
        entry["streak"] += 1
        entry["best_streak"] = max(entry["best_streak"], entry["streak"])
        if is_scam:
            verdict = "✅ CORRECT — this was a SIMULATED scam (nothing real)."
        else:
            verdict = "✅ CORRECT — this one was genuinely safe."
        result = f"{original}\n\n{verdict}\n{reason}{streak_line}"
        show_app = False
    elif is_scam:
        # Missed a scam — the costly mistake.
        entry["scammed"] += 1
        entry["streak"] = 0
        result = (
            f"{original}\n\n"
            f"⚠️ You'd have been SCAMMED. This was a simulated scam — nothing "
            f"was sent anywhere. Here's what gave it away:\n{reason}"
        )
        show_app = True
    else:
        # False alarm — flagged a legitimate message.
        entry["false_alarm"] += 1
        entry["streak"] = 0
        result = (
            f"{original}\n\n"
            f"🟡 FALSE ALARM — this one was actually legitimate.\n{reason}\n\n"
            f"Flagging everything means missing real messages too — the goal is "
            f"telling them apart."
        )
        show_app = False

    if is_photo:
        await query.edit_message_caption(caption=result)
    else:
        await query.edit_message_text(result)

    if show_app:
        await query.message.reply_text(
            "Tap below to review this drill in the SafeSpace app:",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("Open SafeSpace to review", url=APP_URL)]]
            ),
        )

    save_stats()


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    entry = stats.get(str(update.effective_user.id))
    if not entry:
        await update.message.reply_text("No drills yet — send /drill to start!")
        return
    false_alarm = entry.get("false_alarm", 0)
    total = entry["safe"] + entry["scammed"] + false_alarm
    accuracy = round(100 * entry["safe"] / total) if total else 0
    await update.message.reply_text(
        f"📊 Your drill record:\n"
        f"✅ Correct: {entry['safe']}\n"
        f"⚠️ Scammed (missed a scam): {entry['scammed']}\n"
        f"🟡 False alarms (flagged a real one): {false_alarm}\n"
        f"🎯 Accuracy: {accuracy}%\n"
        f"🔥 Best streak: {entry['best_streak']}"
    )


async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not stats:
        await update.message.reply_text("No drills run yet. Try /drill first!")
        return

    fame = sorted(stats.values(), key=lambda e: e["safe"], reverse=True)[:5]
    shame = sorted(stats.values(), key=lambda e: e["scammed"], reverse=True)[:5]

    fame_lines = "\n".join(
        f"{i + 1}. {e['name']} — {e['safe']} safe" for i, e in enumerate(fame)
    )
    shame_lines = "\n".join(
        f"{i + 1}. {e['name']} — {e['scammed']} scammed" for i, e in enumerate(shame)
    )

    await update.message.reply_text(
        f"🏆 HALL OF FAME\n{fame_lines}\n\n💀 HALL OF SHAME\n{shame_lines}"
    )


async def trending_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """On-demand: show the actual trending scam messages (+ images). No drill."""
    scams = trending_real_scams(3)
    if not scams:
        await update.message.reply_text("Couldn't load trending scams right now — try again shortly.")
        return
    await update.message.reply_text(format_trending_scams(scams))
    for img in scam_images(2):
        await update.message.reply_photo(
            photo=BytesIO(img),
            caption="📸 A real scam screenshot circulating now.",
        )


async def on_error(update: object, context: ContextTypes.DEFAULT_TYPE):
    log.error("Update caused an error", exc_info=context.error)


def main():
    if not BOT_TOKEN:
        sys.exit(
            "BOT_TOKEN is not set.\n"
            "Copy .env.example to .env and paste the token from @BotFather, "
            "or run:  BOT_TOKEN=123:abc python drill_bot.py"
        )

    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("drill", drill))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CommandHandler("leaderboard", leaderboard))
    app.add_handler(CommandHandler("trending", trending_cmd))
    app.add_handler(CallbackQueryHandler(button))

    # Live LLM-powered scam simulation (/simulate, /end). Optional — only active
    # if a REKA_API_KEY (or OpenAI key) is set. Registered in its own module.
    try:
        import scam_sim

        scam_sim.register(app)
    except Exception:
        log.warning("Could not load scam simulation module", exc_info=True)

    app.add_error_handler(on_error)

    # On startup, send the welcome message once to everyone who has started the
    # bot before. Otherwise the bot is command-driven — nothing else is auto-
    # pushed. (To re-enable automatic drills or a weekly trending broadcast, add
    # app.job_queue.run_repeating(...) for send_scheduled_drill / send_trending_alert.)
    app.job_queue.run_once(send_welcome_on_startup, when=3)

    fed = list_user_images()
    if fed:
        n_scam = sum(1 for f in fed if f["is_scam"])
        log.info(
            "Using %d fed image(s) from images/ (%d scam, %d legit), prob %.2f",
            len(fed), n_scam, len(fed) - n_scam, POSTER_PROBABILITY,
        )
    else:
        log.info(
            "No fed images yet — sending text drills only. Drop real screenshots "
            "in images/scam and images/legit to add picture drills."
        )

    log.info("SafeSpace Drill Bot is running — press Ctrl+C to stop")
    app.run_polling()


if __name__ == "__main__":
    main()
# end of drill_bot.py
