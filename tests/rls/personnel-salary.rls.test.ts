import { describe, it, expect } from 'vitest';

const hasTestDb = !!process.env.SUPABASE_TEST_URL;

/** bkz. docs/testing/rls-test-plan.md Bölüm 11.1 */
describe.skipIf(!hasTestDb)('RLS: personnel_employees maaş görünürlüğü', () => {
  it('personel rolü kendi kaydını okuyabilir ama maas_tl alanı gizlenir', async () => {
    // TODO (go-live hazırlığı, Bölüm 16): gerçek Supabase test client'ı ile
    // 1) personel rolünde bir kullanıcı oluştur
    // 2) o kullanıcının JWT'siyle personnel_employees'ten kendi satırını SELECT et
    // 3) satırın döndüğünü ama maas_tl'nin backend DTO katmanında null olduğunu doğrula
    expect(true).toBe(true); // placeholder — gerçek DB bağlanınca implemente edilecek
  });

  it('ik_yoneticisi herhangi bir personelin maaşını görebilir', async () => {
    // TODO: aynı senaryo, ik_yoneticisi rolüyle — maas_tl gerçek değer dönmeli
    expect(true).toBe(true);
  });

  it('is_active=false kullanıcı hiçbir isteği yapamaz', async () => {
    // TODO: pasif kullanıcı JWT'si ile istek -> 401
    expect(true).toBe(true);
  });
});
