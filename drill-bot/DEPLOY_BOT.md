# Running the drill bot on Huawei Cloud

The bot runs 24/7 on a Huawei Cloud server instead of someone's PC. It can share
the same server as the web app (see `../DEPLOY.md`). It only makes outgoing
connections to Telegram, so it needs **no domain, no HTTPS and no open ports**.

About 30 minutes, start to finish.

## What you need

- A Huawei Cloud server running **Ubuntu 22.04 or newer** (the free Flexus L is plenty)
- The bot token from @BotFather, and the OpenAI key if you use `/simulate`
- From the PC that runs the bot now: `drill-bot/stats.json` and `drill-bot/known_chats.json`
  (these hold your users and scores; skip them to start fresh)

## 1. Stop the bot on the PC

Only one copy of the bot can run per token. On the PC:

1. Close the "Drill Bot" window, or end `python.exe` in Task Manager.
2. Press `Win + R`, type `shell:startup`, and delete the `start_drillbot_hidden` shortcut
   so it doesn't come back after a reboot.

## 2. Get the code onto the server

If the web app is already deployed, the code is in `/opt/safespace`. Update it:

```sh
ssh root@YOUR_SERVER_IP
cd /opt/safespace && git pull
```

Otherwise clone it:

```sh
git clone https://github.com/sy-afk/HUAWEI_2026.git /opt/safespace
```

## 3. Copy your users and scores across (optional)

From the PC, in the `drill-bot` folder (PowerShell works):

```sh
scp stats.json known_chats.json root@YOUR_SERVER_IP:/opt/safespace/drill-bot/
```

The setup script moves them into the data folder and marks those users as already
welcomed, so nobody gets a duplicate welcome.

## 4. Run the setup script

```sh
sudo bash /opt/safespace/drill-bot/deploy/setup_server.sh
```

The first run creates `drill-bot/.env` and stops. Fill it in, then run the script again:

```sh
nano /opt/safespace/drill-bot/.env        # paste BOT_TOKEN, OPENAI_API_KEY, APP_URL
sudo bash /opt/safespace/drill-bot/deploy/setup_server.sh
```

Set `APP_URL` to the web app's real address so drill review links work.

When it says **"Done. The bot is running."**, send `/start` to the bot in Telegram.

## Everyday commands

| To… | Run |
|---|---|
| Watch the live log | `journalctl -u safespace-bot -f` |
| Restart | `sudo systemctl restart safespace-bot` |
| Stop / start | `sudo systemctl stop safespace-bot` / `start` |
| Update to the latest code | `cd /opt/safespace && git pull && sudo bash drill-bot/deploy/setup_server.sh` |
| Change settings | edit `drill-bot/.env`, then restart |

Restarting is always safe. Nobody gets the welcome twice, and Scam/Legit buttons on
drills sent before the restart still work.

## Settings (`drill-bot/.env`)

| Setting | What it does | Default |
|---|---|---|
| `ENABLE_SCHEDULED_DRILLS=1` | Sends everyone a drill automatically every `DRILL_INTERVAL_SECONDS` | off |
| `DRILL_INTERVAL_SECONDS` | Gap between automatic drills | 21600 (6 h) |
| `ENABLE_TRENDING_ALERTS=1` | Weekly "trending scams" broadcast | off |
| `WELCOME_ON_STARTUP=0` | Turns off greeting people who never got the welcome | on |
| `POSTER_PROBABILITY` | Share of drills sent as images | 0.5 |

Automatic broadcasts remember when they last ran, so restarting the bot never sends
an extra one.

## Where the data lives

`/var/lib/safespace-bot/` holds `stats.json`, `known_chats.json`, `welcomed_chats.json`,
`active_drills.json` and `schedule.json`. It's outside the code folder, so `git pull`
never touches it.

A backup is taken every night into `/var/backups/safespace-bot/` (14 days kept). Those
backups are on the same server, so **copy one to your PC before the free trial ends**:

```sh
scp "root@YOUR_SERVER_IP:/var/backups/safespace-bot/*.tar.gz" .
```

## Scam images

The bot uses the images in `drill-bot/images/`. To add new ones, run
`python fetch_scam_images.py` **on your PC**, check the downloads (the script
sometimes grabs banners), commit them, then `git pull` and restart on the server.
It isn't automated on purpose: every image needs a human check, and government
sites block cloud servers more often than home internet.

## Troubleshooting

- **`Conflict: terminated by other getUpdates request` in the log**: another copy of
  the bot is running, usually on a PC. Stop it (step 1).
- **`/trending` shows the same scams every time**: the live site is blocking the
  server, so the bot is using its built-in list. The bot still works. Check with
  `journalctl -u safespace-bot | grep -i trending`.
- **The service won't start**: `journalctl -u safespace-bot -n 50` shows why. It's usually
  a typo in `.env`.
- **"Python is too old"**: the server image is too old. Use Ubuntu 22.04 or newer.
