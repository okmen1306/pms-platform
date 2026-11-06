# Yük Testi (Q, Day 13 — "temel senaryo")

`docs/roadmap.md` Bölüm 14.2: Day 13 = **temel senaryo**, Day 26 = **ikinci yük testi**
(sorgu optimizasyonuyla birlikte). Bu paket npm workspaces'in **dışındadır** — `e2e/` ile
aynı sebeple: `autocannon`'ın bağımlılık ağacı hiçbir servisin runtime'ına dahil değil.

## İki farklı komut, iki farklı amaç

### `npm test` — self-test (CI'da GERÇEKTEN çalışır)

`scenarios/__tests__/basic-scenario.selftest.test.mjs`, harness'ın kendi mantığını
(`summarize`, `compareRateLimiting`, `runBasicScenario`) yerel bir `node:http` stub
sunucusuna karşı doğrular. Gerçek backend'e **hiç dokunmaz** — Day 8'in Playwright duman
testiyle (`smoke.spec.ts`) aynı desen: "yapı çalışıyor" kanıtı, "sistem hazır" kanıtı değil.
Bu yüzden CI'ya normal (ne `continue-on-error`, ne `if: false`) bir iş olarak eklendi.

### `npm run scenario` — gerçek yük testi (canlı bir kümeye ihtiyaç duyar)

```bash
LOADTEST_BASE_URL=http://localhost:3000 LOADTEST_DURATION_SECONDS=30 LOADTEST_CONNECTIONS=50 npm run scenario
```

api-gateway'e (varsayılan `http://localhost:3000`) karşı iki faz çalıştırır:

1. `GET /health` — genel yük.
2. `POST /identity/auth/login` (bilerek yanlış şifre) — brute-force senaryosu.

Sonunda **Güvenlik Kontrol Listesi**'nin (roadmap.md satır 1824) hâlâ işaretsiz maddesini
doğrudan test eder: *"Rate limiting: `/auth/login` özelinde daha sıkı (brute-force önleme)."*
İki fazın 429 sayıları karşılaştırılır — bkz. `docs/testing/load-test-plan.md`.

**Bu kum havuzunda çalıştırılamaz** (Redis + RabbitMQ + Supabase gerektirir, hiçbiri yok) —
gerçek sonuçlar Day 18 Entegrasyon Haftası'nda veya bir staging ortamında üretilecek.

## Eşikler (Day 13 — "temel", Day 26'da sıkılaştırılacak)

| Metrik | Eşik |
|---|---|
| p97.5 gecikme | ≤ 300ms |
| Hata oranı (5xx + timeout + non-2xx) | ≤ %1 |

`autocannon` tam bir p95 sağlamıyor (p90/p97.5/p99 var) — p97.5, p95'e en yakın üst-persentil
olarak kullanıldı; bu bilinçli bir yaklaşıklık, gizlenmedi.
