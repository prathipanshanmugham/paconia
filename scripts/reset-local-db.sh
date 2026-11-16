#!/usr/bin/env bash
# Local development only: rebuild the database from the migration files and reseed.
set -euo pipefail
cd "$(dirname "$0")/.."
psql -h /tmp -U postgres -q -c "drop database if exists paconia;" -c "create database paconia owner paconia;"
for f in prisma/migrations/*/migration.sql; do psql -h /tmp -U paconia -d paconia -q -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -v NOTICE || true; done
rm -rf uploads
npx tsx prisma/seed.ts
