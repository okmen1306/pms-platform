#!/usr/bin/env bash
# Day 18: Entegrasyon testleri için GERÇEK servis yığınını ayağa kaldırır (api-gateway + identity +
# personnel + procurement + integration). Ön koşullar: RabbitMQ + Redis çalışıyor, yerel
# "Supabase" hazır (Postgres + PostgREST + supabase-shim.mjs), servisler `npm run build` ile
# derlenmiş, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ortamda tanımlı.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG_DIR="${LOG_DIR:-/tmp/e2e}"
mkdir -p "$LOG_DIR"
: "${SUPABASE_URL:?SUPABASE_URL gerekli}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY gerekli}"
export SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
export JWT_SECRET="${JWT_SECRET:-dev-only-change-me}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:5173}"
export RATE_LIMIT_MAX="${RATE_LIMIT_MAX:-1000}"

start() { # ad port dizin
  local name="$1" port="$2" dir="$3"
  ( cd "$ROOT/$dir" && PORT="$port" setsid nohup node dist/server.js > "$LOG_DIR/$name.log" 2>&1 & echo $! >> "$LOG_DIR/pids" )
}
: > "$LOG_DIR/pids"
start identity    3001 services/identity-service
start personnel   3002 services/personnel-service
start procurement 3004 services/procurement-service
start integration 3005 services/integration-service
start gateway     3000 api-gateway

for port in 3001 3002 3004 3005 3000; do
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:$port/health" > /dev/null && break
    sleep 0.5
  done
  curl -sf "http://127.0.0.1:$port/health" > /dev/null || { echo "port $port ayağa kalkmadı, bkz. $LOG_DIR/*.log"; exit 1; }
done
echo "stack hazır (gateway :3000)"
