#!/usr/bin/env bash
# Pull the latest code, rebuild and restart Paconia. Run from /opt/paconia:  ./deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "No .env — run deploy/bootstrap.sh first."; exit 1; }
export APP_PORT="$(grep -E '^APP_PORT=' .env | cut -d'"' -f2)"; export APP_PORT="${APP_PORT:-3000}"
export POSTGRES_PASSWORD="$(grep -E '^DATABASE_URL=' .env | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')"
if [ -d .git ]; then git pull --ff-only; fi
./deploy/backup.sh || echo "(backup failed — continuing)"
docker compose build web tools
docker compose up -d db
docker compose run --rm tools npx prisma migrate deploy
docker compose up -d web
echo "Deployed. Logs: docker compose logs -f web"
