#!/usr/bin/env bash
# Reproduce backend CI with disposable PostgreSQL; never uses the app's database.
set -euo pipefail
cd "$(dirname "$0")/.."
container="lol-coach-ci-${UID}-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --rm -d --name "$container" \
  -e POSTGRES_USER=lol_ci -e POSTGRES_PASSWORD=local-ci-only \
  -e POSTGRES_DB=lol_ci -p 127.0.0.1::5432 postgres:16-alpine >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U lol_ci -d lol_ci >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo "PostgreSQL de pruebas no inició." >&2; exit 1; fi
published=$(docker port "$container" 5432/tcp)
port="${published##*:}"
export DATABASE_URL="postgres://lol_ci:local-ci-only@127.0.0.1:${port}/lol_ci"
export JWT_SECRET="local-ci-secret-not-for-production"
export FRONTEND_URL="http://localhost:3000"
unset GROQ_API_KEY GEMINI_API_KEY
deno task lint
deno task db:generate
deno task db:migrate
deno task test
