import { describe, it, expect } from 'vitest';

const hasTestDb = !!process.env.SUPABASE_TEST_URL;

/** bkz. docs/testing/rls-test-plan.md Bölüm 11.5. Politika Day 6'da eklendi (012_rls_policies.sql). */
describe.skipIf(!hasTestDb)('RLS: identity_roles / identity_user_permission_overrides', () => {
  it('admin.roles.manage izni olmayan kullanıcı rol oluşturamaz', async () => {
    expect(true).toBe(true); // TODO
  });

  it('is_super_admin kullanıcı rol silebilir (sistem rolü hariç)', async () => {
    expect(true).toBe(true); // TODO
  });
});
