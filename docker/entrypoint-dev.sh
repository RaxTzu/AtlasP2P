#!/bin/sh
set -e

# ===========================================
# DEVELOPMENT ENTRYPOINT
# ===========================================
# Runs migrations before starting dev server.
# This ensures migrations run automatically
# on first startup for docker-dev mode.
# ===========================================

# Only run DB-related steps if POSTGRES_PASSWORD is set (Docker mode)
# In cloud mode (Supabase hosted), skip DB wait and migrations
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  echo "[Entrypoint-Dev] Docker mode detected, waiting for database..."
  until nc -z "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}" 2>/dev/null; do
    sleep 1
  done
  echo "[Entrypoint-Dev] Database is ready"

  echo "[Entrypoint-Dev] Running migrations..."
  node /app/docker/migrate.js
else
  echo "[Entrypoint-Dev] Cloud mode detected, skipping DB wait and migrations"
fi

# Install any new dependencies (in case pnpm-lock.yaml changed)
echo "[Entrypoint-Dev] Checking dependencies..."
pnpm install

# Start Next.js dev server
echo "[Entrypoint-Dev] Starting Next.js dev server..."
exec pnpm --filter @atlasp2p/web dev --port ${PORT:-4000}
