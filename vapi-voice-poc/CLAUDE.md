# CLAUDE.md — SafeSpace Voice POC

## Overview

Standalone proof-of-concept for **one** SafeSpace feature: a Claude-driven **scam-drill phone call** to the user's own mobile that escalates under pushback, then reveals itself as a drill. It exists to answer exactly two questions before the rest of SafeSpace gets built: (1) is a real Claude-driven call **viable** (latency, turn-taking)? (2) is it **convincing** (voice + persona + escalation)? Everything else — SMS drill, debrief engine, dashboard, consent DB, scheduler — is intentionally out of scope; don't add it here.

Stack: one Python script (`call.py