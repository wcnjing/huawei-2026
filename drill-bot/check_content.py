"""
check_content.py - run after editing content/drills.json or content/personas.json.

    python check_content.py

Fails (exit code 1) if a drill or /simulate persona names a real organisation
(anything in drills.json "generic_names"), if a drill link is not a harmless
.example placeholder, or if an entry is missing a required field. The same rule
as the main SafeSpace app: every institution in a simulated scam is fictional.
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTENT = HERE / "content"
HOST = re.compile(r"(?<![\w@])((?:[a-z0-9-]+\.)+[a-z]{2,})(?![\w.])", re.I)


def load(name: str) -> dict:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


def name_patterns(pairs):
    return [re.compile(rf"(?<!\w)(?:{p})(?!\w)") for p, _ in pairs]


def main() -> int:
    drills = load("drills.json")
    personas = load("personas.json")
    names = name_patterns(drills.get("generic_names", []))
    themes = {t for t, _ in drills.get("theme_keywords", [])} | {"other"}
    problems = []

    texts = []
    for i, s in enumerate(drills.get("scenarios", []), 1):
        where = f"drills.json scenario {i}"
        if not isinstance(s.get("is_scam"), bool):
            problems.append(f"{where}: is_scam must be true or false")
        if s.get("theme") not in themes:
            problems.append(f"{where}: theme {s.get('theme')!r} is not in theme_keywords")
        for field in ("text", "reason"):
            if not str(s.get(field, "")).strip():
                problems.append(f"{where}: missing {field}")
            texts.append((f"{where} {field}", str(s.get(field, ""))))
        if s.get("is_scam") and not str(s.get("tip", "")).strip():
            problems.append(f"{where}: scam drills need a short 'tip'")
        if s.get("tip"):
            texts.append((f"{where} tip", str(s["tip"])))
        for host in HOST.findall(str(s.get("text", ""))):
            if "example" not in host.lower().split("."):
                problems.append(f"{where}: link '{host}' must use an .example placeholder domain")

    for p in personas.get("personas", []):
        for field in ("name", "goal", "opening"):
            if not str(p.get(field, "")).strip():
                problems.append(f"personas.json {p.get('name')!r}: missing {field}")
            texts.append((f"personas.json {p.get('name')!r} {field}", str(p.get(field, ""))))
    texts += [(f"drills.json trending_fallback {i}", t)
              for i, t in enumerate(drills.get("trending_fallback", []), 1)]

    for where, text in texts:
        for rx in names:
            m = rx.search(text)
            if m:
                problems.append(f"{where}: real organisation name '{m.group(0)}'")

    if problems:
        print("Content check FAILED:\n  " + "\n  ".join(problems))
        return 1
    n_scam = sum(1 for s in drills["scenarios"] if s.get("is_scam"))
    print(f"Content OK: {len(drills['scenarios'])} drills ({n_scam} scam), "
          f"{len(personas['personas'])} personas, no real organisation names.")
    return 0


if __name__ == "__main__":
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except AttributeError:
            pass
    sys.exit(main())
