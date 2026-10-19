"""
Scam intelligence from the SafeSpace Supabase project.

Reads the SPF scam-bulletin tables that server/scam-intelligence/ fills in
(bulletins -> bulletin_scams -> scams -> scam_variants) through Supabase's REST
API, so the Telegram bot can show what the latest official bulletin warns about.

Read-only: this module only ever sends GET requests. It uses the standard library
(no extra pip packages) and keeps a cached copy on disk, so the bot keeps working
when Supabase is unreachable or paused.

Config (.env):
  SUPABASE_URL          https://<project-ref>.supabase.co
  SUPABASE_KEY          a key that can SELECT the four bulletin tables. Falls back
                        to SUPABASE_SECRET_KEY. Keep a secret key on the bot server
                        only, never in git.
  INTEL_STATUSES        bulletin processing_status values to use (comma-separated).
                        Default "approved" so only reviewed bulletins reach users.
  INTEL_CACHE_SECONDS   how long a fetch is reused before asking Supabase again.
                        Default 21600 (6 hours).
"""

from __future__ import annotations

import html
import json
import logging
import os
import random
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

log = logging.getLogger("drill_bot.intel")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_KEY = (os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or "").strip()
INTEL_STATUSES = [
    s.strip() for s in os.getenv("INTEL_STATUSES", "approved").split(",") if s.strip()
]
INTEL_CACHE_SECONDS = int(os.getenv("INTEL_CACHE_SECONDS", 6 * 60 * 60))
# How many recent bulletins to pull. /trending uses the newest; /learn uses all.
INTEL_BULLETIN_LIMIT = int(os.getenv("INTEL_BULLETIN_LIMIT", 6))

VARIANT_FIELDS = (
    "id,scam_id,variant_name,description,modus_operandi,communication_channel,"
    "impersonated_entity,target_victims,red_flags,requested_action,scam_tactics,"
    "victim_action,verification_method,prevention_advice"
)

_memory: dict | None = None  # {"fetched_at": float, "bulletins": [...]}
_cache_file: Path | None = None
_generic_names: list = []  # [(compiled pattern, generic replacement)]


def configure(data_dir: Path) -> None:
    """Tell the module where to keep its on-disk cache (the bot's DATA_DIR)."""
    global _cache_file
    _cache_file = Path(data_dir) / "scam_intel_cache.json"


# Words that can follow a name without the name being used as a modifier
# ("DBS or OCBC" vs "DBS account").
_NOT_NOUN = {
    "or", "and", "nor", "but", "via", "to", "for", "from", "with", "on", "in", "at",
    "by", "of", "as", "is", "are", "was", "were", "will", "would", "may", "might",
    "can", "could", "should", "has", "have", "had", "does", "did", "do", "if",
    "that", "which", "who", "when", "where", "a", "an", "the", "said", "says",
    "never", "not", "also", "now", "first", "again", "yourself", "only", "instead",
    "here", "there", "today", "online", "too", "either",
    "said", "says", "urged", "urges", "warned", "warns", "advised", "advises", "lost",
    "sent", "sends", "called", "calls", "asked", "asks", "told", "tells", "reported",
    "stated", "noted", "added", "explained", "confirmed", "announced", "reminded",
    "reminds", "encouraged", "encourages", "received", "receives",
}
_DETERMINERS = r"[Aa]n?|[Tt]he|[Yy]our|[Mm]y|[Oo]ur|[Tt]heir|[Hh]is|[Hh]er|[Ii]ts"


def set_generic_names(pairs) -> None:
    """[[pattern, replacement], ...] from content/drills.json, e.g. ["DBS", "a bank"].
    Real organisation names in bulletin text are swapped for generic terms before
    users see them. A leading a/an/the in the replacement is treated as optional."""
    global _generic_names
    compiled = []
    for pair in pairs or []:
        try:
            pattern, replacement = pair
            words = str(replacement).split(" ", 1)
            if len(words) == 2 and words[0].lower() in ("a", "an", "the"):
                article, noun = words[0].lower(), words[1]
            else:
                article, noun = "", str(replacement)
            rx = re.compile(rf"(?<!\w)(?:(?P<det>{_DETERMINERS})\s+)?(?:{pattern})(?!\w)")
            compiled.append((rx, article, noun))
        except (ValueError, TypeError, re.error) as e:
            log.warning("Ignoring bad generic_names entry %r (%s)", pair, e)
    _generic_names = compiled


# After these words a swapped-in name needs its article ("from a bank"); after
# any other lowercase word it is read as a modifier ("fake MAS" -> "fake
# financial regulator").
_ARTICLE_AFTER = {
    "from", "by", "to", "with", "as", "at", "like", "of", "via", "on", "in", "for",
    "into", "about", "than", "and", "or", "nor", "contact", "contacted", "contacting",
    "call", "called", "calling", "impersonate", "impersonated", "impersonates",
    "impersonating", "claim", "claimed", "claiming", "claims", "pretend", "pretended",
    "pretending", "pose", "posed", "posing", "use", "used", "using", "visit",
    "visited", "is", "are", "was", "were", "be", "been", "being", "include",
    "included", "including", "named", "involving", "targeting", "against",
}


# After these the name is read as a modifier: "fake MAS officers" -> "fake
# financial regulator officers". Anywhere else it gets its article.
_ADJECTIVES = {
    "fake", "bogus", "spoofed", "fraudulent", "purported", "so-called", "genuine",
    "real", "official", "legitimate", "local", "overseas", "foreign", "impersonated",
}


def _replace(m: re.Match, article: str, noun: str) -> str:
    det = m.group("det")
    nxt = re.match(r"[ \t]+([a-z][\w-]*)", m.string[m.end():])
    used_as_modifier = (
        bool(nxt) and nxt.group(1) not in _NOT_NOUN
        and not (nxt.group(1).endswith("ly") and nxt.group(1) not in ("family", "supply"))
    )
    before = m.string[: m.start()]
    if det:
        if det.lower() in ("a", "an"):
            a = "an" if noun[:1].lower() in "aeiou" else "a"
            return (a.capitalize() if det[0].isupper() else a) + " " + noun
        return f"{det} {noun}"
    prev = re.search(r"(\w+|[^\w\s])\s*$", before)
    prev = prev.group(1) if prev else ""
    after_adjective = prev.lower() in _ADJECTIVES
    out = noun if (used_as_modifier or after_adjective or not article) else f"{article} {noun}"
    if not before.strip() or re.search(r"[.!?:\n]\s*$", before):
        out = out[:1].upper() + out[1:]
    return out


def generic_terms_in(text: str) -> list:
    """The generic terms for every real name found in text, e.g. ['a bank', 'the police']."""
    found = []
    for rx, article, noun in _generic_names:
        for m in rx.finditer(text or ""):
            found.append((m.start(), f"{article} {noun}".strip()))
    out = []
    for _, term in sorted(found):
        if term not in out:
            out.append(term)
    return out


def genericise(text: str) -> str:
    if not text:
        return text
    for rx, article, noun in _generic_names:
        text = rx.sub(lambda m: _replace(m, article, noun), text)
    nouns = {n for _, _, n in _generic_names}
    # "a bank, a bank or the police" -> "a bank or the police"
    for noun in nouns:
        phrase = rf"(?:(?:an?|the|[Aa]n?|[Tt]he) )?{re.escape(noun)}"
        text = re.sub(
            rf"({phrase})(?:(?:\s*,\s*|\s*/\s*|\s+or\s+|\s+and\s+){phrase})+(?!\w)",
            r"\1", text,
        )
    # "banks such as a bank" -> "banks"
    for noun in nouns:
        text = re.sub(
            rf"({re.escape(noun)}s)\s*,?\s*\(?(?:such as|including|like|e\.g\.,?|for example,?)"
            rf"\s+(?:(?:an?|the) )?{re.escape(noun)}\)?(?!\w)",
            r"\1", text,
        )
    return text


def enabled() -> bool:
    return bool(SUPABASE_URL and SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Supabase REST (PostgREST) access
# ---------------------------------------------------------------------------


def _headers() -> dict:
    headers = {"apikey": SUPABASE_KEY, "Accept": "application/json"}
    # Legacy anon/service_role keys are JWTs and also go in Authorization.
    # The newer sb_publishable_/sb_secret_ keys must only be sent as apikey.
    if SUPABASE_KEY.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {SUPABASE_KEY}"
    return headers


def _get(table: str, params: dict) -> list:
    """GET /rest/v1/<table>?<params>. Raises on HTTP or network errors."""
    query = urllib.parse.urlencode(params, safe="(),.*")
    url = f"{SUPABASE_URL}/rest/v1/{table}?{query}"
    req = urllib.request.Request(url, headers=_headers())
    with urllib.request.urlopen(req, timeout=15, context=ssl.create_default_context()) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"unexpected response from {table}")
    return data


def _in_list(values) -> str:
    """PostgREST in.(...) filter with each value quoted (works for uuid and text)."""
    quoted = ",".join('"' + str(v).replace('"', "") + '"' for v in values)
    return f"in.({quoted})"


def _as_list(value) -> list:
    """red_flags / scam_tactics may arrive as a JSON array, a JSON string or text."""
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return _as_list(parsed)
        except ValueError:
            pass
        return [value.strip()]
    return []


def fetch_from_supabase() -> list:
    """Return recent bulletins, newest first, each with its scams and variants:
    [{"title", "issue_number", "published_date",
      "scams": [{"scam_name", "scam_category", "description", "variants": [...]}]}]
    Uses four flat queries rather than embedded joins, so it does not depend on
    foreign keys having been declared on the dashboard-created tables."""
    bulletins = _get("bulletins", {
        "select": "id,title,issue_number,published_date",
        "processing_status": _in_list(INTEL_STATUSES),
        "order": "published_date.desc",
        "limit": str(INTEL_BULLETIN_LIMIT),
    })
    if not bulletins:
        return []

    links = _get("bulletin_scams", {
        "select": "bulletin_id,scam_id",
        "bulletin_id": _in_list(b["id"] for b in bulletins),
    })
    scam_ids = sorted({link["scam_id"] for link in links})
    if not scam_ids:
        return []

    scams = _get("scams", {
        "select": "id,scam_name,scam_category,description",
        "id": _in_list(scam_ids),
    })
    variants = _get("scam_variants", {
        "select": VARIANT_FIELDS,
        "scam_id": _in_list(scam_ids),
    })

    variants_by_scam: dict = {}
    for v in variants:
        v["red_flags"] = _as_list(v.get("red_flags"))
        v["scam_tactics"] = _as_list(v.get("scam_tactics"))
        variants_by_scam.setdefault(v["scam_id"], []).append(v)

    scam_by_id = {}
    for s in scams:
        s["variants"] = variants_by_scam.get(s["id"], [])
        scam_by_id[s["id"]] = s

    out = []
    for b in bulletins:
        linked = [scam_by_id[l["scam_id"]] for l in links
                  if l["bulletin_id"] == b["id"] and l["scam_id"] in scam_by_id]
        if linked:
            out.append({
                "title": b.get("title") or "Scam bulletin",
                "issue_number": b.get("issue_number"),
                "published_date": b.get("published_date"),
                "scams": linked,
            })
    return out


# ---------------------------------------------------------------------------
# Cache: memory -> fresh fetch -> disk (stale is better than nothing)
# ---------------------------------------------------------------------------


def _read_disk() -> dict | None:
    if not _cache_file or not _cache_file.exists():
        return None
    try:
        data = json.loads(_cache_file.read_text(encoding="utf-8"))
        return data if isinstance(data.get("bulletins"), list) else None
    except (OSError, ValueError):
        return None


def _write_disk(data: dict) -> None:
    if not _cache_file:
        return
    try:
        tmp = _cache_file.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, _cache_file)
    except OSError as e:
        log.warning("Could not save scam intel cache (%s)", e)


def get_bulletins(force: bool = False) -> list:
    """Recent bulletins with scams and variants. Never raises; [] if nothing."""
    global _memory
    now = time.time()
    if _memory is None:
        _memory = _read_disk()
    fresh = _memory and now - _memory.get("fetched_at", 0) < INTEL_CACHE_SECONDS
    if fresh and not force:
        return _memory["bulletins"]
    if not enabled():
        return _memory["bulletins"] if _memory else []
    try:
        bulletins = fetch_from_supabase()
        if not bulletins:
            log.warning(
                "Supabase returned no %s bulletins with scams. If the dashboard shows "
                "rows, check the key can read bulletins, bulletin_scams, scams and "
                "scam_variants (RLS) and that INTEL_STATUSES matches.",
                "/".join(INTEL_STATUSES),
            )
        _memory = {"fetched_at": now, "bulletins": bulletins}
        _write_disk(_memory)
        n_var = sum(len(s["variants"]) for b in bulletins for s in b["scams"])
        log.info("Loaded %d bulletin(s), %d scam variant(s) from Supabase", len(bulletins), n_var)
        return bulletins
    except Exception as e:
        log.warning("Supabase scam intel fetch failed (%s) - using cached copy", e)
        if _memory:
            # Back off: don't retry on every message while Supabase is down.
            _memory["fetched_at"] = now - INTEL_CACHE_SECONDS + 600
            return _memory["bulletins"]
        return []


def latest_bulletin() -> dict | None:
    bulletins = get_bulletins()
    return bulletins[0] if bulletins else None


def all_variants() -> list:
    """Every variant with its parent scam name, deduplicated across bulletins."""
    seen, out = set(), []
    for b in get_bulletins():
        for s in b["scams"]:
            for v in s["variants"]:
                if v["id"] in seen:
                    continue
                seen.add(v["id"])
                out.append({**v, "scam_name": s["scam_name"], "bulletin": b})
    return out


def trending_headlines(limit: int = 8) -> list:
    """Short text per scam in the newest bulletin, for keyword-matching drills."""
    b = latest_bulletin()
    if not b:
        return []
    lines = []
    for s in b["scams"]:
        bits = [s["scam_name"]]
        for v in s["variants"][:2]:
            bits += [v.get("variant_name") or "", v.get("impersonated_entity") or "",
                     v.get("communication_channel") or ""]
        lines.append(" ".join(x for x in bits if x))
    return lines[:limit]


# ---------------------------------------------------------------------------
# Telegram formatting. Returns Telegram HTML: send with parse_mode="HTML".
# Every value from Supabase is genericised (real names swapped out) and then
# HTML-escaped, so bulletin text can never break the markup.
# ---------------------------------------------------------------------------


def _date(b: dict) -> str:
    d = str(b.get("published_date") or "")[:10]
    try:
        return time.strftime("%d %b %Y", time.strptime(d, "%Y-%m-%d")).lstrip("0")
    except ValueError:
        return d


def _squash(text) -> str:
    return " ".join(str(text or "").split())


def _clip(text, n: int) -> str:
    """Shorten to n characters at a word boundary."""
    text = _squash(text)
    if len(text) <= n:
        return text
    cut = text[: n - 1].rsplit(" ", 1)[0].rstrip(",;:-–—")
    return cut + "…"


_STRONG_BREAKS = (", or ", ", and ", "; ", " - ", " – ", " — ", " (")
_WEAK_BREAKS = (", ", " and that ", " which ", " who ", " or ", " and ")


def _shorten(text, n: int) -> str:
    """Fit text in n characters: whole sentences if possible, else the first
    sentence cut at a clause boundary, else at a word boundary with '…'."""
    text = _squash(text)
    if len(text) <= n:
        return text
    out = ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        candidate = f"{out} {sentence}".strip()
        if len(candidate) > n:
            break
        out = candidate
    if out:
        return out
    for breaks in (_STRONG_BREAKS, _WEAK_BREAKS):
        cut = max(text.rfind(b, 0, n) for b in breaks)
        if cut >= 35:
            return text[:cut].rstrip(" ,;:-–—(")
    return _clip(text, n)


def _tidy(text) -> str:
    """Capitalise the first letter; drop a trailing full stop (for list items)."""
    text = _squash(text).rstrip(".")
    return text[:1].upper() + text[1:]


def _clean(text, n: int, prose: bool = False) -> str:
    """genericise -> shorten -> HTML-escape. prose=True ends with a full stop."""
    text = _shorten(genericise(_squash(text)), n)
    if prose and text and text[-1] not in ".!?…":
        text += "."
    return html.escape(text, quote=False)


def _scam_title(name) -> str:
    """'Government Official Impersonation scam' -> 'Government official impersonation scam'."""
    words = genericise(_squash(name)).split(" ")
    fixed = [w if (i == 0 or w.isupper() or any(c.isdigit() for c in w)) else w.lower()
             for i, w in enumerate(words)]
    title = " ".join(fixed)
    return html.escape(title[:1].upper() + title[1:], quote=False)


def _source(b: dict) -> str:
    bits = [_squash(b.get("title")) or "Scam bulletin", _date(b)]
    return html.escape(" · ".join(x for x in bits if x), quote=False)


_CHANNEL_ICONS = (
    (("call", "phone", "voice"), "📞"),
    (("sms", "text message", "messag", "chat", "whatsapp", "telegram"), "💬"),
    (("email", "e-mail"), "📧"),
    (("social", "facebook", "instagram", "tiktok", "post"), "📱"),
    (("website", "online", "web", "app", "ads", "advert"), "🌐"),
)


def _channel(text) -> str:
    low = _squash(text).lower()
    icon = next((i for keys, i in _CHANNEL_ICONS if any(k in low for k in keys)), "📡")
    return f"{icon} {_clean(_tidy(text), 40)}"


def _pretends_to_be(entity) -> str:
    """'DBS / OCBC staff, MAS officers, SPF officers' -> 'a bank, a financial regulator or the police'."""
    entity = _squash(entity)
    if not entity:
        return ""
    terms = generic_terms_in(entity)
    if terms:
        text = terms[0] if len(terms) == 1 else ", ".join(terms[:-1]) + " or " + terms[-1]
    else:
        text = genericise(entity)
        text = text[:1].lower() + text[1:] if not text[:2].isupper() else text
    return html.escape(_shorten(text, 70), quote=False)


def _first_variant(scam: dict) -> dict:
    variants = scam.get("variants") or []
    return next((v for v in variants if v.get("red_flags")), variants[0] if variants else {})


def format_bulletin_summary(b: dict, max_scams: int = 3) -> str:
    """/trending: the scams the latest official bulletin warns about (HTML)."""
    blocks = [f"🚨 <b>Scams to watch out for</b>\n<i>{_source(b)}</i>"]
    scams = b.get("scams") or []
    for i, s in enumerate(scams[:max_scams], 1):
        v = _first_variant(s)
        lines = [f"<b>{i}. {_scam_title(s['scam_name'])}</b>"]
        flags = v.get("red_flags") or []
        if flags:
            lines.append(f"🚩 {_clean(_tidy(flags[0]), 115)}")
        tip = v.get("verification_method") or v.get("prevention_advice")
        if tip:
            lines.append(f"✅ {_clean(_tidy(tip), 120)}")
        blocks.append("\n".join(lines))
    more = len(scams) - max_scams
    footer = "Send /learn for the full breakdown"
    if more > 0:
        footer += f" (+{more} more in this bulletin)"
    blocks.append(f"<i>{footer}.</i>")
    return "\n\n".join(blocks)


def format_variant_card(v: dict) -> str:
    """/learn: one scam explained in full (HTML)."""
    head = [f"📚 <b>{_scam_title(v['scam_name'])}</b>"]
    if v.get("variant_name"):
        head.append(f"<i>{_clean(_tidy(v['variant_name']), 90)}</i>")
    meta = []
    if v.get("communication_channel"):
        meta.append(_channel(v["communication_channel"]))
    who = _pretends_to_be(v.get("impersonated_entity"))
    if who:
        meta.append(f"🎭 Pretends to be {who}")
    if meta:
        head.append("  ·  ".join(meta))
    blocks = ["\n".join(head)]

    how = v.get("modus_operandi") or v.get("description")
    if how:
        blocks.append(f"<b>How it works</b>\n{_clean(how, 320, prose=True)}")

    flags = [f for f in (v.get("red_flags") or []) if _squash(f)][:3]
    if flags:
        blocks.append("<b>Red flags</b>\n" + "\n".join(f"🚩 {_clean(_tidy(f), 110)}" for f in flags))

    todo = []
    check, advice = _squash(v.get("verification_method")), _squash(v.get("prevention_advice"))
    if check:
        todo.append(f"✅ {_clean(check, 200, prose=True)}")
    if advice and advice.lower() not in check.lower() and check.lower() not in advice.lower():
        todo.append(f"🛡 {_clean(advice, 200, prose=True)}")
    if todo:
        blocks.append("<b>What to do</b>\n" + "\n".join(todo))

    b = v.get("bulletin") or {}
    if b:
        blocks.append(f"<i>Source: {_source(b)}</i>")
    return "\n\n".join(blocks)


def random_variant_card() -> str | None:
    variants = all_variants()
    return format_variant_card(random.choice(variants)) if variants else None


def html_to_plain(text: str) -> str:
    """For printing previews in a terminal."""
    return html.unescape(re.sub(r"</?(?:b|i|u|s|code|blockquote)>", "", text))


# ---------------------------------------------------------------------------
# Self-check:  python scam_intel.py
# Tests the Supabase connection and prints what /trending and /learn would show,
# without starting the Telegram bot. Never uses or writes the cache.
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import sys

    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    SUPABASE_KEY = (os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SECRET_KEY") or "").strip()
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        try:
            sys.stdout.reconfigure(encoding="utf-8")  # emoji on Windows consoles
        except AttributeError:
            pass

    try:
        _content = Path(__file__).with_name("content") / "drills.json"
        set_generic_names(json.loads(_content.read_text(encoding="utf-8")).get("generic_names"))
    except (OSError, ValueError):
        print("(content/drills.json not found - real names will not be genericised)")
    if not enabled():
        sys.exit("SUPABASE_URL and SUPABASE_KEY are not set in drill-bot/.env")
    print(f"Connecting to {SUPABASE_URL} (statuses: {', '.join(INTEL_STATUSES)}) ...")
    try:
        data = fetch_from_supabase()
    except urllib.error.HTTPError as e:
        hint = ("the key is wrong or can't read these tables" if e.code in (401, 403)
                else "check SUPABASE_URL and that the bulletin tables exist")
        sys.exit(f"FAILED: HTTP {e.code} from Supabase - {hint}.")
    except Exception as e:
        sys.exit(f"FAILED: could not reach Supabase ({e}). Check your internet "
                 "connection and SUPABASE_URL.")
    if not data:
        sys.exit(
            "Connected, but found no bulletins with scams.\n"
            "- In Supabase, check bulletins.processing_status. If they say 'review', add\n"
            "  INTEL_STATUSES=approved,review to drill-bot/.env\n"
            "- If you used a publishable key, the tables' RLS may be hiding the rows;\n"
            "  try the secret key instead."
        )
    _memory = {"fetched_at": time.time(), "bulletins": data}
    n_var = sum(len(s["variants"]) for b in data for s in b["scams"])
    print(f"OK: {len(data)} bulletin(s), {n_var} scam variant(s)\n")
    print("===== /trending will start with =====\n")
    print(html_to_plain(format_bulletin_summary(data[0])))
    print("\n===== a sample /learn card =====\n")
    print(html_to_plain(random_variant_card()))
