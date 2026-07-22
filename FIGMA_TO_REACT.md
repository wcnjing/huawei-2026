# Handoff: Figma → React (SafeSpace / Drill Mode)

**Audience:** a Claude Code session with no prior context. Read this fully before touching code.

---

## 0. Read this first — a React app already exists

Do **not** rebuild from scratch. The Figma Make design has already been exported and wired up.

**Repo:** `https://github.com/sy-afk/HUAWEI_2026`

| Branch | What's on it |
|---|---|
| `main` | Older prototype: Node/Express + vanilla `index.html` + OpenAI chat. Not the current app. |
| `figma-drill-mode` | The **raw Figma Make export** (React 18 + Vite 6 + Tailwind 4). |
| `drill-mode-backend` | **← WORK HERE.** That export **plus** an Express backend, wired to live data. |
| `vapi-voice-poc` | Separate Python POC that places real AI scam-drill phone calls. |

```sh
git clone https://github.com/sy-afk/HUAWEI_2026.git
cd HUAWEI_2026 && git checkout drill-mode-backend
npm install && npm start     # build + serve → http://localhost:3000
npm test                     # backend unit tests
```

**Your job is incremental:** bring *new or updated* Figma screens into the existing app. Preserve
what works.

---

## 1. Getting code out of Figma Make

Figma Make already generates React under the hood — **export it, don't hand-rebuild**.

1. Open the Make project → **"Get code" / Download / "Connect to GitHub"** (top-right area).
2. Prefer **Connect to GitHub** (pushes a clean repo you can diff) or download the zip.
3. A `.make` file is **not** source — it's a design bundle (binary `canvas.fig` + chat history).
   If that's all you have, you cannot extract components from it; get the code export instead.

Expect: `index.html`, `vite.config.ts`, `package.json`, `src/main.tsx`,
`src/app/App.tsx` (everything in one big file), `src/styles/*.css`.

---

## 2. Current architecture (don't fight it)

`src/app/App.tsx` is a single ~2,700-line file — a **flat state machine**, not a router:

```tsx
type Screen = "title" | "home" | "drill-select" | "incoming" | "call"
            | "result-win" | "result-lose" | "leaderboard" | "profile"
            | "register" | "sms-*" | "email-*";

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  ...
  {screen === "home" && <FamilyHomeScreen ... />}
}
```

**To add a Figma screen:**
1. Add its name to the `Screen` union.
2. Add the component (keep it in `App.tsx` alongside the others — consistency beats purity here).
3. Add one line to the render block in `App()`.
4. Add an entry point (a `PixelBtn` on an existing screen) so it's reachable.

Do **not** introduce react-router, a state library, or split the file wholesale. A large refactor
would collide with in-flight work for no user-visible gain.

---

## 3. Reuse the existing design-system components

They already exist in `App.tsx`. **Never hand-roll a button or panel.**

| Component | Props |
|---|---|
| `PixelBtn` | `children, onClick?, color?, textColor?, size?: "sm"\|"md"\|"lg", full?, disabled?` |
| `PixelPanel` | `children, className?, accent?` |
| `XPBar` | `current, max, color?` |
| `PixelMascot` | `size?, animate?` |
| `PhoneFrame` | wraps all screens (already applied in `App()`) |
| `Stars`, `Scanlines`, `Blink` | background/FX |

**Palette:** bg `#0a0e1a` · panel `#111827` · border `#2a3a5c` · green `#00ff88` ·
teal `#4ecdc4` · red `#ff2d55` · orange `#ff6b35` · yellow `#ffe66d` · purple `#c77dff` ·
text `#e8f4f8` · muted `#6b8ba4`

**Fonts:** `'Press Start 2P'` (titles/numbers, small sizes — it's wide) ·
`'Share Tech Mono'` / `'VT323'` (body). Chunky 3–4px borders, solid offset shadows, sharp
corners, 8px grid.

---

## 4. Wiring to the backend

The Express backend (`server/`) serves the built app **and** the API on the same origin, so use
relative paths. In dev, `vite.config.ts` proxies `/api` → `:3000`.

| Endpoint | Purpose |
|---|---|
| `GET /api/me?user=` | single user (Profile) |
| `GET /api/family` | all members (Home dollhouse) |
| `GET /api/leaderboard` | ranked list |
| `GET /api/drills/pending-result` | on load: real-call result waiting → route to result screen |
| `POST /api/drills/practice-result` | in-app drill finished `{outcome}` → returns awarded XP |
| `POST /api/drills/fire` | fire a real phone drill (consent-gated) |
| `POST /api/verify/start` / `/check` | phone registration OTP (dev bypass code `000000`) |
| `POST /api/drills/simulate` | demo a real-call result with no telephony |

**Rule: every fetch must fail soft.** Use the existing helper and keep mock data as the fallback
so the prototype still runs with no backend:

```tsx
const [rows, setRows] = useState(MOCK);
useEffect(() => { apiGet<Row[]>("/api/family").then(r => { if (r?.length) setRows(r); }); }, []);
```

**Never put secrets in the front-end.** All keys live server-side; the browser only calls `/api/*`.
Anything in a `VITE_*` var is shipped to every visitor.

---

## 5. Verification (all four, before reporting done)

1. `npm run build` — must compile clean.
2. `npm test` — backend tests must stay green.
3. `npm start`, open `http://localhost:3000`, and **click the actual flow** you changed.
4. Re-read your full diff for debug code, dead mock data, incomplete renames.

Useful offline check of the real-call loop (no phone needed):
```sh
curl -XPOST localhost:3000/api/drills/simulate -H 'content-type: application/json' -d '{"outcome":"complied"}'
# then reload the app → it should open on the result screen
```

---

## 6. Guardrails

- Work on `drill-mode-backend`; commit in working increments; **don't push to `main`**.
- `.env` is gitignored — never commit it. `server/data.json` is runtime state, also ignored.
- Don't upgrade React/Vite/Tailwind majors as a drive-by.
- Figma Make output is verbose and mock-data-heavy: **strip hardcoded arrays** when wiring to the
  API, but keep one as the offline fallback.
- If a Figma screen conflicts with an existing one, ask before replacing — several screens are
  already wired to live data and shouldn't be silently overwritten.
