import { describe, it, expect } from 'vitest';

const hasTestDb = !!process.env.SUPABASE_TEST_URL;

/** bkz. docs/testing/rls-test-plan.md Bölüm 11.2. RLS politikası kendisi Day 9-10'da eklenecek. */
describe.skipIf(!hasTestDb)('RLS: finance_project_costs (sadece sirket_yoneticisi)', () => {
  it('is_super_admin kullanıcı maliyet kaydını okuyabilir', async () => {
    expect(true).toBe(true); // TODO (Day 9-10 sonrası implemente edilecek)
  });

  it('ekip_lideri maliyet kaydını OKUYAMAZ', async () => {
    expect(true).toBe(true); // TODO
  });

  it('personel maliyet tablosuna INSERT DENEYEMEZ', async () => {
    expect(true).toBe(true); // TODO
  });
});
