# Yük Testi — Gün Gün Kümülatif

Bu doküman, `docs/roadmap.md` Bölüm 14.2'deki iki yük testi gününün (Day 13 temel senaryo,
Day 26 ikinci tur) bulgularını ve kararlarını kaydeder — `docs/security/audit-baseline.md`'nin
(Day 12) AYNI "gün gün kümülatif" formatında.

## Nasıl çalışır

`loadtest/` (npm workspaces DIŞINDA, `e2e/` ile aynı sebeple — bkz. `loadtest/README.md`)
`autocannon` ile api-gateway'e karşı iki fazlı bir senaryo çalıştırır: genel yük (`GET
/health`) ve brute-force senaryosu (`POST /identity/auth/login`). CI'daki `load-test-self-check`
işi (bkz. `.github/workflows/ci.yml`) sadece harness'ın KENDİ mantığını yerel bir stub sunucuya
karşı doğrular — gerçek sonuç üretmez.

## Day 13 — Temel Senaryo (Q)

**Bu kum havuzunda gerçek bir çalıştırma yapılamadı** — Redis (rate limiting), RabbitMQ ve
Supabase'in hiçbiri bu ortamda yok. `docs/security/audit-baseline.md`'nin Day 12 kararıyla AYNI
disiplin: bugünün işi ALTYAPIYI (harness + self-test + CI job + bu doküman) kurmak, GERÇEK
ölçümü canlı bir kümeye (Day 18 Entegrasyon Haftası veya bir staging ortamı) bırakmak.

**Harness ile birlikte doğrulanan/belgelenen bir bulgu:** Güvenlik Kontrol Listesi'nin
(roadmap.md satır 1824) *"Rate limiting: `/auth/login` özelinde daha sıkı (brute-force
önleme)"* maddesi kod okumasıyla (statik) doğrulandı — `api-gateway/src/middleware/
rate-limit.middleware.ts` (Day 3) **TEK** bir genel IP-bazlı limit uygular (100 istek/60s,
Redis-backed) ve `/auth/login`'e özel/daha sıkı bir limit **YOK**. `basic-scenario.mjs`'in
2. fazı (`compareRateLimiting`) bunu bir canlı kümeye karşı çalıştırıldığında DİNAMİK olarak da
doğrulayacak şekilde yazıldı (health ile login'in 429 eşiği aynı çıkarsa madde hâlâ
karşılanmamış demektir) — ama bugün sadece STATİK kod okumasıyla doğrulandı, DİNAMİK ölçüm
henüz yok.

**Eşikler (temel/geçici):** p97.5 gecikme ≤ 300ms, hata oranı ≤ %1 (bkz. `loadtest/README.md`).
Bu sayılar hiçbir gerçek ölçümle KALİBRE edilmedi — Day 26'da ilk gerçek çalıştırmanın
sonuçlarıyla güncellenecek.

**Durum:** Harness + self-test hazır ve CI'da yeşil (bkz. `load-test-self-check` işi). Gerçek
ölçüm ve `/auth/login` bulgusunun dinamik doğrulaması: Day 18 / staging.

## Day 26 — İkinci Tur

Henüz gelmedi.
