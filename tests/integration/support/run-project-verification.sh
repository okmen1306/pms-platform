#!/usr/bin/env bash
# Day 19-20: run-local-verification.sh (Day 18) ile AYNI altyapı (gerçek Postgres + PostgREST + shim +
# RabbitMQ + Redis), bu sefer Project modülünün zincirini doğrular: api-gateway -> project-service
# (+ personnel-service ve integration-service'e giden servisler-arası çağrılar). Day 20'de finance,
# performance, risk ve logger-service de ayakta (gateway üzerinden + audit zinciri). Önkoşullar, kum
# havuzu kısıtları (arka plan süreçleri, `pkill -f` YASAK) ve çıktı konumları Day 18 script'inin
# başlık yorumuyla BİREBİR aynı — tekrarlanmadı, bkz. run-local-verification.sh.
#
# Kullanım: bash tests/integration/support/run-project-verification.sh
# Çıktı: /tmp/e2e/project.progress.log + /tmp/e2e/*.log
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="${LOG_DIR:-/tmp/e2e}"
POSTGREST_BIN="${POSTGREST_BIN:-/tmp/postgrest}"
mkdir -p "$LOG"
exec > "$LOG/project.progress.log" 2>&1
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

GW=http://127.0.0.1:3000
echo
echo "=== SENARYOLAR (Project modülü) ==="

# --- yardımcılar: req → HTTP kodunu basar, gövdeyi $LOG/last.json'a yazar ---
req() {
  local m=$1 p=$2 b=${3:-}
  if [ -n "$b" ]; then
    curl -s -o "$LOG/last.json" -w "%{http_code}" -X "$m" "$GW$p" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d "$b"
  else
    curl -s -o "$LOG/last.json" -w "%{http_code}" -X "$m" "$GW$p" -H "Authorization: Bearer $ADMIN_TOKEN"
  fi
}
show() { local code; code=$(req "$@"); echo "[http $code] $(head -c 700 "$LOG/last.json")"; }
jq_() { node -e "const j=JSON.parse(require('fs').readFileSync('$LOG/last.json','utf8'));console.log($1)"; }

echo "--- 1) tokensiz proje listesi (401 beklenir) ---"
curl -s -w "\n[http %{http_code}]\n" "$GW/project/projects"

curl -s -o "$LOG/login_personel.json" -X POST "$GW/identity/auth/login" -H "Content-Type: application/json" -d '{"email":"personel@acme.test","password":"Passw0rd!Test"}'
PERSONEL_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$LOG/login_personel.json','utf8')).data.accessToken)")
echo "--- 2) admin girişi ---"
curl -s -o "$LOG/login_body.json" -w "[http %{http_code}]\n" -X POST "$GW/identity/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.test","password":"Passw0rd!Test"}'
ADMIN_TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$LOG/login_body.json','utf8')).data.accessToken)")
ADMIN_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$LOG/login_body.json','utf8')).data.user.id)")

echo "--- 3) ürün grubu + ürün (katalog) ---"
show POST /project/product-groups '{"ad":"Test Grubu"}'; GROUP_ID=$(jq_ "j.data.id")
show POST /project/products "{\"ad\":\"Test Ürünü\",\"productGroupId\":\"$GROUP_ID\"}"; PRODUCT_ID=$(jq_ "j.data.id")

echo "--- 4) iki personel + bir ekip (personnel-service, gateway üzerinden) ---"
show POST /personnel/employees '{"ad":"Ali","soyad":"Kaya","email":"ali.kaya@acme.test","iseBaslamaTarihi":"2026-01-15","maasTl":50000}'; EMP_A=$(jq_ "j.data.id")
show POST /personnel/employees '{"ad":"Veli","soyad":"Demir","email":"veli.demir@acme.test","iseBaslamaTarihi":"2026-01-15","maasTl":50000}'; EMP_B=$(jq_ "j.data.id")
show POST /personnel/teams '{"ad":"Yazılım Ekibi"}'; TEAM_ID=$(jq_ "j.data.id")

echo "--- 5) proje oluştur (süre integration-service'ten hesaplanır) ---"
show POST /project/projects "{\"projeAdi\":\"Entegrasyon Test Projesi\",\"baslangicTarihi\":\"2026-10-05\",\"bitisTarihi\":\"2026-12-25\",\"productGroupId\":\"$GROUP_ID\",\"productId\":\"$PRODUCT_ID\",\"ekipLideriId\":\"$ADMIN_ID\"}"
PROJECT_ID=$(jq_ "j.data.id")

echo "--- 6) proje detayı + liste ---"
show GET "/project/projects/$PROJECT_ID"
echo "liste kayıt sayısı: $(req GET /project/projects >/dev/null; jq_ 'j.data.length')"

echo "--- 7) üst iş paketleri (Day 5 seed) ---"
req GET /project/master-work-packages >/dev/null
echo "kayıt: $(jq_ 'j.data.length') — ilk: $(jq_ 'JSON.stringify(j.data[0])')"
MASTER_ID=$(jq_ "j.data.find(m=>m.ust_id===null).id")

echo "--- 8) iş paketi planla + listele ---"
show POST "/project/projects/$PROJECT_ID/work-packages" "{\"masterWorkPackageId\":$MASTER_ID,\"baslangicTarihi\":\"2026-10-05\",\"bitisTarihi\":\"2026-11-27\"}"; WP_ID=$(jq_ "j.data.id")
show GET "/project/projects/$PROJECT_ID/work-packages"

echo "--- 9) haftalık kapasite: sınır içi (200) ---"
show POST "/project/projects/$PROJECT_ID/weekly-allocation" "{\"teamId\":\"$TEAM_ID\",\"haftaNo\":1,\"planlananSureHafta\":2}"
echo "--- 10) haftalık kapasite: proje süresini AŞAN (hata beklenir) ---"
show POST "/project/projects/$PROJECT_ID/weekly-allocation" "{\"teamId\":\"$TEAM_ID\",\"haftaNo\":2,\"planlananSureHafta\":999}"
echo "--- 11) haftalık planlama listesi ---"
show GET "/project/projects/$PROJECT_ID/weekly-allocation"

echo "--- 12) çakışma ön-kontrolü (henüz atama yok → hasConflict=false) ---"
show GET "/project/projects/$PROJECT_ID/assignments/conflict-check?employeeId=$EMP_A&baslangicTarihi=2026-10-12&bitisTarihi=2026-10-23"
echo "--- 13) atama oluştur (200) ---"
show POST "/project/projects/$PROJECT_ID/assignments" "{\"workPackageId\":\"$WP_ID\",\"employeeId\":\"$EMP_A\",\"baslangicTarihi\":\"2026-10-12\",\"bitisTarihi\":\"2026-10-23\"}"; ASSIGN_ID=$(jq_ "j.data.id")
echo "--- 14) çakışma ön-kontrolü (şimdi hasConflict=true beklenir) ---"
show GET "/project/projects/$PROJECT_ID/assignments/conflict-check?employeeId=$EMP_A&baslangicTarihi=2026-10-20&bitisTarihi=2026-10-30"
echo "--- 15) ÇAKIŞAN atama (409 + ASSIGNMENT_CONFLICT beklenir — DB EXCLUDE kısıtı) ---"
show POST "/project/projects/$PROJECT_ID/assignments" "{\"workPackageId\":\"$WP_ID\",\"employeeId\":\"$EMP_A\",\"baslangicTarihi\":\"2026-10-20\",\"bitisTarihi\":\"2026-10-30\"}"
echo "--- 16) AYNI personel, çakışmayan tarih (200) + başka personel aynı tarih (200) ---"
show POST "/project/projects/$PROJECT_ID/assignments" "{\"workPackageId\":\"$WP_ID\",\"employeeId\":\"$EMP_A\",\"baslangicTarihi\":\"2026-10-26\",\"bitisTarihi\":\"2026-11-06\"}"
show POST "/project/projects/$PROJECT_ID/assignments" "{\"workPackageId\":\"$WP_ID\",\"employeeId\":\"$EMP_B\",\"baslangicTarihi\":\"2026-10-12\",\"bitisTarihi\":\"2026-10-23\"}"
echo "--- 17) atama listesi (3 beklenir) ---"
req GET "/project/projects/$PROJECT_ID/assignments" >/dev/null; echo "kayıt: $(jq_ 'j.data.length')"
echo "--- 18) atamayı tamamla (PATCH) ---"
show PATCH "/project/assignments/$ASSIGN_ID/complete" '{}'

echo "--- 19) kilometre taşı + iş taslağı ---"
show POST "/project/projects/$PROJECT_ID/milestones" '{"tarih":"2026-11-02","baslik":"Prototip teslimi","emailGonderilsin":true,"hedefGruplar":[]}'
show GET "/project/projects/$PROJECT_ID/milestones"
show POST "/project/projects/$PROJECT_ID/work-draft" "{\"workPackageId\":\"$WP_ID\",\"haftaNo\":1,\"boyali\":true}"
show GET "/project/projects/$PROJECT_ID/work-draft"

echo "--- 20) audit/actor zinciri: project.created_by gerçek admin id mi? (beklenen: $ADMIN_ID) ---"
su postgres -c "psql -d pms_e2e -tc \"select created_by from project_projects where id='$PROJECT_ID'\""

echo "--- 21) tarayıcı CORS ön-uçuşu (preflight): PATCH (atama tamamlama) ---"
curl -s -D - -o /dev/null -X OPTIONS "$GW/project/assignments/$ASSIGN_ID/complete" \
  -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: PATCH" -H "Access-Control-Request-Headers: authorization,content-type" | grep -i "^HTTP\|^access-control"
echo "--- 22) tarayıcı CORS ön-uçuşu: DELETE (alt iş paketi silme) ---"
curl -s -D - -o /dev/null -X OPTIONS "$GW/project/sub-work-packages/$ASSIGN_ID" \
  -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: DELETE" -H "Access-Control-Request-Headers: authorization" | grep -i "^HTTP\|^access-control"


echo "=== DAY 20 SENARYOLARI ==="
jqf() { node -e "const j=JSON.parse(require('fs').readFileSync('$LOG/last.json','utf8'));console.log($1)"; }

echo "--- 24) PATCH /projects/:id: yalnızca ad (200, süre değişmez) ---"
show PATCH "/project/projects/$PROJECT_ID" '{"projeAdi":"Entegrasyon Test Projesi v2"}'
echo "--- 25) PATCH: boş gövde (422) ---"
show PATCH "/project/projects/$PROJECT_ID" '{}'
echo "--- 26) PATCH: bitiş başlangıçtan önce (422) ---"
show PATCH "/project/projects/$PROJECT_ID" '{"bitisTarihi":"2026-09-01"}'
echo "--- 27) PATCH: süreyi 1 haftaya KISALT — ekibin planlaması (2 hafta) sığmaz → 409 WEEKLY_CAPACITY_EXCEEDED, kayıt değişmemeli ---"
show PATCH "/project/projects/$PROJECT_ID" '{"bitisTarihi":"2026-10-09"}'
req GET "/project/projects/$PROJECT_ID" >/dev/null; echo "sure_hafta sonra (12 kalmalı): $(jqf 'j.data.sure_hafta') bitis: $(jqf 'j.data.bitis_tarihi')"
echo "--- 28) PATCH: bitişi UZAT → süre yeniden hesaplanır (200, sure_hafta artar) ---"
show PATCH "/project/projects/$PROJECT_ID" '{"bitisTarihi":"2027-01-15"}'
echo "--- 29) PATCH: olmayan proje (404) ---"
show PATCH "/project/projects/00000000-0000-4000-8000-000000000000" '{"projeAdi":"Olmayan Proje"}'

echo "--- 29b) İKİNCİ proje + EMP_A'ya orada da atama (çapraz-proje takvimi için) ---"
show POST /project/projects "{\"projeAdi\":\"İkinci Test Projesi\",\"baslangicTarihi\":\"2026-12-01\",\"bitisTarihi\":\"2027-02-26\",\"productGroupId\":\"$GROUP_ID\",\"productId\":\"$PRODUCT_ID\",\"ekipLideriId\":\"$ADMIN_ID\"}"; PROJECT2_ID=$(jq_ "j.data.id")
show POST "/project/projects/$PROJECT2_ID/work-packages" "{\"masterWorkPackageId\":$MASTER_ID,\"baslangicTarihi\":\"2026-12-01\",\"bitisTarihi\":\"2027-01-29\"}"; WP2_ID=$(jq_ "j.data.id")
show POST "/project/projects/$PROJECT2_ID/assignments" "{\"workPackageId\":\"$WP2_ID\",\"employeeId\":\"$EMP_A\",\"baslangicTarihi\":\"2026-12-07\",\"bitisTarihi\":\"2026-12-11\"}"

echo "--- 30) personel takvimi: EMP_A'nın İKİ projedeki TÜM atamaları (3 beklenir: 2 + 1; iki farklı proje adı) ---"
req GET "/project/employees/$EMP_A/calendar" >/dev/null; echo "kayıt: $(jqf 'j.data.length') — proje adları: $(jqf 'JSON.stringify([...new Set(j.data.map(x=>x.proje_adi))].sort())')"
echo "--- 31) takvim aralık filtresi: yalnızca Kasım'la kesişen (1 beklenir: 10-26→11-06) ---"
req GET "/project/employees/$EMP_A/calendar?from=2026-11-01&to=2026-11-30" >/dev/null; echo "kayıt: $(jqf 'j.data.length')"
echo "--- 32) atama listesi ?employeeId= filtresi: EMP_B (1 beklenir) / filtresiz (3: A×2 + B×1; 2. projedeki atama bu projeye ait değil) ---"
req GET "/project/projects/$PROJECT_ID/assignments?employeeId=$EMP_B" >/dev/null; echo "EMP_B: $(jqf 'j.data.length')"
req GET "/project/projects/$PROJECT_ID/assignments" >/dev/null; echo "hepsi: $(jqf 'j.data.length')"

echo "--- 33) personnel deactivate: atanmış EMP_B pasife alınır (200) — project-service'e REST çağrısı yapılmış olmalı ---"
show PATCH "/personnel/employees/$EMP_B/deactivate" '{}'
sleep 2
echo "project-service günlüğünde calendar çağrısı: $(grep -c "employees/$EMP_B/calendar" "$LOG/project.log")"
echo "audit (logger-service): $(su postgres -c "psql -d pms_e2e -tAc \"select severity||' | '||ozet from logger_audit_events where entity_id='$EMP_B' and ozet like '%pasife%' order by created_at desc limit 1\"")"
echo "--- 34) ATANMAMIŞ yeni personel pasife alınır → severity info beklenir ---"
show POST /personnel/employees '{"ad":"Zeki","soyad":"Boş","email":"zeki.bos@acme.test","iseBaslamaTarihi":"2026-01-15","maasTl":40000}'; EMP_C=$(jq_ "j.data.id")
show PATCH "/personnel/employees/$EMP_C/deactivate" '{}'
sleep 2
echo "audit: $(su postgres -c "psql -d pms_e2e -tAc \"select severity||' | '||ozet from logger_audit_events where entity_id='$EMP_C' and ozet like '%pasife%' order by created_at desc limit 1\"")"
echo "--- 35) project.update audit kaydı (UPDATE, entity=project_projects) ---"
echo "audit: $(su postgres -c "psql -d pms_e2e -tAc \"select event_type||' | '||ozet from logger_audit_events where entity_id='$PROJECT_ID' and event_type='UPDATE' order by created_at desc limit 1\"")"

echo "--- 36) FINANCE gateway'den: admin (süper admin) → /finance/projects/:id/costs ---"
show GET "/finance/projects/$PROJECT_ID/costs"
echo "--- 37) FINANCE: personel (izinsiz) → 403 beklenir ---"
curl -s -o "$LOG/last.json" -w "[http %{http_code}] " "$GW/finance/projects/$PROJECT_ID/costs" -H "Authorization: Bearer $PERSONEL_TOKEN"; head -c 300 "$LOG/last.json"; echo
echo "--- 38) FINANCE: haftalık AR-GE dökümü ---"
show GET "/finance/projects/$PROJECT_ID/personnel-weekly-cost"

echo "--- 39) PERFORMANCE: kriter yok (seed'de HİÇ kriter yok — bkz. CHANGELOG G-19) → oluştur → puan yaz/oku ---"
show GET /performance/criteria
show POST /performance/criteria '{"ad":"Kalite","agirlikYuzdesi":60}'
show GET /performance/criteria; CRIT_ID=$(jq_ "j.data[0]?.id ?? ''")
show POST "/performance/projects/$PROJECT_ID/employees/$EMP_A/scores" "{\"criterionId\":\"$CRIT_ID\",\"puan\":80}"
show GET "/performance/projects/$PROJECT_ID/employees/$EMP_A/scores"
echo "--- 40) PERFORMANCE: aralık dışı puan 150 (422 beklenir) ---"
show POST "/performance/projects/$PROJECT_ID/employees/$EMP_A/scores" "{\"criterionId\":\"$CRIT_ID\",\"puan\":150}"

echo "--- 41) RISK: oluştur → listele → durum → tam güncelle → sil ---"
show POST "/risk/projects/$PROJECT_ID/risks" '{"riskAdi":"Tedarik gecikmesi","olasilik":3,"etki":4,"aciklama":"Test","azaltmaStratejisi":"Alternatif tedarikçi"}'; RISK_ID=$(jq_ "j.data.id")
show GET "/risk/projects/$PROJECT_ID/risks"
show PATCH "/risk/risks/$RISK_ID" '{"durum":"izleniyor"}'
show PATCH "/risk/risks/$RISK_ID" '{"riskAdi":"Tedarik gecikmesi (güncel)","olasilik":2}'
show DELETE "/risk/risks/$RISK_ID"

echo "--- 42) INTEGRATION: kur kaydı ekle (TCMB cron'u bu ortamda yok) → /integration/exchange-rate/current + business-days ---"
su postgres -c "psql -d pms_e2e -qc \"insert into integration_exchange_rates(tarih, usd_try, kaynak) values (current_date, 41.25, 'test') on conflict (tarih) do update set usd_try=41.25\""
show GET /integration/exchange-rate/current
show GET "/integration/business-days?start=2026-10-05&end=2026-11-27"

echo "--- 43) ürün kataloğu: grup + gruba göre ürünler ---"
show GET /project/product-groups
show GET "/project/products?groupId=$GROUP_ID"

echo "--- 44) proje listesi + filtreler (durum, ekipLideriId) ---"
req GET "/project/projects" >/dev/null; echo "hepsi: $(jqf 'j.data.length')"
req GET "/project/projects?durum=yeni" >/dev/null; echo "durum=yeni: $(jqf 'j.data.length')"
req GET "/project/projects?durum=tamamlandi" >/dev/null; echo "durum=tamamlandi: $(jqf 'j.data.length')"
req GET "/project/projects?ekipLideriId=$ADMIN_ID" >/dev/null; echo "lider=admin: $(jqf 'j.data.length')"

echo "--- 45) alt iş paketi CRUD + CORS PATCH/DELETE ön-uçuşu (gateway) ---"
show POST "/project/work-packages/$WP_ID/sub-work-packages" '{"ad":"Alt kırılım A","baslangicHafta":1,"bitisHafta":2}'; SUB_ID=$(jq_ "j.data.id")
show PATCH "/project/sub-work-packages/$SUB_ID" '{"ad":"Alt kırılım A (düzenlendi)"}'
show GET "/project/work-packages/$WP_ID/sub-work-packages"
curl -s -D - -o /dev/null -X OPTIONS "$GW/project/sub-work-packages/$SUB_ID" -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: DELETE" | grep -i "^HTTP\|allow-methods"
show DELETE "/project/sub-work-packages/$SUB_ID"
echo
echo "--- 23) web/src/features/projects/project.api.ts'in KENDİ fonksiyonları canlı gateway'e karşı (vitest sözleşme testi) ---"
( cd "$ROOT" && GATEWAY_URL="$GW" ADMIN_EMAIL=admin@acme.test ADMIN_PASSWORD='Passw0rd!Test' \
    PROJECT_ID="$PROJECT_ID" WP_ID="$WP_ID" EMP_A="$EMP_A" TEAM_ID="$TEAM_ID" PROJECT2_ID="$PROJECT2_ID" GROUP_ID="$GROUP_ID" PRODUCT_ID="$PRODUCT_ID" LEADER_ID="$ADMIN_ID" CRIT_ID="$CRIT_ID" PERSONEL_TOKEN="$PERSONEL_TOKEN" PROJECT_WEEKS="$(req GET /project/projects/$PROJECT_ID >/dev/null; jq_ 'j.data.sure_hafta')" \
    npx vitest run tests/integration/web-contract.live.test.ts 2>&1 | grep -v '^{"level"' | tail -40 )

echo
echo "[$(date +%s)] === DONE — bkz. $LOG/project.progress.log ==="
