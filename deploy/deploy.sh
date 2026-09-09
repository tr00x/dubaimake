#!/usr/bin/env bash
# Production deploy for masynbazar.com — run ON THE SERVER as root.
# Usage: bash /var/www/masynbazar/deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/masynbazar
NODE_BIN=/root/.nvm/versions/node/v22.18.0/bin
export PATH="$NODE_BIN:$PATH"
TS=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/root/backups

cd "$APP_DIR"

if [ "${1:-}" != "--continue" ]; then
  echo "==> Backup .env and DB"
  mkdir -p "$BACKUP_DIR"
  cp .env "$BACKUP_DIR/masynbazar-$TS.env"
  cp prisma/dev.db "$BACKUP_DIR/masynbazar-$TS.db" 2>/dev/null || true

  echo "==> Fetch and reset to origin/main"
  git fetch origin
  git reset --hard origin/main
  # .env is untracked since 2026-09-09; a reset from the old tracked state deletes it — restore.
  if [ ! -f .env ]; then cp "$BACKUP_DIR/masynbazar-$TS.env" .env; echo "restored .env"; fi

  # The reset just replaced this very script: continue with the freshly checked-out version.
  exec bash "$APP_DIR/deploy/deploy.sh" --continue
fi

echo "==> Install dependencies"
npm ci --no-audit --no-fund

echo "==> Prisma client + migrations"
npx prisma generate
npx prisma migrate deploy

echo "==> Build frontend"
npm run build

echo "==> Restart backend"
pm2 restart masynbazar-backend --update-env
sleep 3
pm2 describe masynbazar-backend | grep -E "status|restarts|uptime"

echo "==> Smoke"
curl -s -o /dev/null -w "site %{http_code}\n" https://masynbazar.com/
curl -s https://masynbazar.com/api/contact-info; echo
curl -s -o /dev/null -w "challenge %{http_code}\n" https://masynbazar.com/api/contact/challenge
curl -s -o /dev/null -w "contact-no-token %{http_code}\n" -X POST -H 'Content-Type: application/json' -H 'Origin: https://masynbazar.com' \
  -d '{"name":"probe","contact":"+971500000000"}' https://masynbazar.com/api/contact
echo "done"
