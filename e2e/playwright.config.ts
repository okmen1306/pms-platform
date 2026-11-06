import { defineConfig, devices } from '@playwright/test';

/**
 * Q (Day 8): "Playwright E2E altyapı kurulumu" (bkz. docs/roadmap.md Bölüm 14.2 Day 8 satırı;
 * Bölüm "Teknoloji Yığını": Vitest + React Testing Library + Playwright).
 *
 * BİLİNÇLİ KAPSAM SINIRI: bu konfigürasyon SADECE `web`'in Vite dev sunucusunu ayağa kaldırır —
 * api-gateway/backend servisleri veya RabbitMQ/Redis/Supabase'i DEĞİL. Supabase kurulumu
 * bilinçli olarak projenin sonuna bırakıldığından (bkz. README.md, docker-compose.yml'in kendi
 * notu) gerçek bir "login" akışı Playwright'ta bugün hâlâ test edilemez.
 *
 * Day 18 düzeltmesi: bu yorum ÖNCEDEN "Day 10'da eklenecek" diyordu — o gün geldi geçti,
 * eklenmedi (gerçek Supabase o zaman da yoktu, şimdi de yok). Day 18'de `web`'in auth/personnel/
 * procurement modülleri GERÇEKTEN api-gateway'e bağlandı ve bu zincirin çalıştığı kanıtlandı
 * (bkz. tests/integration/README.md — gerçek Postgres+PostgREST+5 servise karşı script tabanlı
 * doğrulama) — ama Playwright'ın kendisi hâlâ bu yığına dokunmuyor, çünkü bu `webServer` listesi
 * hâlâ sadece `web`'i başlatıyor. İlk gerçek E2E login senaryosu, gün numarası verilmeden,
 * gerçek bir Supabase projesi bağlanana kadar açık bırakıldı.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // `E2E_BASE_URL` verilmişse (örn. CI'da zaten ayakta bir önizleme ortamına karşı çalıştırmak
  // için) sunucuyu KENDİMİZ başlatmayız — sadece verilen URL'e karşı test ederiz.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -w web',
        cwd: '..',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
