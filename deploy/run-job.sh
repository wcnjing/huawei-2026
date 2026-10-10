#!/usr/bin/env bash
# Runs the scheduled jobs that Vercel Cron runs in production (see vercel.json),
# against the local server on a Huawei Cloud ECS instance. Called from
# deploy/safespace.cron.
#
#   bash deploy/run-job.sh health-db       # keeps a free Supabase project awake
#   bash deploy/run-job.sh intel-refresh   # daily scam-intel refresh (needs CRON_SECRET)
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/safespace}"
BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

case "${1:-}" in
  health-db)
    curl -fsS --max-time 30 "$BASE_URL/api/health/db" >/dev/null
    echo "health-db ok"
    ;;
  intel-refresh)
    secret="$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "\"' \r" || true)"
    if [ "${#secret}" -lt 32 ]; then
      echo "intel-refresh skipped: set CRON_SECRET (32+ characters) in $APP_DIR/.env"
      exit 0
    fi
    # Header read from a file descriptor so the secret never appears in `ps`.
    curl -fsS --max-time 600 -X POST -H @<(printf 'Authorization: Bearer %s' "$secret") \
      "$BASE_URL/api/intel/refresh" >/dev/null
    echo "intel-refresh ok"
    ;;
  *)
    echo "usage: $0 health-db|intel-refresh" >&2
    exit 2
    ;;
esac
