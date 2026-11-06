#!/usr/bin/env bash
# Day 22 (Q): run-admin-verification.sh — Day 18-20 script'leriyle AYNI altyapı (gerçek Postgres +
# PostgREST + shim + RabbitMQ + Redis + TÜM servisler + gateway). Bu sefer:
#   (1) scripts/create-first-admin.mjs ile İLK admin oluşturulur (seed-test-users KULLANILMAZ),
#   (2) kullanıcı yönetimi akışı (kullanıcı/rol/override/parola/audit) gateway üzerinden,
#   (3) Day 21'den DEVREDEN canlı RBAC matrisi: docs/testing/rbac-matrix.md 5 rol × 11 modül, gerçek JWT'lerle.
# Önkoşullar ve sandbox kısıtları (arka plan süreçleri, `pkill -f` YASAK) run-local-verification.sh başlığındaki gibi.
# Kullanım: bash tests/integration/support/run-admin-verification.sh   Çıktı: /tmp/e2e/admin.progress.log
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="${LOG_DIR:-/tmp/e2e}"
POSTGREST_BIN="${POSTGREST_BIN:-/tmp/postgrest}"
mkdir -p "$LOG"
exec > "$LOG/admin.progress.log" 2>&1
echo "[$(date +%s)] === START ==="

echo "[$(date +%s)] önceki artık süreçleri temizle"
for pid in /proc/[0-9]*; do
  p=${pid#/proc/}
  [ "$p" = "$$" ] && continue
  [ -r "$pid/cmdline" ] || continue
  cmd=$(tr '\0' ' ' < "$pid/cmdline" 2>/dev/null)
  case "$cmd" in
    *"dist/server.js"*|*"postgrest.conf"*|*"supabase-shim.mjs"*) kill -9 "$p" 2>/dev/null ;;
  esac
done
sleep 1

echo "[$(date +%s)] altyapı"
service postgresql status >/dev/null 2>&1 || service postgresql start >/dev/null 2>&1
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --port 6379
rabbitmqctl status >/dev/null 2>&1 || { rabbitmq-server -detached >/dev/null 2>&1; sleep 8; }
rabbitmqctl add_user admin secret >/dev/null 2>&1
rabbitmqctl set_user_tags admin administrator >/dev/null 2>&1
rabbitmqctl set_permissions -p / admin ".*" ".*" ".*" >/dev/null 2>&1

echo "[$(date +%s)] veritabanı (temiz kopya)"
su postgres -c "psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='pms_e2e' AND pid <> pg_backend_pid();\"" >/dev/null 2>&1
su postgres -c "psql -c 'DROP DATABASE IF EXISTS pms_e2e;'" >/dev/null
su postgres -c "psql -c 'CREATE DATABASE pms_e2e;'" >/dev/null
cd "$ROOT/migrations/supabase"
# 012_rls_policies.sql KASITLI OLARAK atlanıyor: auth.uid() kullanıyor, Supabase'e özgü —
# gerçek Supabase olmadan test edilemez (aynı `npm run test:rls`'in skip nedeni, bkz. Day 6+).
for f in 001_identity_tables 002_personnel_tables 003_project_tables 004_procurement_tables \
         005_integration_tables 006_finance_tables 007_performance_tables 008_risk_tables \
         009_notification_tables 010_reporting_tables 011_indexes 014_logger_tables 015_identity_must_change_password 013_seed_data; do
  su postgres -c "psql -d pms_e2e -v ON_ERROR_STOP=1 -q -f $(pwd)/$f.sql" >> "$LOG/migrate.log" 2>&1 \
    || { echo "MIGRATION FAILED: $f"; tail -30 "$LOG/migrate.log"; exit 1; }
done
cat > /tmp/grants.sql << 'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN CREATE ROLE authenticator LOGIN PASSWORD 'authpw' NOINHERIT; END IF;
END $$;
GRANT anon, service_role TO authenticator;
GRANT USAGE ON SCHEMA public TO anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
SQL
su postgres -c "psql -d pms_e2e -f /tmp/grants.sql" >> "$LOG/migrate.log" 2>&1

echo "[$(date +%s)] PostgREST + shim"
JWT_SECRET_PGRST="pgrst-local-secret-must-be-at-least-32-chars-long"
cat > "$LOG/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:authpw@127.0.0.1:5432/pms_e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET_PGRST"
server-host = "127.0.0.1"
server-port = 3100
EOF
SERVICE_KEY=$(cd "$ROOT" && K="$JWT_SECRET_PGRST" node -e "console.log(require('jsonwebtoken').sign({role:'service_role'}, process.env.K))")
echo "$SERVICE_KEY" > "$LOG/service_key.txt"
"$POSTGREST_BIN" "$LOG/postgrest.conf" > "$LOG/postgrest.log" 2>&1 < /dev/null &
node "$ROOT/tests/integration/support/supabase-shim.mjs" > "$LOG/shim.log" 2>&1 < /dev/null &
for i in $(seq 1 10); do
  curl -sf "http://127.0.0.1:54321/rest/v1/identity_roles?select=kod&limit=1" \
    -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" >/dev/null 2>&1 && break
  sleep 0.5
done

echo "[$(date +%s)] ilk admin (create-first-admin.mjs)"
ADMIN_EMAIL="ilk.admin@acme.test"; ADMIN_PASSWORD="Ilk-Admin-Parola-1"
( cd "$ROOT" && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" FIRST_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    node scripts/create-first-admin.mjs --email "$ADMIN_EMAIL" ) || { echo "create-first-admin BAŞARISIZ"; exit 1; }
echo "[$(date +%s)] ikinci çalıştırma reddedilmeli (zaten süper admin var)"
( cd "$ROOT" && SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" FIRST_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    node scripts/create-first-admin.mjs --email "ikinci@acme.test" ) && echo "BEKLENMEDİK: ikinci admin oluştu" || echo "(beklenen red)"

export JWT_SECRET=dev-only-change-me
export RABBITMQ_URL=amqp://admin:secret@localhost:5672
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

echo "[$(date +%s)] servisler başlıyor"
( cd "$ROOT/services/identity-service"    && PORT=3001 REDIS_URL=redis://localhost:6379/0 node dist/server.js > "$LOG/identity.log"    2>&1 < /dev/null & )
( cd "$ROOT/services/personnel-service"   && PORT=3002 REDIS_URL=redis://localhost:6379/1 PROJECT_SERVICE_URL=http://127.0.0.1:3003 node dist/server.js > "$LOG/personnel.log"   2>&1 < /dev/null & )
( cd "$ROOT/services/project-service"     && PORT=3003 REDIS_URL=redis://localhost:6379/2 INTEGRATION_SERVICE_URL=http://127.0.0.1:3005 PERSONNEL_SERVICE_URL=http://127.0.0.1:3002 node dist/server.js > "$LOG/project.log"     2>&1 < /dev/null & )
( cd "$ROOT/services/finance-service"     && PORT=3006 REDIS_URL=redis://localhost:6379/5 INTEGRATION_SERVICE_URL=http://127.0.0.1:3005 PERSONNEL_SERVICE_URL=http://127.0.0.1:3002 node dist/server.js > "$LOG/finance.log"     2>&1 < /dev/null & )
( cd "$ROOT/services/performance-service" && PORT=3007 REDIS_URL=redis://localhost:6379/6 node dist/server.js > "$LOG/performance.log" 2>&1 < /dev/null & )
( cd "$ROOT/services/risk-service"        && PORT=3008 REDIS_URL=redis://localhost:6379/7 node dist/server.js > "$LOG/risk.log"        2>&1 < /dev/null & )
( cd "$ROOT/services/logger-service"      && PORT=3011 REDIS_URL=redis://localhost:6379/10 node dist/server.js > "$LOG/logger.log"      2>&1 < /dev/null & )
( cd "$ROOT/services/procurement-service" && PORT=3004 REDIS_URL=redis://localhost:6379/3 node dist/server.js > "$LOG/procurement.log" 2>&1 < /dev/null & )
( cd "$ROOT/services/integration-service" && PORT=3005 REDIS_URL=redis://localhost:6379/4 node dist/server.js > "$LOG/integration.log" 2>&1 < /dev/null & )
( cd "$ROOT/api-gateway" && PORT=3000 REDIS_URL=redis://localhost:6379/15 CORS_ORIGINS=http://localhost:5173 \
    IDENTITY_SERVICE_URL=http://127.0.0.1:3001 PERSONNEL_SERVICE_URL=http://127.0.0.1:3002 \
    PROCUREMENT_SERVICE_URL=http://127.0.0.1:3004 INTEGRATION_SERVICE_URL=http://127.0.0.1:3005 PROJECT_SERVICE_URL=http://127.0.0.1:3003 FINANCE_SERVICE_URL=http://127.0.0.1:3006 PERFORMANCE_SERVICE_URL=http://127.0.0.1:3007 RISK_SERVICE_URL=http://127.0.0.1:3008 LOGGER_SERVICE_URL=http://127.0.0.1:3011 \
    RATE_LIMIT_MAX=1000 node dist/server.js > "$LOG/gateway.log" 2>&1 < /dev/null & )

for port in 3001 3002 3003 3004 3005 3006 3007 3008 3011 3000; do
  ok=0
  for i in $(seq 1 20); do curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.3; done
  echo "[$(date +%s)] port $port: $([ "$ok" = "1" ] && echo UP || echo DOWN)"
done


echo
echo "=== SENARYOLAR (Admin + canlı RBAC) ==="
GATEWAY=http://127.0.0.1:3000 ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" node "$ROOT/tests/integration/support/live-admin-flow.mjs"
RC=$?
echo
echo "=== SENARYOLAR (Aktivite akışı + system-pulse) ==="
GATEWAY=http://127.0.0.1:3000 ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_PASSWORD="$ADMIN_PASSWORD" node "$ROOT/tests/integration/support/live-activity-flow.mjs"
RC2=$?
[ "$RC" = "0" ] && RC=$RC2
echo "[$(date +%s)] === END (çıkış kodu $RC) ==="
exit $RC
