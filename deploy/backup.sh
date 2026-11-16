#!/usr/bin/env bash
# Database + uploaded files backup, kept for 14 days in /opt/paconia/backups.
# Nightly at 2:30 am:  (crontab -l; echo "30 2 * * * /opt/paconia/deploy/backup.sh >> /var/log/paconia-backup.log 2>&1") | crontab -
set -euo pipefail
cd "$(dirname "$0")/.."
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p backups
docker exec paconia-db pg_dump -U paconia -Fc paconia > "backups/db-${STAMP}.dump"
docker run --rm -v paconia_uploads:/data:ro -v "$PWD/backups":/out alpine tar czf "/out/uploads-${STAMP}.tgz" -C /data .
find backups -type f -mtime +14 -delete
echo "Backup done: backups/db-${STAMP}.dump, backups/uploads-${STAMP}.tgz"
# Restore:  docker exec -i paconia-db pg_restore -U paconia -d paconia --clean < backups/db-XXXX.dump
