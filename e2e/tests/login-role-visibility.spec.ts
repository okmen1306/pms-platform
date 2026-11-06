import { test, expect } from '@playwright/test';

/**
 * Q (Day 10): "ilk E2E senaryosu (login + rol görünürlüğü)" — roadmap'in kendi planı
 * (docs/roadmap.md Bölüm 14.2 Day 10 satırı). e2e/ altyapısı Day 8'de kuruldu (bkz.
 * smoke.spec.ts); bu, üzerine eklenen İLK GERÇEK iş senaryosu.
 *
 * Bu senaryo, mock login + AuthContext + usePermission zincirinin (bugün AuthContext.tsx ile
 * kapatılan Day 2'den kalma bir boşluk, bkz. CHANGELOG.md Day 10) UÇTAN UCA çalıştığını
 * doğruluyor: aynı sayfa (CostAnalysisPage), FARKLI rollerle giriş yapıldığında FARKLI görünüyor
 * mu? Hâlâ backend'e HİÇ dokunmuyor (login tamamen mock, bkz. auth.api.ts) — ama artık gerçek
 * bir DAVRANIŞ farkı test ediliyor, sadece statik bir sayfanın render olduğu değil.
 */
test.describe('login + rol görünürlüğü (Q, Day 10)', () => {
  test('yonetici@ ile giriş yapan Maliyet Analizi sayfasını GÖREBİLİR', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('yonetici@example.com');
    await page.locator('input[type="password"]').fill('herhangi-bir-parola');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Maliyet Analizi')).toBeVisible();
    await expect(page.getByText('Bu sayfayı görüntüleme yetkiniz yok')).not.toBeVisible();
  });

  test('personel@ ile giriş yapan Maliyet Analizi sayfasını GÖREMEZ', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('personel@example.com');
    await page.locator('input[type="password"]').fill('herhangi-bir-parola');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText('Bu sayfayı görüntüleme yetkiniz yok')).toBeVisible();
    await expect(page.getByText('Maliyet Analizi')).not.toBeVisible();
  });
});
