# Güvenlik Taraması — Gün Gün Kümülatif

Bu doküman, `docs/roadmap.md` Bölüm 14.2'deki üç güvenlik taraması gününün (Day 12 başlangıç,
Day 16 tamamlama, Day 28 ikinci tur, Day 43 son doğrulama) bulgularını ve kararlarını kaydeder —
`docs/testing/rls-test-plan.md`'nin (Day 6) aynı "gün gün kümülatif" formatında.

## Nasıl çalışır

`npm run security:audit` (kök dizinde) tek bir kilit dosyası (`package-lock.json`) üzerinden TÜM
workspace'lerin bağımlılıklarını `npm audit --audit-level=moderate` ile tarar. CI'daki
`security-scan` işi bunu her push'ta çalıştırır (bkz. `.github/workflows/ci.yml`).

## Day 12 — Başlangıç (Q)

İlk gerçek tarama çalıştırıldı (`npm audit --json`, 640 toplam bağımlılık — 216 prod + 425 dev +
diğer). Sonuç: **19 bulgu (4 kritik, 7 yüksek, 8 orta, 0 düşük)**.

| Önem | Paketler |
|---|---|
| Kritik | `@fastify/http-proxy`, `@fastify/reply-from`, `tar`, `vitest` |
| Yüksek | `@mapbox/node-pre-gyp`, `bcrypt`, `fastify`, `find-my-way`, `nodemailer`, `undici`, `vite` |
| Orta | `@vitest/mocker`, `esbuild`, `fast-xml-parser`, `node-cron`, `react-router`, `react-router-dom`, `uuid`, `vite-node` |

**Karar: bugün HİÇBİR paket güncellenmedi.** `npm audit`'in kendi çıktısı doğrulandı —
**bulguların TAMAMI** (19/19) sadece `npm audit fix --force` ile, yani bir **SemVer MAJOR**
sürüm atlamasıyla düzeltilebiliyor: `fastify` (tüm backend'in web çatısı — 11 mikroservis +
api-gateway), `vitest`/`vite` (build/test zinciri), `bcrypt` (parola hash'leme — kırılırsa
identity-service'in kimlik doğrulaması durur), `nodemailer`, `react-router-dom` dahil. Bunların
HİÇBİRİ küçük bir yama değil — her biri kendi göç (migration) planını, regresyon testini ve ayrı
bir günü hak ediyor. Bu yüzden roadmap'in kendi ayrımı (Day 12 "başlangıç" vs Day 16 "tamamlama")
isabetli: bugünün işi TARAMA ALTYAPISINI kurmak (CI job + bu doküman), düzeltmeleri PLANLI bir
şekilde Day 16'da (çapraz kod review turuyla birlikte, roadmap satır 1946) yapmak.

**CI politikası:** `security-scan` işi `continue-on-error: true` ile eklendi — bulgular her
build'de GÖRÜNÜR olur ama pipeline'ı henüz KIRMAZ (mevcut sıfır bulgu yok, 19/19 zaten bilinen ve
plan dahilinde). Day 16'da hangi eşik/severity'nin pipeline'ı durduracağı KARARLAŞTIRILACAK.

**Durum:** Tarandı, temellendirildi (Day 12). Düzeltme: Day 16.

## Day 16 — Tamamlama

Day 12'nin 19 bulgusunun (4 kritik, 7 yüksek, 8 orta) TAMAMI SemVer MAJOR sürüm atlamalarıyla
düzeltildi. `npm audit --json` artık **0 bulgu** döndürüyor (`total: 0` — kritik/yüksek/orta/
düşük hepsi sıfır).

| Paket | Önce | Sonra | Blast radius | Kod değişikliği gerekti mi? |
|---|---|---|---|---|
| `bcrypt` + `@types/bcrypt` | 5.1.1 | 6.0.0 | identity-service (tek çağrı yeri: `bcrypt.compare`) | Hayır |
| `nodemailer` | 6.10.1 | 10.0.10 | notification-service | Hayır (v10 kendi `.d.ts`'ini taşıyor — `@types/nodemailer` KALDIRILDI) |
| `node-cron` | 3.0.3 | 4.6.0 | integration-service, notification-service | Hayır (v4 kendi `.d.ts`'ini taşıyor — `@types/node-cron` KALDIRILDI) |
| `fast-xml-parser` | 4.5.7 | 5.11.1 | integration-service (`tcmb.adapter.ts`) | Hayır — gerçek TCMB-şekilli bir XML örneğiyle manuel doğrulandı, `attributeNamePrefix`/`ignoreAttributes` davranışı AYNI |
| `fastify` | 4.28.1 | 5.12.5 | **12 paket** (11 servis + api-gateway) | **1 dosya**: `shared/utils/error-handler.helper.ts` — `setErrorHandler`'ın generic'i v5'te `unknown`'a varsayılıyor (önceden örtük `FastifyError`'dı); `<FastifyError>` açıkça eklendi |
| `@fastify/cors` | 9.0.1 | 11.3.0 | 12 paket (fastify ile birlikte) | Hayır |
| `@fastify/cookie` | 9.4.0 | 11.1.2 | identity-service | Hayır |
| `@fastify/http-proxy` | 9.5.0 | 11.6.2 | api-gateway | Hayır |
| `@fastify/rate-limit` | 9.1.0 | 11.2.0 | api-gateway | Hayır |
| `vitest` | 2.0.5/2.1.9 | 5.0.1 | **14 paket** (11 servis + api-gateway + web + kök) | **3 dosya**: personnel-service'in Day 15 testleri — `vi.fn()`'in dönüş tipi artık spesifik bir fonksiyon tipine (ör. `AuditPublisherFn`) örtük atanamıyor; `vi.fn<T>()` ile açıkça parametrelendirildi |
| `vite` + `@vitejs/plugin-react` | 5.4.2 / 4.3.1 | 8.3.0 / 6.1.1 | web | Hayır (kod tarafı) — AMA `vite.config.ts` → `vite.config.mts` yeniden adlandırıldı (v8'in "native config loader" uyarısı; `web/package.json`'a `"type":"module"` EKLENMEDİ çünkü `postcss.config.js`/`tailwind.config.js` hâlâ CommonJS) |
| `react-router-dom` (+ `react-router`) | 6.30.6 | 7.18.4 | web | Hayır — zaten `createBrowserRouter`/`RouterProvider` (data-router API'si) kullanılıyordu, v6→v7'nin asıl kırılma yüzeyi (eski `<Routes>`/future-flag geçişi) bu kod tabanına hiç değmedi |

**Gerçek doğrulama, sadece `npm audit`'in "temiz" demesi değil:** her üç yüksek-riskli bumptan
(fastify, api-gateway'in proxy+rate-limit zinciri, react-router-dom) sonra kod GERÇEKTEN
ÇALIŞTIRILDI — `personnel-service` ve `api-gateway` gerçek HTTP sunucusu olarak ayağa kaldırıldı,
`/health`, bir 404, bir Zod doğrulama hatası (422) ve api-gateway'in tam zincirinden (cors →
rate-limit → auth middleware, `x-ratelimit-*` başlıklarıyla) geçen bir 401 gerçek `curl`
isteğiyle doğrulandı — sadece `tsc`'nin/testlerin geçmesi değil.

**Yan bulgu (çapraz kod review'un bu turda yakaladığı):** 11 serviste tsconfig `exclude`
listesi TUTARSIZDI — 7 tanesi `src/**/__tests__/**`'i derleme çıktısından (`dist/`) hariç
tutuyordu, 5 tanesi (identity-service, integration-service, personnel-service,
procurement-service, risk-service) tutmuyordu. Zararsız görünen bu tutarsızlık, vitest 5'in
`dist/`'i artık testler için otomatik hariç tutmamasıyla GERÇEK bir hataya dönüştü (derlenmiş
`.test.js` dosyaları CJS olarak `vitest`'i `require()`'lamaya çalışıp patlıyordu). 5 servisin
hepsi düzeltildi — artık 12/12 tutarlı.

**CI politikası kararı:** `security-scan` işindeki `continue-on-error: true` KALDIRILDI (bkz.
`.github/workflows/ci.yml`) — madem sıfır bulgu durumundayız, bundan sonra HERHANGİ bir yeni
bulguda pipeline kırılacak (regresyonu önlemek asıl amaç). Eşik `--audit-level=moderate` olarak
korundu.

**Doğrulama:** `npm run build/test/lint --workspaces --if-present` — sıfır hata, **218/218 test**
(Day 15'le aynı sayı — bu tur sadece bağımlılık sürümü değişti, yeni iş mantığı eklenmedi).
`npm run test:events`: 9/9. `npm run test:cache`: 7/7. `npm run test:rls`: 16 skip. `npm audit`:
**0/19** (tamamı kapatıldı).

**Durum:** Tamamlandı (Day 16). Sıradaki tur: Day 28 (roadmap'in kendi takvimi — yeni
bağımlılıkların o zamana kadar biriktirdiği bulgular için).

## Day 28 — İkinci Tur

Henüz gelmedi.

## Day 43 — Son Doğrulama

Henüz gelmedi.
