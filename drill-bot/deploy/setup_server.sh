#!/usr/bin/env bash
# One-shot setup for the SafeSpace Telegram drill bot on a Huawei Cloud server
# (Ubuntu 22.04 or newer recommended). Safe to run again after updates.
#
#   sudo bash drill-bot/deploy/setup_server.sh
#
# What it does:
#   1. Installs Python and the bot's packages in drill-bot/.venv
#   2. Creates drill-bot/.env from .env.example the first time (then stops so
#      you can paste in BOT_TOKEN)
#   3. Moves stats.json / known_chats.json you copied from your PC into the
#      data folder, so existing users and scores carry over
#   4. Installs and starts the bot as a service that restarts by itself
#   5. Adds a daily backup of the bot's data
set -euo pipefail

BOT_USER="safespace"
DATA_DIR="/var/lib/safespace-bot"
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_SRC="$BOT_DIR/deploy/safespace-bot.service"
SERVICE_DST="/etc/systemd/system/safespace-bot.service"

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Run this with sudo:  sudo bash $0"
command -v systemctl >/dev/null || fail "This server has no systemd; use an Ubuntu 22.04+ image."
case "$BOT_DIR" in *" "*) fail "The code folder path has a space in it ($BOT_DIR). Clone it to /opt/safespace instead.";; esac

# --- 1. Python --------------------------------------------------------------
say "Installing Python"
if command -v apt-get >/dev/null; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-venv python3-pip >/dev/null
elif command -v dnf >/dev/null; then
  dnf install -y -q python3 python3-pip >/dev/null
else
  fail "Unknown package manager. Install Python 3.10+ yourself, then re-run."
fi
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' \
  || fail "Python $(python3 -V 2>&1) is too old; the bot needs 3.10+. Use an Ubuntu 22.04+ image."

# --- 2. Bot user ------------------------------------------------------------
if ! id "$BOT_USER" >/dev/null 2>&1; then
  say "Creating system user '$BOT_USER'"
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$BOT_USER"
fi

# --- 3. Packages ------------------------------------------------------------
say "Installing the bot's Python packages"
[ -d "$BOT_DIR/.venv" ] || python3 -m venv "$BOT_DIR/.venv"
"$BOT_DIR/.venv/bin/pip" install -q --upgrade pip
"$BOT_DIR/.venv/bin/pip" install -q -r "$BOT_DIR/requirements.txt"

# --- 4. Settings ------------------------------------------------------------
ENV_FILE="$BOT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp "$BOT_DIR/.env.example" "$ENV_FILE"
  chown "$BOT_USER:$BOT_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  fail "Created $ENV_FILE. Open it (nano $ENV_FILE), paste your BOT_TOKEN and OPENAI_API_KEY, then run this script again."
fi
chown "$BOT_USER:$BOT_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
if ! grep -Eq '^BOT_TOKEN=[0-9]+:' "$ENV_FILE"; then
  fail "BOT_TOKEN in $ENV_FILE is missing or still the placeholder. Paste the token from @BotFather and run again."
fi

# --- 5. Data folder + carry over data from the PC ---------------------------
say "Preparing data folder $DATA_DIR"
install -d -m 750 -o "$BOT_USER" -g "$BOT_USER" "$DATA_DIR"
for f in stats.json known_chats.json; do
  if [ -f "$BOT_DIR/$f" ]; then
    if [ -f "$DATA_DIR/$f" ]; then
      echo "   $DATA_DIR/$f already exists; leaving $BOT_DIR/$f untouched (delete it if it's an old copy)"
    else
      mv "$BOT_DIR/$f" "$DATA_DIR/$f"
      echo "   moved $f from your PC copy into the data folder"
    fi
  fi
done
# People in an imported chat list already got the welcome on the PC, so mark
# them as welcomed. The first cloud start then sends nobody a duplicate.
if [ -f "$DATA_DIR/known_chats.json" ] && [ ! -f "$DATA_DIR/welcomed_chats.json" ]; then
  cp "$DATA_DIR/known_chats.json" "$DATA_DIR/welcomed_chats.json"
  echo "   marked $(python3 -c "import json;print(len(json.load(open('$DATA_DIR/known_chats.json'))))") existing chat(s) as already welcomed"
fi
chown -R "$BOT_USER:$BOT_USER" "$DATA_DIR"

# --- 6. Service -------------------------------------------------------------
say "Installing and starting the safespace-bot service"
sed -e "s#/opt/safespace/drill-bot#$BOT_DIR#g" -e "s#^User=.*#User=$BOT_USER#" \
    -e "s#^Group=.*#Group=$BOT_USER#" "$SERVICE_SRC" > "$SERVICE_DST"
systemctl daemon-reload
systemctl enable safespace-bot >/dev/null 2>&1
systemctl restart safespace-bot

# --- 7. Daily backup --------------------------------------------------------
cat > /etc/cron.d/safespace-bot-backup <<CRON
# Daily backup of the SafeSpace bot's data (added by setup_server.sh)
30 3 * * * root bash $BOT_DIR/deploy/backup_bot_data.sh 2>&1 | logger -t safespace-bot-backup
CRON
chmod 644 /etc/cron.d/safespace-bot-backup

sleep 5
if systemctl is-active --quiet safespace-bot; then
  say "Done. The bot is running."
else
  journalctl -u safespace-bot -n 30 --no-pager || true
  fail "The bot didn't start. The log above usually says why."
fi
journalctl -u safespace-bot -n 8 --no-pager -o cat || true
cat <<MSG

Next:
  - Send /start to the bot in Telegram to check it replies.
  - Make sure the bot is NOT still running on anyone's PC. Two copies with one
    token cause "Conflict: terminated by other getUpdates request" in the log.
  - Live log:   journalctl -u safespace-bot -f
  - Restart:    sudo systemctl restart safespace-bot
MSG
