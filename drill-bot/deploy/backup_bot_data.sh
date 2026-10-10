#!/usr/bin/env bash
# Daily snapshot of the bot's data (users, scores, chat list).
# Installed as a cron job by setup_server.sh. Keeps KEEP_DAYS days of backups.
#
# These backups live on the same server. If the server is deleted (for example
# when the free trial ends), they go with it, so copy one to your PC now and then:
#   scp root@YOUR_SERVER_IP:/var/backups/safespace-bot/<newest>.tar.gz .
set -euo pipefail

SRC="${BOT_DATA_DIR:-/var/lib/safespace-bot}"
DEST="${BACKUP_DIR:-/var/backups/safespace-bot}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DEST"
chmod 700 "$DEST"   # contains Telegram chat ids and first names
tar -czf "$DEST/bot-data-$(date -u +%Y%m%d-%H%M%S).tar.gz" --exclude='*.tmp' -C "$SRC" .
find "$DEST" -name 'bot-data-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
