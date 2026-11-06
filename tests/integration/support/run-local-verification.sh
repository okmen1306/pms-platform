#!/usr/bin/env bash
# Day 18: bu script, docs ve kod DEĞİL — gerçek Supabase olmadan (CI'da veya bu türden bir kum
# havuzunda) auth + personnel + procurement zincirinin UÇTAN UCA çalıştığını KANITLAMAK için
# yazıldı. `@supabase/supabase-js` PostgREST'in REST sözleşimini konuşur; gerçek Supabase de
# içeride PostgREST kullanır — o yüzden "gerçek Postgres + gerçek PostgREST + ince bir shim"
# gerçek Supabase'in DAVRANIŞÇA eşdeğeridir (bkz. supabase-shim.mjs başlık notu), sahte/mock
# bir DB katmanı DEĞİLDİR.
#
# Önkoşullar: postgresql + redis-server + rabbitmq-server kurulu; PostgREST ikili dosyası
# `$POSTGREST_BIN`'de (varsayılan /tmp/postgrest — bkz. https://postgrest.org/en/stable/releases);
# `npm run build --workspaces` çalıştırılmış (services/*/dist ve api-gateway/dist mevcut).
#
# Kullanım: bash tests/integration/support/run-local-verification.sh
# Çıktı: /tmp/e2e/final.progress.log (bu script'in kendi ilerlemesi) + /tmp/e2e/*.log (her servis).
#
# NOT (kum havuzu kısıtı): arka plana alınan (`&`) süreçler bu script'i çalıştıran tool-call'un
# KENDİSİ bitince öldürülüyor — bu yüzden her şey (altyapı + DB + PostgREST + 5 servis + test
# senaryoları) TEK bir script çalıştırmasında, aynı süreç ağacında yapılıyor. `pkill -f` /
# `pgrep -f` KULLANILMIYOR: bu script'i çalıştıran kabuğun KENDİ komut satırı bu dosyanın tüm
# metnini içerebilir, bu yüzden `-f` (tam komut satırı) eşleşmesi o kabuğun KENDİSİNİ
# öldürebilir (Day 18'de canlı canlı keşfedildi) — süreçler yerine `/proc/*/cmdline` taranarak
# hedefleniyor.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="${LOG_DIR:-/tmp/e2e}"
POSTGREST_BIN="${POSTGREST_BIN:-/tmp/postgrest}"
mkdir -p "$LOG"
exec > "$LOG/final.progress.log" 2>&1
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

echo "[$(date +%s)] test kullanıcıları"
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  node "$ROOT/tests/integration/support/seed-test-users.mjs"

export JWT_SECRET=dev-only-change-me
export RABBITMQ_URL=amqp://admin:secret@localhost:5672
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"

echo "[$(date +%s)] servisler başlıyor"
( cd "$ROOT/services/identity-service"    && PORT=3001 REDIS_URL=redis://localhost:6379/0 node dist/server.js > "$LOG/identity.log"    2>&1 < /dev/null & )
( cd "$ROOT/services/personnel-service"   && PORT=3002 REDIS_URL=redis://localhost:6379/1 node dist/server.js > "$LOG/personnel.log"   2>&1 < /dev/null & )
( cd "$ROOT/services/procurement-service" && PORT=3004 REDIS_URL=redis://localhost:6379/3 node dist/server.js > "$LOG/procurement.log" 2>&1 < /dev/null & )
( cd "$ROOT/services/integration-service" && PORT=3005 REDIS_URL=redis://localhost:6379/4 node dist/server.js > "$LOG/integration.log" 2>&1 < /dev/null & )
( cd "$ROOT/api-gateway" && PORT=3000 REDIS_URL=redis://localhost:6379/15 CORS_ORIGINS=http://localhost:5173 \
    IDENTITY_SERVICE_URL=http://127.0.0.1:3001 PERSONNEL_SERVICE_URL=http://127.0.0.1:3002 \
    PROCUREMENT_SERVICE_URL=http://127.0.0.1:3004 INTEGRATION_SERVICE_URL=http://127.0.0.1:3005 \
    RATE_LIMIT_MAX=1000 node dist/server.js > "$LOG/gateway.log" 2>&1 < /dev/null & )

for port in 3001 3002 3004 3005 3000; do
  ok=0
  for i in $(seq 1 20); do curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1 && { ok=1; break; }; sleep 0.3; done
  echo "[$(date +%s)] port $port: $([ "$ok" = "1" ] && echo UP || echo DOWN)"
done

GW=http://127.0.0.1:3000
echo
echo "=== SENARYOLAR ==="

echo "--- 1) yanlış parola (401 beklenir) ---"
curl -s -w "\n[http %{http_code}]\n" -X POST "$GW/identity/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"yanlis-parola"}'

echo "--- 2) admin girişi (200 + accessToken + Set-Cookie Path=/identity/auth) ---"
curl -s -D "$LOG/login_headers.txt" -o "$LOG/login_body.json" -w "[http %{http_code}]\n" -c "$LOG/cookies.txt" \
  -X POST "$GW/identity/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"Passw0rd!Test"}'
cat "$LOG/login_body.json"; echo
grep -i "^set-cookie" "$LOG/login_headers.txt" || echo "(set-cookie YOK — HATA)"
ADMIN_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).data.accessToken)" "$LOG/login_body.json" 2>/dev/null)
ADMIN_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).data.user.id)" "$LOG/login_body.json" 2>/dev/null)

echo "--- 3) tokensiz korumalı uç (401 beklenir) ---"
curl -s -w "\n[http %{http_code}]\n" "$GW/personnel/employees"

echo "--- 4) token ile personel oluştur (x-actor-id enjeksiyonu) ---"
curl -s -o "$LOG/create_emp.json" -w "[http %{http_code}]\n" -X POST "$GW/personnel/employees" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"ad":"Ayşe","soyad":"Yılmaz","email":"ayse.yilmaz@acme.test","iseBaslamaTarihi":"2026-01-15","maasTl":65000}'
cat "$LOG/create_emp.json"; echo
EMP_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).data.id)" "$LOG/create_emp.json" 2>/dev/null)

echo "--- 5) audit: olusturan_id gerçek admin id mi? (beklenen: $ADMIN_ID) ---"
su postgres -c "psql -d pms_e2e -tc \"select olusturan_id from personnel_employees where id='$EMP_ID'\""

echo "--- 6) admin maaş görür mü (200 beklenir) ---"
curl -s -w "\n[http %{http_code}]\n" "$GW/personnel/employees/$EMP_ID/salary" -H "Authorization: Bearer $ADMIN_TOKEN"

echo "--- 7) personel rolü maaş görmeye çalışır (403 beklenir) ---"
curl -s -o "$LOG/login_personel.json" -w "[http %{http_code}]\n" -X POST "$GW/identity/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"personel@acme.test","password":"Passw0rd!Test"}'
PERSONEL_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).data.accessToken)" "$LOG/login_personel.json" 2>/dev/null)
curl -s -w "\n[http %{http_code}]\n" "$GW/personnel/employees/$EMP_ID/salary" -H "Authorization: Bearer $PERSONEL_TOKEN"

echo "--- 8) malzeme kaydı (integration-service'ten gerçek kur) ---"
RAND_PROJECT=$(node -e "console.log(require('crypto').randomUUID())")
curl -s -w "\n[http %{http_code}]\n" -X POST "$GW/procurement/materials" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$RAND_PROJECT\",\"malzemeTuru\":\"elektronik\",\"malzemeAdi\":\"STM32 geliştirme kartı\",\"adet\":3,\"birimFiyat\":450,\"alimTarihi\":\"2026-09-24\"}"

echo "--- 9) httpOnly refresh cookie ile yeni access token (cookie-path düzeltmesinin kanıtı) ---"
curl -s -w "\n[http %{http_code}]\n" -X POST "$GW/identity/auth/refresh" -b "$LOG/cookies.txt"

echo "--- 10) logout ---"
curl -s -w "\n[http %{http_code}]\n" -X POST "$GW/identity/auth/logout" -b "$LOG/cookies.txt"

echo
echo "[$(date +%s)] === DONE — bkz. $LOG/final.progress.log ==="
