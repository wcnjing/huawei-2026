"""
fetch_scam_images.py — pull the latest REAL scam-screenshot images from the
Singapore Police Force (SPF) advisories into images/scam/ so the drill bot can
send them as authentic image drills.

What it does:
  1. Opens the SPF scam-advisories listing and finds recent advisory pages.
  2. Opens each advisory and extracts the scam screenshot(s) it embeds.
  3. Downloads those images into images/scam/ (skipping ones already saved)
     and records a caption for each in images/reasons.json.

Usage:
    python fetch_scam_images.py            # fetch from the default SPF source
    python fetch_scam_images.py --max 8    # limit how many advisories to scan

Notes:
  - Run this on your own machine (it needs normal internet access).
  - It only downloads from police.gov.sg. Review images/scam/ afterwards and
    delete anything that isn't actually a scam screenshot (advisory pages
    occasionally embed a banner or infographic too).
  - Re-run it anytime to refresh the bot with what's currently trending.
"""

import argparse
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://www.police.gov.sg"
LISTING_URL = f"{BASE}/Advisories/Scams"
IMAGES_DIR = Path(__file__).with_name("images")
SCAM_DIR = IMAGES_DIR / "scam"
REASONS_FILE = IMAGES_DIR / "reasons.json"

IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp")
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-SG,en;q=0.9",
    "Referer": BASE + "/",
}
CTX = ssl.create_default_context()

# Advisory page images we never want (nav/branding/social chrome).
SKIP_IMAGE_HINTS = (
    "chevron", "logo", "crest", "megamenu", "footer", "social", "brand-isolated",
    "eservice", "contactus", "org_structure", "standard-banner", "instagram_",
    "default_thumbnail", "police-life",
)


def fetch(url: str, binary: bool = False):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "ignore")


class _LinkImgParser(HTMLParser):
    """Collect advisory links (href) and image sources (src)."""

    def __init__(self):
        super().__init__()
        self.links = []
        self.imgs = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "a" and d.get("href"):
            self.links.append(d["href"])
        elif tag == "img" and d.get("src"):
            self.imgs.append(d["src"])


def absolute(url: str) -> str:
    return urllib.parse.urljoin(BASE, url.replace("&amp;", "&"))


def find_advisory_links(listing_html: str, limit: int) -> list:
    p = _LinkImgParser()
    p.feed(listing_html)
    seen, out = set(), []
    for href in p.links:
        # Advisory article pages live under /Media-Hub/News/.../..._advisory_...
        if "/Media-Hub/News/" in href and "advisor" in href.lower():
            full = absolute(href)
            if full not in seen:
                seen.add(full)
                out.append(full)
        if len(out) >= limit:
            break
    return out


def find_scam_images(advisory_html: str) -> list:
    p = _LinkImgParser()
    p.feed(advisory_html)
    out = []
    for src in p.imgs:
        low = src.lower()
        if any(h in low for h in SKIP_IMAGE_HINTS):
            continue
        # Keep real content images: normal image files, or Sitecore .ashx blobs.
        if low.split("?")[0].endswith(IMG_EXTS) or ".ashx" in low:
            out.append(absolute(src))
    # De-duplicate, preserve order.
    seen, uniq = set(), []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def slug_from_url(advisory_url: str) -> str:
    tail = advisory_url.rstrip("/").split("/")[-1]
    tail = re.sub(r"^\d+_", "", tail)              # drop leading date
    tail = tail.replace("police_advisory_on_", "").replace("_", "-")
    return re.sub(r"[^a-z0-9\-]", "", tail.lower())[:60] or "spf-advisory"


def save_image(url: str, name: str) -> Path | None:
    try:
        data = fetch(url, binary=True)
    except Exception as e:
        print(f"    ! could not download image ({type(e).__name__})")
        return None
    if len(data) < 3000:  # too small to be a real screenshot
        return None
    ext = ".jpg"
    for e in IMG_EXTS:
        if url.lower().split("?")[0].endswith(e):
            ext = e
            break
    dest = SCAM_DIR / f"{name}{ext}"
    i = 2
    while dest.exists():
        dest = SCAM_DIR / f"{name}-{i}{ext}"
        i += 1
    dest.write_bytes(data)
    return dest


def load_reasons() -> dict:
    if REASONS_FILE.exists():
        try:
            return json.loads(REASONS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def main():
    ap = argparse.ArgumentParser(description="Download SPF scam screenshots into images/scam/")
    ap.add_argument("--max", type=int, default=6, help="max advisories to scan (default 6)")
    args = ap.parse_args()

    SCAM_DIR.mkdir(parents=True, exist_ok=True)
    reasons = load_reasons()

    print(f"Fetching SPF advisory list: {LISTING_URL}")
    try:
        listing = fetch(LISTING_URL)
    except Exception as e:
        sys.exit(
            f"Could not open the SPF advisories page ({type(e).__name__}: {e}).\n"
            "Check your internet connection and try again."
        )

    advisories = find_advisory_links(listing, args.max)
    if not advisories:
        sys.exit("No advisory links found — the page layout may have changed.")

    print(f"Found {len(advisories)} recent advisories. Downloading screenshots...\n")
    saved = 0
    for url in advisories:
        slug = slug_from_url(url)
        print(f"• {slug}")
        try:
            html = fetch(url)
        except Exception as e:
            print(f"    ! could not open advisory ({type(e).__name__})")
            continue
        imgs = find_scam_images(html)
        if not imgs:
            print("    (no screenshot found)")
            continue
        for n, img_url in enumerate(imgs[:2], start=1):
            name = slug if n == 1 else f"{slug}-{n}"
            dest = save_image(img_url, name)
            if dest:
                saved += 1
                reasons.setdefault(
                    dest.name,
                    "Real scam screenshot from an SPF advisory. Look for urgency, "
                    "a request for personal/bank/OTP details, and an unofficial "
                    "link or sender.",
                )
                print(f"    saved -> images/scam/{dest.name}")

    REASONS_FILE.write_text(json.dumps(reasons, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nDone. {saved} image(s) saved to images/scam/.")
    print("Review them, tidy captions in images/reasons.json, then restart the bot.")


if __name__ == "__main__":
    main()
