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
AI-generated — drills come from content/drills.json (modelled on real Singapore
scams, with fictional organisation names) and your own images.

Setup:
  1. pip install -r requirements.txt
  2. Copy .env.example to .env and fill in BOT_TOKEN (from @BotFather) and APP_URL.
  3. (Optional) Drop real scam/legit screenshots into images/scam and images/legit.
  4. python drill_bot.py

Scheduled broadcasts (off by default):
  Anyone who sends /start is remembered in known_chats.json. Set
  ENABLE_SCHEDULED_DRILLS=1 to push a random drill to all of them every
  DRILL_INTERVAL_SECONDS (default 6 hours), and ENABLE_TRENDING_ALERTS=1 for
  the weekly trending-scams broadcast. The last run time is saved, so a
  restart never triggers an extra broadcast.

Running on a cloud server: see DEPLOY_BOT.md. Set BOT_DATA_DIR so stats and
chat lists live outside the code folder and survive updates. The bot is safe
to restart at any time: each chat is welcomed once, ever, and Scam/Legit
buttons keep working across restarts.
"""

import asyncio
import json
import logging
import os
import random
import re
import ssl
import sys
import time
import urllib.request
import uuid
from html import escape
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.error import BadRequest, Forbidden
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



def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Automatic broadcasts. Off unless switched on in .env.
ENABLE_SCHEDULED_DRILLS = _env_flag("ENABLE_SCHEDULED_DRILLS")
ENABLE_TRENDING_ALERTS = _env_flag("ENABLE_TRENDING_ALERTS")
# On boot, greet anyone who /start'ed but never got the welcome. Each chat is
# greeted at most once, ever, so restarts and redeploys never re-send it.
WELCOME_ON_STARTUP = _env_flag("WELCOME_ON_STARTUP", default=True)
# Pause between chats when broadcasting, to stay under Telegram's ~30 msg/s limit.
BROADCAST_PAUSE_SECONDS = float(os.getenv("BROADCAST_PAUSE_SECONDS", 0.05))

# Where the bot keeps its state. Defaults to this folder (handy on a laptop);
# on a server point it somewhere outside the code, e.g. /var/lib/safespace-bot,
# so `git pull` never touches it and it is easy to back up.
DATA_DIR = Path(os.getenv("BOT_DATA_DIR") or Path(__file__).resolve().parent)
DATA_DIR.mkdir(parents=True, exist_ok=True)
STATS_FILE = DATA_DIR / "stats.json"
CHATS_FILE = DATA_DIR / "known_chats.json"
WELCOMED_FILE = DATA_DIR / "welcomed_chats.json"
DRILLS_FILE = DATA_DIR / "active_drills.json"
SCHEDULE_FILE = DATA_DIR / "schedule.json"

# Scam intelligence (SPF bulletins) read from the SafeSpace Supabase project.
# Optional: without SUPABASE_URL/SUPABASE_KEY the bot behaves exactly as before.
import scam_intel  # noqa: E402  (imported after .env is loaded)

scam_intel.configure(DATA_DIR)

# Drop your own real scam / legit screenshots in here to use them as drills:
#   images/scam/   -> pictures whose correct answer is "Scam"
#   images/legit/  -> pictures whose correct answer is "Legit"
#   images/reasons.json -> optional {"filename.png": "why it's a scam/legit"}
# Fed images look 100% real (they are real) and need no API. If this folder is
# empty, the bot falls back to the built-in rendered posters.
IMAGES_DIR = Path(os.getenv("BOT_IMAGES_DIR") or Path(__file__).with_name("images"))
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


def _write_json_atomic(path: Path, data) -> None:
    """Write to a temp file, then rename over the real one. If the bot is
    stopped or crashes mid-write, the old file stays intact instead of being
    left half-written and unreadable."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def _read_json(path: Path, default):
    """Return the parsed file, `default` if it doesn't exist, or None if it
    exists but can't be read (so callers can choose a safe fallback)."""
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        log.warning("Could not read %s", path)
        return None


def load_stats() -> dict:
    if STATS_FILE.exists():
        try:
            return json.loads(STATS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            log.warning("Could not read %s, starting fresh", STATS_FILE)
    return {}


def save_stats() -> None:
    try:
        _write_json_atomic(STATS_FILE, stats)
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
        _write_json_atomic(CHATS_FILE, sorted(known_chats))
    except OSError:
        log.exception("Could not save known chats")


# Chat IDs that have said /start at least once - the only people the bot is
# allowed to proactively message (Telegram won't let a bot message anyone
# who hasn't opened a chat with it first).
known_chats: set = load_known_chats()


def load_welcomed_chats() -> set:
    data = _read_json(WELCOMED_FILE, [])
    if data is None:
        # Unreadable: assume everyone was already greeted rather than risk
        # messaging every user again.
        return set(known_chats)
    return set(data)


def save_welcomed_chats() -> None:
    try:
        _write_json_atomic(WELCOMED_FILE, sorted(welcomed_chats))
    except OSError:
        log.exception("Could not save welcomed chats")


# Chats that have already received WELCOME_TEXT.
welcomed_chats: set = load_welcomed_chats()


def load_schedule() -> dict:
    data = _read_json(SCHEDULE_FILE, {})
    return data if isinstance(data, dict) else {}


# {"job name": unix time of last run} for the automatic broadcasts.
schedule: dict = load_schedule()


def mark_job_ran(name: str) -> None:
    schedule[name] = time.time()
    try:
        _write_json_atomic(SCHEDULE_FILE, schedule)
    except OSError:
        log.exception("Could not save schedule")


def first_run_delay(name: str, interval: float, default_first: float) -> float:
    """Seconds until a repeating job should next fire, counted from its last
    real run, so restarting the bot doesn't trigger an extra broadcast."""
    last = schedule.get(name)
    if last is None:
        return default_first
    return max(60.0, last + interval - time.time())


def drop_chat_if_gone(chat_id, exc: Exception) -> None:
    """Forget a chat only if Telegram says it is gone for good (user blocked
    the bot or deleted the chat). Network blips and rate limits keep it."""
    gone = isinstance(exc, Forbidden) or (
        isinstance(exc, BadRequest) and "chat not found" in str(exc).lower()
    )
    if gone:
        log.info("Chat %s blocked the bot or no longer exists, dropping it", chat_id)
        known_chats.discard(chat_id)
        save_known_chats()
    else:
        log.warning("Could not message chat %s, will try again next time: %s", chat_id, exc)


def get_entry(user) -> dict:
    entry = stats.setdefault(
        str(user.id),
        {"name": user.first_name, "safe": 0, "scammed": 0, "streak": 0, "best_streak": 0},
    )
    entry["name"] = user.first_name  # keep name fresh if they change it
    entry.setdefault("false_alarm", 0)  # legit messages wrongly flagged as scams
    return entry


# ---------------------------------------------------------------------------
# Drill content lives in content/drills.json - edit it there, not here. Drills
# are modelled on real Singapore scams, but every organisation in them is
# FICTIONAL (run check_content.py after editing). Links are .example placeholders.
# ---------------------------------------------------------------------------
CONTENT_FILE = Path(
    os.getenv("BOT_CONTENT_FILE") or Path(__file__).with_name("content") / "drills.json"
)


def load_drill_content(path: Path) -> dict:
    """Read and sanity-check drills.json. Exits with a clear message if broken."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        sys.exit(f"Could not read drill content from {path}: {e}")
    scenarios = data.get("scenarios") if isinstance(data, dict) else None
    if not isinstance(scenarios, list) or not scenarios:
        sys.exit(f"{path} needs a non-empty 'scenarios' list")
    for i, s in enumerate(scenarios, 1):
        if not (
            isinstance(s, dict)
            and isinstance(s.get("is_scam"), bool)
            and str(s.get("text", "")).strip()
            and str(s.get("reason", "")).strip()
        ):
            sys.exit(f"{path}: scenario {i} needs is_scam (true/false), text and reason")
    if not any(s["is_scam"] for s in scenarios):
        sys.exit(f"{path}: add at least one scenario with is_scam: true")
    return data


_CONTENT = load_drill_content(CONTENT_FILE)
SCENARIOS = _CONTENT["scenarios"]
# Ordered (theme, keywords): the first theme whose keyword appears in a trending
# headline picks the follow-up drill.
THEME_KEYWORDS = [
    (theme, tuple(k.lower() for k in keywords))
    for theme, keywords in _CONTENT.get("theme_keywords", [])
]
# Heading above each practice example in /trending.
THEME_LABELS = _CONTENT.get("theme_labels") or {}
# Used only to choose drills when Supabase and the live feed are unavailable.
FALLBACK_TRENDING = _CONTENT.get("trending_fallback") or [
    s["text"][:80] for s in SCENARIOS if s["is_scam"]
]
scam_intel.set_generic_names(_CONTENT.get("generic_names", []))

# ---------------------------------------------------------------------------
# Message formatting. Every message the bot writes uses Telegram HTML, and any
# text from content files, Supabase or users goes through h() first.
# ---------------------------------------------------------------------------
HTML = ParseMode.HTML


def h(text) -> str:
    """Escape text for Telegram HTML."""
    return escape(str(text or ""), quote=False)


def format_drill(text: str, header: str = "📩 <b>New message</b>",
                 footer: str = "<i>Scam or legit? Tap a button below.</i>") -> str:
    """A drill shown as a quoted incoming message."""
    parts = [header, f"<blockquote>{h(text)}</blockquote>"]
    if footer:
        parts.append(footer)
    return "\n".join(parts)


DRILL_PHOTO_CAPTION = "📢 <b>Scam or legit?</b> Tap a button below."


def short_tip(scenario: dict) -> str:
    """One-line takeaway for a drill: its 'tip', else the reason's first sentence."""
    tip = str(scenario.get("tip") or "").strip()
    if tip:
        return tip
    reason = " ".join(str(scenario.get("reason", "")).split())
    return re.split(r"(?<=[.!?])\s+", reason)[0]


# Live drills awaiting an answer: {drill_id: {"is_scam", "reason"}}. Fed-image
# drills aren't in SCENARIOS, so their verdict + reason are kept here and the
# short id rides along in the callback data (capped at 64 bytes by Telegram).
# Saved to disk so buttons on drills sent before a restart still work.
MAX_ACTIVE_DRILLS = int(os.getenv("MAX_ACTIVE_DRILLS", 2000))


def load_active_drills() -> dict:
    data = _read_json(DRILLS_FILE, {})
    return data if isinstance(data, dict) else {}


def save_active_drills() -> None:
    try:
        _write_json_atomic(DRILLS_FILE, active_drills)
    except OSError:
        log.exception("Could not save active drills")


active_drills: dict = load_active_drills()


def register_drill(scenario: dict) -> tuple:
    """Store the scenario's verdict + reason under a short id and build the
    Scam/Legit keyboard. Returns (drill_id, keyboard)."""
    drill_id = uuid.uuid4().hex[:8]
    active_drills[drill_id] = {
        "is_scam": bool(scenario.get("is_scam", True)),
        "reason": scenario["reason"],
        "text": scenario.get("text"),  # None for image drills
    }
    while len(active_drills) > MAX_ACTIVE_DRILLS:
        active_drills.pop(next(iter(active_drills)))
    save_active_drills()
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
    "and it points you to an official website or app you can check yourself."
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
# If the live feed can't be reached or parsed, FALLBACK_TRENDING (from
# content/drills.json) is used to choose which drills to show.


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


def pick_drill_for_theme(headline: str) -> dict:
    """Return a scam scenario that best matches a trending headline, so the
    follow-up drill replicates the scam users were just warned about."""
    scams = [s for s in SCENARIOS if s.get("is_scam")]
    low = f" {headline.lower()} "
    for theme, keywords in THEME_KEYWORDS:
        if any(k in low for k in keywords):
            matches = [s for s in scams if s.get("theme") == theme]
            if matches:
                return random.choice(matches)
    return random.choice(scams)


def trending_real_scams(n: int = 3) -> list:
    """Map the current trending headlines to their ACTUAL scam messages, so the
    alert shows the real thing (deduped). Returns up to n scenario dicts."""
    picked, seen = [], set()
    # Prefer what the latest official SPF bulletin (from Supabase) warns about;
    # top up from the scamalert.sg headlines if the bulletin has too few scams.
    headlines = scam_intel.trending_headlines()
    if len(headlines) < n:
        headlines += fetch_trending_scams(limit=8)
    for h in headlines:
        s = pick_drill_for_theme(h)
        key = s["text"][:50]
        if key not in seen:
            seen.add(key)
            picked.append(s)
        if len(picked) >= n:
            break
    return picked


def bulletin_summary() -> str | None:
    """'What the latest SPF Scam Bulletin warns about', or None without data."""
    b = scam_intel.latest_bulletin()
    return scam_intel.format_bulletin_summary(b) if b else None


def format_trending_scams(scams: list) -> str:
    """Practice copies of the scams going around, each with a one-line tip (HTML)."""
    parts = [
        "🎯 <b>What these scams look like</b>\n"
        "<i>Practice copies. The links are fake, so don't tap them.</i>"
    ]
    for i, s in enumerate(scams, 1):
        label = THEME_LABELS.get(s.get("theme"), "Example")
        parts.append(f"<b>{i}. {h(label)}</b>\n<blockquote>{h(s['text'])}</blockquote>\n🔎 {h(short_tip(s))}")
    parts.append(
        "🛡 <i>Rule of thumb: no real bank, agency or boss rushes you to pay, "
        "share an OTP or move money. Pause and check.</i>"
    )
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
    mark_job_ran("trending_alert")
    if not known_chats:
        return
    summary = await asyncio.to_thread(bulletin_summary)
    scams = await asyncio.to_thread(trending_real_scams, 3)
    if not scams:
        return
    alert = format_trending_scams(scams)
    images = scam_images(2)
    drill = trending_drill_scenario(scams)
    drill.setdefault("is_scam", True)
    _, keyboard = register_drill(drill)

    for chat_id in list(known_chats):
        try:
            if summary:
                await context.bot.send_message(chat_id=chat_id, text=summary, parse_mode=HTML)
            await context.bot.send_message(chat_id=chat_id, text=alert, parse_mode=HTML)
            for img in images:
                await context.bot.send_photo(
                    chat_id=chat_id, photo=BytesIO(img), caption="📸 Example scam screenshot",
                )
            await context.bot.send_message(
                chat_id=chat_id,
                text=format_drill(drill["text"], header="🧪 <b>Your turn: scam or legit?</b>",
                                  footer=""),
                parse_mode=HTML, reply_markup=keyboard,
            )
        except Exception as exc:
            drop_chat_if_gone(chat_id, exc)
        await asyncio.sleep(BROADCAST_PAUSE_SECONDS)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


WELCOME_TEXT = (
    "👋 <b>Welcome to SafeSpace Drill Mode!</b>\n\n"
    "I'll send you realistic but harmless messages. Some are scams, some are "
    "genuine, and your job is to tell them apart. Nothing here is real, and I'll "
    "never ask for your personal info.\n\n"
    "<b>Practise</b>\n"
    "/drill · Scam or legit?\n"
    "/simulate · Chat with a pretend scammer (/end to stop)\n\n"
    "<b>Learn</b>\n"
    "/trending · Scams going around now\n"
    "/learn · How a real scam works\n\n"
    "<b>Your progress</b>\n"
    "/stats · Your accuracy and streak\n"
    "/leaderboard · Who's sharpest\n"
    "/help · How it works"
)

HELP_TEXT = (
    "🛡 <b>How Drill Mode works</b>\n\n"
    "<b>1.</b> Send /drill and I'll show you a message. It might be a scam, or it "
    "might be genuine.\n"
    "<b>2.</b> Tap 🚩 <b>Scam</b> or ✅ <b>Legit</b>.\n"
    "<b>3.</b> I'll tell you if you were right and what gave it away.\n\n"
    "💬 <b>Want a live chat?</b> Send /simulate and I'll play a scammer. Reply as "
    "you would for real, and send /end anytime for your debrief.\n\n"
    "⚖️ <i>Missing a scam is costly, but flagging a genuine message counts against "
    "you too. Everything is simulated: no real links, payments or data.</i>"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    if chat_id not in known_chats:
        known_chats.add(chat_id)
        save_known_chats()
    await update.message.reply_text(WELCOME_TEXT, parse_mode=HTML)
    if chat_id not in welcomed_chats:
        welcomed_chats.add(chat_id)
        save_welcomed_chats()


async def send_welcome_on_startup(context: ContextTypes.DEFAULT_TYPE):
    """Fired once shortly after the bot boots. Sends the welcome message only
    to chats that have never received it, so restarts don't spam anyone."""
    pending = [c for c in known_chats if c not in welcomed_chats]
    if not pending:
        return
    log.info("Sending the welcome to %d chat(s) that haven't had it", len(pending))
    for chat_id in pending:
        try:
            await context.bot.send_message(chat_id=chat_id, text=WELCOME_TEXT, parse_mode=HTML)
        except Exception as exc:
            drop_chat_if_gone(chat_id, exc)
        else:
            welcomed_chats.add(chat_id)
            save_welcomed_chats()
        await asyncio.sleep(BROADCAST_PAUSE_SECONDS)


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode=HTML)


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
                caption=DRILL_PHOTO_CAPTION, parse_mode=HTML,
                reply_markup=keyboard,
            )
            return
    # text drill (also the fallback if no fed images exist)
    scenario = get_scenario()
    _, keyboard = register_drill(scenario)
    await update.message.reply_text(
        format_drill(scenario["text"]), parse_mode=HTML, reply_markup=keyboard
    )


async def send_scheduled_drill(context: ContextTypes.DEFAULT_TYPE):
    """Fired automatically by the JobQueue - pushes a drill to every chat
    that has ever said /start, with no command needed from them. One drill
    is generated per run and shared across all chats (one set of API calls)."""
    mark_job_ran("scheduled_drill")
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
                    caption=DRILL_PHOTO_CAPTION, parse_mode=HTML,
                    reply_markup=keyboard,
                )
            else:
                await context.bot.send_message(
                    chat_id=chat_id,
                    text=format_drill(scenario["text"], header="⏰ <b>Surprise drill!</b>"),
                    parse_mode=HTML,
                    reply_markup=keyboard,
                )
        except Exception as exc:
            drop_chat_if_gone(chat_id, exc)
        await asyncio.sleep(BROADCAST_PAUSE_SECONDS)


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
        expired = "⚠️ This drill expired — send /drill for a new one."
        if query.message and query.message.photo:
            await query.edit_message_caption(caption=expired)
        else:
            await query.edit_message_text(expired)
        return

    entry = get_entry(query.from_user)
    is_photo = bool(query.message.photo)
    correct = (action == "scam") == is_scam

    if correct:
        entry["safe"] += 1
        entry["streak"] += 1
        entry["best_streak"] = max(entry["best_streak"], entry["streak"])
        verdict = ("✅ <b>Correct!</b> This was a scam." if is_scam
                   else "✅ <b>Correct!</b> This one was genuine.")
        streak = f"🔥 Streak: <b>{entry['streak']}</b>"
        if entry["best_streak"] > entry["streak"]:
            streak += f"  ·  Best: {entry['best_streak']}"
        show_app = False
    elif is_scam:
        # Missed a scam — the costly mistake.
        entry["scammed"] += 1
        entry["streak"] = 0
        verdict = "⚠️ <b>You'd have been scammed.</b> It was only a drill, so nothing was sent."
        streak = "🔁 Streak reset. Send /drill to try another."
        show_app = True
    else:
        # False alarm — flagged a legitimate message.
        entry["false_alarm"] += 1
        entry["streak"] = 0
        verdict = "🟡 <b>False alarm.</b> This one was genuine."
        streak = "🔁 Streak reset. Flagging everything means missing real messages too."
        show_app = False

    if is_photo and len(reason) > 700:  # captions max out at 1024 characters
        reason = reason[:699].rsplit(" ", 1)[0] + "…"
    result = f"{verdict}\n\n{h(reason)}\n\n{streak}"
    if is_photo:
        await query.edit_message_caption(caption=result, parse_mode=HTML)
    else:
        original = info.get("text") or query.message.text or ""
        await query.edit_message_text(
            format_drill(original, footer="") + "\n\n" + result, parse_mode=HTML
        )

    if show_app:
        await query.message.reply_text(
            "📲 Review this drill in the SafeSpace app:",
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
        "📊 <b>Your drill record</b>\n\n"
        f"✅ Correct: <b>{entry['safe']}</b>\n"
        f"⚠️ Missed scams: <b>{entry['scammed']}</b>\n"
        f"🟡 False alarms: <b>{false_alarm}</b>\n\n"
        f"🎯 Accuracy: <b>{accuracy}%</b>  ·  🔥 Best streak: <b>{entry['best_streak']}</b>",
        parse_mode=HTML,
    )


async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not stats:
        await update.message.reply_text("No drills run yet. Try /drill first!")
        return

    fame = sorted(stats.values(), key=lambda e: e["safe"], reverse=True)[:5]
    shame = sorted(stats.values(), key=lambda e: e["scammed"], reverse=True)[:5]

    medals = ["🥇", "🥈", "🥉", "4.", "5."]
    fame_lines = "\n".join(
        f"{medals[i]} {h(e['name'])} · <b>{e['safe']}</b> safe" for i, e in enumerate(fame)
    )
    shame_lines = "\n".join(
        f"{i + 1}. {h(e['name'])} · <b>{e['scammed']}</b> scammed"
        for i, e in enumerate(shame) if e["scammed"]
    ) or "<i>Nobody yet. Keep it that way!</i>"

    await update.message.reply_text(
        f"🏆 <b>Hall of fame</b>\n{fame_lines}\n\n💀 <b>Hall of shame</b>\n{shame_lines}",
        parse_mode=HTML,
    )


async def trending_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """On-demand: the latest bulletin's scams, then practice copies (+ images)."""
    summary = await asyncio.to_thread(bulletin_summary)
    scams = await asyncio.to_thread(trending_real_scams, 3)
    if summary:
        await update.message.reply_text(summary, parse_mode=HTML)
    if not scams:
        if not summary:
            await update.message.reply_text("Couldn't load trending scams right now. Try again shortly.")
        return
    await update.message.reply_text(format_trending_scams(scams), parse_mode=HTML)
    for img in scam_images(2):
        await update.message.reply_photo(photo=BytesIO(img), caption="📸 Example scam screenshot")


LEARN_KEYBOARD = InlineKeyboardMarkup([[
    InlineKeyboardButton("📚 Another scam", callback_data="learn:next"),
    InlineKeyboardButton("🎯 Try a drill", callback_data="learn:drill"),
]])
NO_LEARN_DATA = "No scam bulletin data is available right now. Try /trending instead."


async def learn_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """A deep-dive card on one real scam variant from the official bulletins."""
    card = await asyncio.to_thread(scam_intel.random_variant_card)
    if not card:
        await update.message.reply_text(NO_LEARN_DATA)
        return
    await update.message.reply_text(card, parse_mode=HTML, reply_markup=LEARN_KEYBOARD)


async def learn_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Buttons under a /learn card: show another scam, or start a drill."""
    query = update.callback_query
    await query.answer()
    # Take the buttons off the old card so the chat stays tidy.
    try:
        await query.edit_message_reply_markup(reply_markup=None)
    except BadRequest:
        pass
    if query.data == "learn:drill":
        scenario = get_scenario()
        _, keyboard = register_drill(scenario)
        await query.message.reply_text(
            format_drill(scenario["text"]), parse_mode=HTML, reply_markup=keyboard
        )
        return
    card = await asyncio.to_thread(scam_intel.random_variant_card)
    if not card:
        await query.message.reply_text(NO_LEARN_DATA)
        return
    await query.message.reply_text(card, parse_mode=HTML, reply_markup=LEARN_KEYBOARD)


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
    app.add_handler(CommandHandler("learn", learn_cmd))
    # /learn buttons first: the drill-answer handler below accepts any callback.
    app.add_handler(CallbackQueryHandler(learn_button, pattern=r"^learn:"))
    app.add_handler(CallbackQueryHandler(button))

    # Live LLM-powered scam simulation (/simulate, /end). Optional — only active
    # if an OPENAI_API_KEY is set. Registered in its own module.
    try:
        import scam_sim

        scam_sim.register(app)
    except Exception:
        log.warning("Could not load scam simulation module", exc_info=True)

    app.add_error_handler(on_error)

    # Greet anyone who hasn't had the welcome yet (never repeats per chat).
    if WELCOME_ON_STARTUP:
        app.job_queue.run_once(send_welcome_on_startup, when=3)

    # Optional automatic broadcasts, timed from their last real run.
    if ENABLE_SCHEDULED_DRILLS:
        first = first_run_delay("scheduled_drill", DRILL_INTERVAL_SECONDS, DRILL_FIRST_DELAY)
        app.job_queue.run_repeating(
            send_scheduled_drill, interval=DRILL_INTERVAL_SECONDS, first=first,
            name="scheduled_drill",
        )
        log.info("Scheduled drills on: every %ds, next in %ds", DRILL_INTERVAL_SECONDS, first)
    if ENABLE_TRENDING_ALERTS:
        first = first_run_delay("trending_alert", TRENDING_INTERVAL_SECONDS, TRENDING_FIRST_DELAY)
        app.job_queue.run_repeating(
            send_trending_alert, interval=TRENDING_INTERVAL_SECONDS, first=first,
            name="trending_alert",
        )
        log.info("Trending alerts on: every %ds, next in %ds", TRENDING_INTERVAL_SECONDS, first)

    log.info("Data folder: %s", DATA_DIR)
    n_scam = sum(1 for s in SCENARIOS if s["is_scam"])
    log.info("Loaded %d drills (%d scam) from %s", len(SCENARIOS), n_scam, CONTENT_FILE)
    if scam_intel.enabled():
        log.info("Scam intel: reading SPF bulletins from Supabase (%s)", scam_intel.SUPABASE_URL)
    else:
        log.info("Scam intel: SUPABASE_URL/SUPABASE_KEY not set — /learn has no data, "
                 "/trending uses scamalert.sg")

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
