# Deploying SafeSpace

Three ways to run this, depending on what you need:

| | When to use it | Storage |
|---|---|---|
| [**Tunnel from a laptop**](#local-demo-over-a-tunnel) | Demo day. Live HTTPS in 2 minutes, no account, no card. | `server/data.json` on your disk |
| [**Huawei Cloud ECS**](#deploying-to-huawei-cloud-ecs) | The "hosted on Huawei Cloud" story in the pitch. | `server/data.json` on the VM disk |
| [**Vercel + Upstash**](#deploying-to-vercel--upstash) | A permanent URL with nothing to keep running. | Upstash Redis |

**Pick storage before you pick a host.** The default file store needs a real disk. On a
serverless host the filesystem is read-only, so it cannot write at all — which is why
the Vercel path requires Upstash and is not optional there. See
[Storage backends](#storage-backends).

---

## Local demo over a tunnel

No account, no card, works today. Data persists on your own disk.

```sh
npm run build
node --env-file-if-exists=.env server/index.js     # terminal 1
cloudflared tunnel --url http://localhost:3000     # terminal 2
```

The tunnel prints an `https://….trycloudflare.com` URL. Open it on a phone and use
*Add to Home Screen* / *Install app* — the PWA manifest makes it launch fullscreen.

Two things to know: **the URL changes every restart** (so don't put it on a slide, and
update `PUBLIC_URL` plus the Apps Script `SAFESPACE_LINK_ORIGIN` each time), and the
laptop must stay awake.

`npm test` uses temporary file-store paths and never resets the application's
`server/data.json`, so it is safe to run before or after registering the demo phone.

---

# Deploying to Huawei Cloud ECS

Target: one small ECS instance (Ubuntu 22.04+, 1 vCPU / 2 GB is plenty) running Node
behind nginx. Also satisfies the "hosted on Huawei Cloud" part of the pitch.

**Why ECS suits this app:** it's a normal VM with a real disk, so `server/data.json`
survives restarts and redeploys, with no external database to configure.

---

## 0. What you need first

| | Why |
|---|---|
| A Huawei Cloud **ECS instance** with a public EIP | the server |
| A **domain name** pointed at that EIP | Vapi only calls back over **HTTPS**, and Let's Encrypt needs a real hostname — an IP alone won't do |
| Security group: inbound **22, 80, 443** | SSH + web. **Do not open 3000** — nginx proxies to it locally |

---

## 1. Prepare the instance

```sh
ssh root@YOUR_EIP

# Node 22 LTS. `--env-file-if-exists` was added in Node 22.9, which is the floor
# declared in package.json.
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx git
node -v          # expect v22.9.0 or newer

# Run as an unprivileged user, not root.
adduser --system --group --home /opt/safespace safespace
```

## 2. Get the code

`adduser` in step 1 created `/opt/safespace`; `git clone` needs it empty.

```sh
ls -A /opt/safespace       # if not empty: rm -rf /opt/safespace/{*,.[!.]*}
git clone https://github.com/sy-afk/HUAWEI_2026.git /opt/safespace
cd /opt/safespace

# Install EVERYTHING first. vite, tailwindcss and @vitejs/plugin-react are
# devDependencies, so `--omit=dev` here makes the next line fail with
# "vite: not found". Prune after the build instead.
npm ci
npm run build              # builds the React app into dist/
npm prune --omit=dev       # now drop the build toolchain

chown -R safespace:safespace /opt/safespace
```

## 3. Configure

```sh
cp .env.example .env
nano .env
```

**Production values — these matter:**

```ini
# MUST be absent/false in production. They enable a fixed bypass code and a route
# that writes real drill results. The server warns loudly at startup if either is on.
ALLOW_DEV_VERIFY=
ENABLE_DEMO_ROUTES=
NODE_ENV=production

PUBLIC_URL=https://YOUR_DOMAIN        # no trailing slash
VAPI_WEBHOOK_SECRET=<openssl rand -hex 32>
DRILL_LINK_SECRET=<a different openssl rand -hex 32>
IDENTITY_LOOKUP_SECRET=<another different openssl rand -hex 32>
TRUST_PROXY_HOPS=<exact trusted proxy hop count, or 0 when direct>
PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR=20

VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
TWILIO_MESSAGING_SERVICE_SID=MG...

# Email ownership and drills. No OpenAI key is used.
GOOGLE_SCRIPT_URL=
GOOGLE_SCRIPT_SECRET=

# Optional lifecycle overrides; defaults shown.
SESSION_TTL_MS=2592000000
REAL_DRILL_COOLDOWN_MS=300000
SMS_REVEAL_DELAY_MS=960000
EMAIL_SAFETY_FOLLOWUP_DELAY_MS=600000
```

```sh
chown safespace:safespace .env && chmod 600 .env
```

### Stable identity-recovery secret

`IDENTITY_LOOKUP_SECRET` is required for safe phone removal. SafeSpace deletes the raw
phone on detach but retains a keyed HMAC lookup; after another successful OTP for the
same number, that lookup reconnects the preserved account and progress.

Use at least 32 random characters, use the same value on every instance, and keep it
stable across redeploys. Do not reuse `DRILL_LINK_SECRET` or a provider secret. If
SafeSpace has no existing recovery lookup and cannot access this secret, detach returns
503 and leaves the phone attached instead of orphaning the account. Losing or rotating
the secret without a lookup migration prevents already detached accounts from
reconnecting.

### Twilio Messaging Service for SMS drills

Phone OTP starts are durably limited per destination and across distinct numbers from
one resolved client address. Configure `TRUST_PROXY_HOPS` only after confirming the
exact reverse-proxy path and that the last trusted proxy overwrites forwarded headers;
otherwise leave it at `0`. The application limit is defense in depth—also set a
Twilio/CDN edge budget or rate limit before public launch.

`TWILIO_VERIFY_SERVICE_SID` handles registration OTPs. Real SMS drills use a separate
Programmable Messaging Service because Twilio fixed scheduling requires
`MessagingServiceSid`:

1. Create a Messaging Service in Twilio.
2. Add an SMS-capable number to its Sender Pool.
3. Put its `MG…` id in `TWILIO_MESSAGING_SERVICE_SID`.

A standalone `TWILIO_SMS_FROM` value is not sufficient. SafeSpace schedules the safety
reveal before bait and refuses to send bait unless Twilio confirms `scheduled`. Twilio
accepts delays from 15 minutes to 35 days; the default is 16 minutes.

### Google Apps Script for email ownership and drills

Create an Apps Script project from `server/apps-script/Code.gs`, then set these Script
Properties:

```text
SAFESPACE_SECRET       = the same value as GOOGLE_SCRIPT_SECRET
SAFESPACE_LINK_ORIGIN  = https://YOUR_DOMAIN
```

Run `_authorise` once in the editor to grant MailApp and time-trigger access. Deploy as
a Web app that executes as you, copy its `/exec` URL to `GOOGLE_SCRIPT_URL`, and keep
the script secret long and random.

The relay accepts structured message kinds only. It renders escaped, allow-listed
fictional templates; it does not accept provider-generated HTML and needs no OpenAI
key. An inbox must open its signed 30-minute verification link and explicitly confirm
on the landing page before it can receive a drill; GET previews never mutate ownership
or outcomes. Each drill also registers a persisted Apps Script safety-follow-up job
before bait is sent.

## 4. Run it as a service

```sh
cp deploy/safespace.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now safespace
systemctl status safespace          # expect active (running)
curl localhost:3000/api/health      # {"ok":true,...}
```

Logs: `journalctl -u safespace -f`

## 5. TLS + nginx

**Certificate first, config second.** `deploy/nginx.conf` references
`/etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem`, which does not exist yet — install it
before running certbot and `nginx -t` fails on the missing file. Check DNS has actually
propagated (`dig +short your.actual.domain` must return the EIP) or certbot will fail too.

```sh
# 5a. Get the certificate using the webroot the config already expects.
apt-get install -y certbot python3-certbot-nginx
mkdir -p /var/www/html
certbot certonly --webroot -w /var/www/html -d your.actual.domain

# 5b. Now the real config validates.
cp deploy/nginx.conf /etc/nginx/conf.d/safespace.conf
sed -i 's/YOUR_DOMAIN/your.actual.domain/g' /etc/nginx/conf.d/safespace.conf
nginx -t && systemctl reload nginx
```

Renewal is automatic, but nginx needs to pick up the new certificate:

```sh
echo 'renew_hook = systemctl reload nginx' >> /etc/letsencrypt/renewal/your.actual.domain.conf
```

Verify: `curl https://your.actual.domain/api/health`

## 6. Verify Vapi callback configuration

The backend supplies
`https://your.actual.domain/api/webhooks/vapi` and the `x-vapi-secret` header on every
transient call assistant. No permanent assistant webhook is required. Confirm
`PUBLIC_URL` is the public HTTPS origin and restart the service after changing it.

### Call-data privacy boundary

Vapi and its configured transcriber process call audio and transcript content to run
and classify the drill. SafeSpace asks Vapi to disable audio/video recording, packet
capture, provider logging and full message history. The SafeSpace store persists the
outcome, unscored reason and attempt metadata, not transcript text or audio.

Those artifact settings do not by themselves prove zero provider-side retention.
Review Vapi/transcriber account settings and contractual retention before production,
and avoid claiming that no transcript processing or provider storage occurs.

---

## Redeploying

```sh
cd /opt/safespace && git pull
npm install && npm run build && npm prune --omit=dev   # build tools are devDependencies
systemctl restart safespace
```

`server/data.json` is untouched by this — users, XP and consent records persist.

---

## Post-deploy checklist

```sh
curl https://YOUR_DOMAIN/api/health                  # 200
curl https://YOUR_DOMAIN/api/family                  # no "phone"/"email" anywhere
curl -X POST https://YOUR_DOMAIN/api/drills/fire     # 401 (auth required)
curl -X POST https://YOUR_DOMAIN/api/drills/simulate # 404 (demo route absent)
curl -X POST https://YOUR_DOMAIN/api/webhooks/vapi   # 401 (needs the secret)
curl https://YOUR_DOMAIN/drill-reveal                # 400 signed-link page, not the SPA
curl https://YOUR_DOMAIN/email-verify                # 400 verification page, not the SPA
journalctl -u safespace | grep '\[verify\]'          # expect mode=twilio
curl -I http://YOUR_DOMAIN                           # 301 -> https
```

If `/api/drills/simulate` returns anything but 404, or the log says `mode=dev`, then a
dev flag is set in production — fix that before anyone else gets the URL.

## Known limits

- **Single instance only, on the file backend.** Two processes sharing one `data.json`
  are unsupported. One process serializes mutations and atomically replaces the file;
  Redis uses compare-and-set and is safe to run multi-instance.
- Newly issued sessions expire after 30 days by default. Adjust `SESSION_TTL_MS` to
  match your security policy; detaching a phone revokes all of that account's sessions.
- `IDENTITY_LOOKUP_SECRET` is durable account-recovery material. Back it up securely
  with the data store; changing or losing it breaks lookup for detached accounts.
- There is no background recurring-drill scheduler. Every live drill is an explicit,
  authenticated user action.
- Provider acceptance cannot guarantee carrier or inbox delivery. Monitor provider
  delivery logs for production use.
- Back up `server/data.json` if the consent audit trail matters:
  `cp server/data.json /var/backups/safespace-$(date +%F).json`

---

# Deploying to Vercel + Upstash

A permanent URL with no server to keep alive. Requires Upstash: Vercel's filesystem is
read-only, so the default file store cannot work there at all.

## 1. Create the Redis database

[upstash.com](https://upstash.com) → sign up (free, no card) → **Create Database** →
Redis, single region, pick the region closest to your Vercel region. From the database
page copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** (the REST pair, not
the `redis://` connection string — the store speaks HTTP).

## 2. Import the repo

[vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo.
`vercel.json` already sets the build command, output directory and API routing, so leave
the framework settings alone.

## 3. Set environment variables

In **Settings → Environment Variables**, add the same values as `.env`, plus the two
Upstash ones. Two must be left **empty**:

| Variable | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL` | from step 1 |
| `UPSTASH_REDIS_REST_TOKEN` | from step 1 |
| `PUBLIC_URL` | `https://your-project.vercel.app` — no trailing slash |
| `VAPI_WEBHOOK_SECRET` | `openssl rand -hex 32` |
| `DRILL_LINK_SECRET` | a different `openssl rand -hex 32` |
| `IDENTITY_LOOKUP_SECRET` | another stable, random 32+ character secret |
| `TRUST_PROXY_HOPS` | exact trusted proxy hop count; `0` when directly exposed |
| `PHONE_VERIFICATION_REQUESTER_MAX_PER_HOUR` | optional; defaults to `20` |
| `SESSION_TTL_MS` | optional; defaults to 30 days |
| `REAL_DRILL_COOLDOWN_MS` | optional; defaults to 5 minutes |
| `ALLOW_DEV_VERIFY` | **empty** — it enables a fixed bypass code |
| `ENABLE_DEMO_ROUTES` | **empty** — it exposes an unauthenticated write route |

Then **Deploy**, and run the [post-deploy checklist](#post-deploy-checklist) against the
Vercel URL.

## Notes

- `vercel.json` sets `includeFiles: "server/**"` because `data.seed.json` is read at
  runtime through a path built from `import.meta.url`. Vercel's bundler cannot see that,
  and without it the function fails with ENOENT on first request.
- The store seeds from `data.seed.json` on first write, so the first deploy starts with
  the demo family already populated.
- Signed messaging links are top-level paths (`/drill-reveal`, `/drill-report` and
  `/email-verify`) and must route to the Express function, not the SPA fallback. The
  post-deploy checklist above catches an incorrect rewrite immediately.
- Free tier is 500k Redis commands/month. Each app open is a read; each drill is a
  read plus a write. Nowhere near the limit at demo scale.

---

# Storage backends

Selected by environment, so the same code runs on all three hosts:

| `UPSTASH_REDIS_REST_URL` | Backend | Used by |
|---|---|---|
| unset | `server/data.json` on local disk | `npm run dev`, tunnel demo, ECS |
| set | Upstash Redis | Vercel, or any serverless host |

Both keep the same whole-document shape. The file backend serializes mutations inside
one Node process and atomically renames complete files. Redis additionally guards every
write with a Lua compare-and-set on a version key: several serverless instances can run
at once, so a losing writer replays its change against the fresh document instead of
overwriting whoever won. `server/store.redis.test.mjs` covers that against a fake Redis,
so it runs with no account and no network.

Tests select isolated temporary files with `SAFESPACE_DATA_FILE`; they do not remove the
normal `server/data.json`.
