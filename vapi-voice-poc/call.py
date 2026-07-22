#!/usr/bin/env python3
"""
SafeSpace Voice POC — place one outbound scam-drill call to your own mobile.

It reads a persona file, builds an INLINE (transient) Vapi assistant so prompt edits take
effect immediately, and POSTs to the Vapi /call endpoint. Nothing is pre-created in the
dashboard, so iterating on "is it convincing?" is just: edit persona -> run again.

Usage:
    pip install -r requirements.txt
    cp .env.example .env         # then fill in the required values
    python call.py               # rings MY_MOBILE

Safety: only ever call your OWN consenting, verified number. See README.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

VAPI_CALL_URL = "https://api.vapi.ai/call"

# Defaults for the tunable knobs. Override any of these in .env without touching this file.
DEFAULTS = {
    # Fast (Haiku-class) Claude for natural turn-taking. If Vapi rejects this exact string,
    # check the Vapi dashboard -> Model for the current id and set VAPI_CLAUDE_MODEL in .env.
    "VAPI_CLAUDE_MODEL": "claude-3-5-haiku-20241022",
    # Voice provider: "11labs" (ElevenLabs) or "azure" (has real Singapore-English voices) etc.
    "VAPI_VOICE_PROVIDER": "11labs",
    # ElevenLabs "Rachel" — a stable, natural default voice. Swap via VAPI_VOICE_ID.
    # For a Singaporean accent, set VAPI_VOICE_PROVIDER=azure + VAPI_VOICE_ID=en-SG-LunaNeural.
    "VAPI_VOICE_ID": "21m00Tcm4TlvDq8ikWAM",
    # Voice naturalness knobs (this is what kills the "robot" sound):
    #   model            — eleven_turbo_v2_5 = fast + natural (good phone default)
    #   stability   0..1 — LOWER = more human variation/cadence; HIGHER = flat/monotone
    #   similarity  0..1 — how close to the source voice
    #   style       0..1 — expressiveness; keep modest (>0.4 gets distorted)
    "VAPI_VOICE_MODEL": "eleven_turbo_v2_5",
    "VAPI_VOICE_STABILITY": "0.4",
    "VAPI_VOICE_SIMILARITY": "0.8",
    "VAPI_VOICE_STYLE": "0.25",
    "PERSONA_FILE": "persona/govt_impersonation.md",
    "MAX_DURATION_SECONDS": "300",
    # Spoken opening line. Short on purpose — a real scammer opens fast.
    "FIRST_MESSAGE": (
        "Good afternoon, am I speaking with the account holder? This is Officer Tan "
        "from the Office of Public Trust. I'm calling about an urgent matter on your bank account."
    ),
}


def env(key: str) -> str:
    """Return an env var, falling back to DEFAULTS, treating '' as unset."""
    val = os.getenv(key, "").strip()
    return val if val else DEFAULTS.get(key, "")


def envf(key: str) -> float:
    """Same as env(), parsed as a float (for voice tuning knobs)."""
    try:
        return float(env(key))
    except ValueError:
        sys.exit(f"ERROR: {key} must be a number (got: {env(key)!r})")


def build_voice() -> dict:
    """Build the Vapi voice object.

    ElevenLabs-only tuning (model/stability/style) is sent ONLY for provider '11labs'.
    Other providers (e.g. 'azure' for Singapore-English voices) take just provider + voiceId.
    """
    provider = env("VAPI_VOICE_PROVIDER")
    if provider != "11labs" and not os.getenv("VAPI_VOICE_ID", "").strip():
        sys.exit(
            f"ERROR: set VAPI_VOICE_ID for provider '{provider}' "
            "(e.g. en-SG-LunaNeural or en-SG-WayneNeural for azure)."
        )
    voice = {"provider": provider, "voiceId": env("VAPI_VOICE_ID")}
    if provider == "11labs":
        voice.update(
            {
                "model": env("VAPI_VOICE_MODEL"),
                "stability": envf("VAPI_VOICE_STABILITY"),
                "similarityBoost": envf("VAPI_VOICE_SIMILARITY"),
                "style": envf("VAPI_VOICE_STYLE"),
                "useSpeakerBoost": True,
            }
        )
    # Optional prosody knobs (mainly for azure) — only sent when you explicitly set them,
    # so leaving them blank keeps a known-good call. speed ~0.7–1.2, pitch -12..12 semitones.
    for knob, field in (("VAPI_VOICE_SPEED", "speed"), ("VAPI_VOICE_PITCH", "pitch")):
        raw = os.getenv(knob, "").strip()
        if raw:
            try:
                voice[field] = float(raw)
            except ValueError:
                sys.exit(f"ERROR: {knob} must be a number (got: {raw!r})")
    return voice


def load_system_prompt(persona_path: Path) -> str:
    """Read the persona file and return only the part BELOW the first '---' separator line.

    The text above '---' is documentation for us; only the prompt below it goes to the model.
    """
    if not persona_path.is_file():
        sys.exit(f"ERROR: persona file not found: {persona_path}")
    raw = persona_path.read_text(encoding="utf-8")
    parts = raw.split("\n---\n", 1)
    prompt = (parts[1] if len(parts) == 2 else raw).strip()
    if not prompt:
        sys.exit(f"ERROR: persona file has no prompt body below '---': {persona_path}")
    return prompt


def require(key: str) -> str:
    val = os.getenv(key, "").strip()
    if not val:
        sys.exit(f"ERROR: {key} is not set. Copy .env.example to .env and fill it in.")
    return val


def main() -> None:
    load_dotenv()

    api_key = require("VAPI_API_KEY")
    phone_number_id = require("VAPI_PHONE_NUMBER_ID")
    my_mobile = require("MY_MOBILE")
    if not my_mobile.startswith("+"):
        sys.exit(f"ERROR: MY_MOBILE must be E.164 with a country code, e.g. +6591234567 (got: {my_mobile})")

    persona_path = Path(env("PERSONA_FILE"))
    system_prompt = load_system_prompt(persona_path)

    assistant = {
        "firstMessage": env("FIRST_MESSAGE"),
        "firstMessageMode": "assistant-speaks-first",
        "maxDurationSeconds": int(env("MAX_DURATION_SECONDS")),
        "model": {
            "provider": "anthropic",
            "model": env("VAPI_CLAUDE_MODEL"),
            "temperature": 0.7,
            "maxTokens": 250,  # keep replies short = phone-call cadence
            "messages": [{"role": "system", "content": system_prompt}],
        },
        "voice": build_voice(),
        "transcriber": {
            "provider": "deepgram",
            "model": "nova-2",
            "language": "en",
        },
    }

    payload = {
        "phoneNumberId": phone_number_id,
        "customer": {"number": my_mobile},
        "assistant": assistant,
    }

    print(f"Placing drill call to {my_mobile} using persona '{persona_path.name}'...")
    v = assistant["voice"]
    print(f"  model : {assistant['model']['model']}")
    if v["provider"] == "11labs":
        print(
            f"  voice : 11labs/{v['voiceId']} "
            f"({v['model']}, stability={v['stability']}, style={v['style']})"
        )
    else:
        print(f"  voice : {v['provider']}/{v['voiceId']}")

    try:
        resp = requests.post(
            VAPI_CALL_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
    except requests.RequestException as err:
        sys.exit(f"ERROR: request to Vapi failed: {err}")

    if not resp.ok:
        # Surface Vapi's error body verbatim — it usually names the exact bad field.
        print(f"ERROR: Vapi returned HTTP {resp.status_code}", file=sys.stderr)
        print(resp.text, file=sys.stderr)
        print(
            "\nHints: a 400 often means a bad VAPI_CLAUDE_MODEL / VAPI_VOICE_ID string, "
            "or the number isn't verified on Twilio trial. See README troubleshooting.",
            file=sys.stderr,
        )
        sys.exit(1)

    data = resp.json()
    call_id = data.get("id", "<unknown>")
    print("\nCall created. Your phone should ring shortly.")
    print(f"  call id : {call_id}")
    print(f"  status  : {data.get('status')}")
    print(f"  listen  : {data.get('monitor', {}).get('listenUrl', '(check Vapi dashboard)')}")
    print("  Recording + full transcript will appear in the Vapi dashboard after the call ends.")

    # Save request + response metadata (NO sensitive call content) for iteration history.
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = Path("transcripts") / f"{stamp}_{call_id}.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        json.dumps(
            {
                "created_at": stamp,
                "persona": persona_path.name,
                "model": assistant["model"]["model"],
                "voice": assistant["voice"]["voiceId"],
                "request_customer": my_mobile,
                "response": data,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"  saved   : {out}")


if __name__ == "__main__":
    main()
