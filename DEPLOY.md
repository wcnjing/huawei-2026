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
update `PUBLIC_URL` plus the Vapi webhook each time), and the laptop must stay awake.

> ⚠️ `npm test` deletes `server/data.json` — the test fixtures reset it. Do not run the
> suite after registering the phone you plan to demo with.

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

# Node 22 LTS. The app uses --env-file-if-exists, so Node 20.12+ is the floor.
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs nginx git
node -v          # expect v22.x

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

PUBLIC_URL=https://YOUR_DOMAIN        # no trailing slash
VAPI_WEBHOOK_SECRET=<openssl rand -hex 32>

VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
TWILIO_SMS_FROM=+1...

# Optional — email drills refuse with 503 until all three are set.
OPENAI_API_KEY=
GOOGLE_SCRIPT_URL=
GOOGLE_SCRIPT_SECRET=
```

```sh
chown safespace:safespace .env && chmod 600 .env
```

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

## 6. Point Vapi at the webhook

In Vapi, set the server URL to `https://your.actual.domain/api/webhooks/vapi` and the
secret header `x-vapi-secret` to the same value as `VAPI_WEBHOOK_SECRET`.

The backend also sends that URL per-call, so once `PUBLIC_URL` is set, real call
outcomes flow back into XP automatically — no tunnel needed.

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
journalctl -u safespace | grep '\[verify\]'          # expect mode=twilio
curl -I http://YOUR_DOMAIN                           # 301 -> https
```

If `/api/drills/simulate` returns anything but 404, or the log says `mode=dev`, then a
dev flag is set in production — fix that before anyone else gets the URL.

## Known limits

- **Single instance only, on the file backend.** Two processes sharing one `data.json`
  will lose updates. The Redis backend guards writes with a compare-and-set and is safe
  to run multi-instance.
- **Sessions never expire** — a token is valid until the store is reset.
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
- Free tier is 500k Redis commands/month. Each app open is a read; each drill is a
  read plus a write. Nowhere near the limit at demo scale.

---

# Storage backends

Selected by environment, so the same code runs on all three hosts:

| `UPSTASH_REDIS_REST_URL` | Backend | Used by |
|---|---|---|
| unset | `server/data.json` on local disk | `npm run dev`, tunnel demo, ECS |
| set | Upstash Redis | Vercel, or any serverless host |

Both keep the same whole-document shape. The Redis backend additionally guards every
write with a Lua compare-and-set on a version key: several serverless instances can run
at once, so a losing writer replays its change against the fresh document instead of
overwriting whoever won. `server/store.redis.test.mjs` covers that against a fake Redis,
so it runs with no account and no network.
