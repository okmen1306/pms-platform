import { test, expect } from '@playwright/test';

/**
 * Q (Day 8): bu, gerçek bir iş senaryosu DEĞİL — sadece Playwright harness'ının (webServer
 * otomatik başlatma, tarayıcı otomasyonu, baseURL yönlendirmesi) uçtan uca ÇALIŞTIĞINI
 * kanıtlayan bir duman testi. Bilinçli olarak backend'e HİÇ dokunmuyor (bkz. playwright.config.ts
 * başındaki not) — giriş sayfası tamamen istemci tarafında render olduğu için bu, bugün için
 * doğru seviyede bir test.
 *
 * Day 18 düzeltmesi: bu yorum ÖNCEDEN "gerçek ilk E2E senaryosu Day 10'da eklenecek" diyordu —
 * o gün geldi geçti, eklenmedi (henüz gerçek Supabase yapılandırılmadığı için Playwright'ın
 * gerçek backend'e karşı koşacak bir ortamı hiç olmadı). `login()` artık MOCK DEĞİL — gerçek
 * api-gateway'e bağlı (bkz. auth.api.ts) ve bu GERÇEKTEN çalıştığı kanıtlandı
 * (tests/integration/support/run-local-verification.sh, bu kum havuzuna kurulan gerçek
 * Postgres+PostgREST+5 servise karşı) — ama Playwright'ın KENDİSİ hâlâ bu zincire dokunmuyor,
 * çünkü CI/normal geliştirme ortamında hâlâ gerçek bir Supabase projesi yok. Gerçek E2E login
 * senaryosu, gün numarası verilmeden, gerçek Supabase bağlanana kadar açık bırakıldı.
 */
test.describe('E2E altyapı duman testi (Q, Day 8)', () => {
  test('giriş sayfası backend olmadan render olur', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('kök yol ("/") da giriş sayfasına düşer (Day 1\'in geçici yönlendirmesi, bkz. router.tsx)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
