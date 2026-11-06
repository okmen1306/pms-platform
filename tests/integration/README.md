# tests/integration/

Day 18 (Entegrasyon Haftası, roadmap.md Bölüm 14.5): `web/src/features/{auth,personnel,procurement}`
artık mock DEĞİL, gerçek `api-gateway`'e bağlı. Bu klasör o bağlantının GERÇEKTEN çalıştığını
kanıtlayan araçları barındırır — birim testi DEĞİL, bu yüzden `npm run test` tarafından
ÇALIŞTIRILMAZ (`tests/events/`, `tests/cache/`'in aksine, o ikisi gerçek Vitest paketleri).

## Neden burada bir Vitest paketi yok

Auth + RBAC + proxy zincirini uçtan uca doğrulamak gerçek bir Postgres + PostgREST + 5 backend
servisi + RabbitMQ + Redis ister — bunu her `npm test` çalıştığında otomatik ayağa kaldırmak
(özellikle CI'da PostgREST ikilisini indirmek) bugünün kapsamına göre ağır bir yatırım. Bu yüzden
şimdilik ELLE çalıştırılan, ama TEKRAR ÜRETİLEBİLİR bir script olarak bırakıldı. Otomatik bir CI
işine dönüştürmek (Day 14/15'in `tests/events/`, `tests/cache/` CI işleriyle aynı desende)
ileri bir günün kapsamı olabilir.

## Dosyalar

- `supabase-shim.mjs` — `@supabase/supabase-js`'in konuştuğu `/rest/v1/*` yolunu PostgREST'e
  ileten minik bir HTTP proxy. Gerçek Supabase'in kendisi de içeride PostgREST kullanır; bu
  yüzden bu bir "sahte DB katmanı" değil, gerçek Supabase'in davranışça eşdeğeri.
- `seed-test-users.mjs` — Day 17'nin seed ettiği rollerle 3 test kullanıcısı (`sirket_yoneticisi`,
  `ik_yoneticisi`, `personel`) + bir döviz kuru kaydı ekler. SADECE test veritabanı için.
- `run-local-verification.sh` — Day 18'in kendisini doğrulamak için kullanıldı: temiz DB + 5
  servis + api-gateway'i ayağa kaldırır, 10 gerçek HTTP senaryosu çalıştırır (yanlış parola,
  başarılı login + Set-Cookie, tokensiz erişim reddi, personel oluşturma + audit actor-id zinciri,
  RBAC izin/red, procurement→integration gerçek kur çağrısı, httpOnly refresh cookie, logout).
  Önkoşullar ve kullanım script'in kendi başlık yorumunda.
- `run-project-verification.sh` + `web-contract.live.test.ts` — Day 19-20 (Day 20: finance/performance/risk/logger de ayakta, ~45 senaryo, 15 canlı sözleşme testi): aynı altyapı + project-service;
  Project modülü zincirini (katalog, proje, iş paketi, haftalık kapasite, atama çakışması 409, milestone,
  iş taslağı, CORS ön-uçuşu) 22 HTTP senaryosuyla doğrular, ardından `web/.../project.api.ts`'in kendi
  fonksiyonlarını canlı gateway'e karşı (vitest, 7 test) koşturur. Aynı kullanım:
  `POSTGREST_BIN=/tmp/postgrest bash tests/integration/support/run-project-verification.sh`.
- `start-stack.sh` — GERÇEK bir Supabase projesi (yerel shim değil) yapılandırılmışken sadece
  5 backend servisini + gateway'i ayağa kaldıran daha sade bir yardımcı.

## Bulunan ve düzeltilen gerçek bulgular

`run-local-verification.sh`'i ilk çalıştırmak `POST /identity/auth/login`'in `api-gateway`
üzerinden 404 döndüğünü ortaya çıkardı — `api-gateway/src/proxy/service-proxy.ts`'in
`rewritePrefix: ''` kuralı `/identity/auth`'a da uygulanmıştı, ama identity-service'in gerçek
rotası `/auth/login` (`/login` değil). Mock login bu path'i hiç denemediği için Day 5'ten beri
fark edilmemişti. Düzeltme: `registerServiceProxy` artık opsiyonel bir `rewritePrefix` alıyor,
identity.routes.ts kendi `/auth`'unu geçiyor. Ayrıca identity-service'in refresh cookie `Path`'i
(`/auth` idi) tarayıcının GERÇEKTE gördüğü yola (`/identity/auth`) göre düzeltildi — aksi hâlde
refresh cookie'si hiçbir zaman `/identity/auth/refresh`'e gönderilmezdi. İkisi de CHANGELOG.md
Day 18'de detaylı.

## Day 19 bulgusu

`run-project-verification.sh`'in CORS ön-uçuşu adımı, gateway'in yalnızca `GET,HEAD,POST` izin
verdiğini ortaya çıkardı: tarayıcıdan `PATCH` (atama tamamlama) ve `DELETE` (alt iş paketi silme)
engellenirdi. Mock'lar ve curl CORS'a takılmaz, bu yüzden Day 6'dan beri görünmemişti. Düzeltme
`api-gateway/src/app.ts`'te, regresyon testi `gateway.integration.test.ts`'te (CHANGELOG.md Day 19).

## Day 22 (devam 3): aktivite akışı canlı doğrulaması

`run-admin-verification.sh` iki betik koşar: `live-admin-flow.mjs` (kullanıcı yönetimi + 105 hücrelik RBAC matrisi) ve
`live-activity-flow.mjs` (SSE akışı gateway üzerinden, `system-pulse`, denetim detayı, yetki kapıları, kopma sonrası tamamlama).
Kurulum (sandbox): `apt-get install postgresql redis-server rabbitmq-server` + PostgREST 12.2.3 ikilisi
(`postgrest-v12.2.3-linux-static-x64.tar.xz`, GitHub releases) → `POSTGREST_BIN=/tmp/postgrest bash tests/integration/support/run-admin-verification.sh`.
Önce `npm run build` gerekir (servisler `dist/server.js` ile başlar). Bu koşu, birim testlerinin göremediği bir hatayı yakaladı
(identity audit olaylarında `actorEmail: null` → akışta admin "sistem" görünüyordu); bkz. CHANGELOG "Day 22 devamı 3".

