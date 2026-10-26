#!/usr/bin/env bash
# Builds, starts the app in zero-service mode with dev login, runs the smoke test, then stops it.
set -euo pipefail
PORT="${PORT:-3210}"
export AUTH_DEV_LOGIN=1 AUTH_SECRET=e2e-secret PERSISTENCE=memory LIVE_STORE="${LIVE_STORE:-memory}" REALTIME=none
[ -n "${REDIS_URL:-}" ] && export LIVE_STORE=redis
# AUTH_DEV_LOGIN is ignored in production builds, so run the dev server.
# Own process group so the whole next dev tree (incl. next-server) is stopped on exit.
setsid npx next dev -p "$PORT" >"${TMPDIR:-/tmp}/squiz-e2e.log" 2>&1 &
SERVER=$!
trap 'kill -- -$SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "localhost:$PORT/api/health" >/dev/null && break; sleep 1; done
BASE_URL="http://localhost:$PORT" node scripts/e2e-smoke.mjs
