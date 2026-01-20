#!/bin/sh
set -e

# Only run DB-related steps if POSTGRES_PASSWORD is set (Docker mode)
# In cloud mode (Supabase hosted), skip DB wait and migrations
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  echo "[Entrypoint] Docker mode detected, waiting for database..."
  until nc -z "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}" 2>/dev/null; do
    sleep 1
  done
  echo "[Entrypoint] Database is ready"

  echo "[Entrypoint] Running migrations..."
  node /app/migrate.js
else
  echo "[Entrypoint] Cloud mode detected, skipping DB wait and migrations"
fi

# Start Next.js (exec replaces shell with node process)
echo "[Entrypoint] Starting Next.js..."
exec node /app/apps/web/server.js
