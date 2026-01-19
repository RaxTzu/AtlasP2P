#!/bin/sh
set -e

# Wait for database to be ready
echo "[Entrypoint] Waiting for database..."
until nc -z "${POSTGRES_HOST:-db}" "${POSTGRES_PORT:-5432}" 2>/dev/null; do
  sleep 1
done
echo "[Entrypoint] Database is ready"

# Run migrations
echo "[Entrypoint] Running migrations..."
node /app/migrate.js

# Start Next.js (exec replaces shell with node process)
echo "[Entrypoint] Starting Next.js..."
exec node /app/apps/web/server.js
