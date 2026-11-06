import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
// @ts-expect-error — .mjs, tip bildirimi yok
import { createFirstAdmin, FirstAdminError } from '../../scripts/lib/first-admin.mjs';

const { validatePasswordPolicy } = createRequire(import.meta.url)('../../shared/dist');

function fakeRest(state: { roles?: any[]; users?: any[]; admins?: number; insertError?: string }) {
  const calls: { path: string; init?: any }[] = [];
  const rest = async (path: string, init?: any) => {
    calls.push({ path, init });
    if (path.startsWith('/identity_roles')) return state.roles ?? [{ id: 'role-1' }];
    if (path.includes('is_super_admin=eq.true')) return Array.from({ length: state.admins ?? 0 }, (_, i) => ({ id: `a${i}` }));
    if (path.startsWith('/identity_users?select=id&email')) return state.users ?? [];
    if (path === '/identity_users' && init?.method === 'POST') {
      if (state.insertError) throw new Error(state.insertError);
      return [{ id: 'new-id' }];
    }
    throw new Error(`beklenmeyen çağrı ${path}`);
  };
  return { rest, calls };
}
const base = { hash: async (p: string) => `hashed:${p}`, validatePasswordPolicy, email: 'Admin@Sirket.com', password: 'Guclu-Parola-1' };
const insertBody = (calls: any[]) => JSON.parse(calls.find((c) => c.init?.method === 'POST').init.body);

describe('create-first-admin (Day 22, G-13)', () => {
  it('temiz kurulumda süper admin oluşturur: e-posta küçük harf, hash\'li parola, must_change_password=false', async () => {
    const { rest, calls } = fakeRest({});
    const r = await createFirstAdmin({ ...base, rest });
    expect(r).toEqual({ id: 'new-id', email: 'admin@sirket.com' });
    const body = insertBody(calls);
    expect(body).toMatchObject({ email: 'admin@sirket.com', role_id: 'role-1', is_super_admin: true, must_change_password: false });
    expect(body.password_hash).toBe('hashed:Guclu-Parola-1');
    expect(JSON.stringify(body)).not.toContain('"password"');
  });

  it('zayıf parola ve geçersiz e-posta DB\'ye hiç dokunmadan reddedilir', async () => {
    for (const patch of [{ password: 'zayif' }, { email: 'epostadegil' }]) {
      const { rest, calls } = fakeRest({});
      await expect(createFirstAdmin({ ...base, ...patch, rest })).rejects.toBeInstanceOf(FirstAdminError);
      expect(calls).toHaveLength(0);
    }
  });

  it('seed çalışmamışsa (rol yok) açıklayıcı hata verir ve kullanıcı eklemez', async () => {
    const { rest, calls } = fakeRest({ roles: [] });
    await expect(createFirstAdmin({ ...base, rest })).rejects.toThrow(/seed/);
    expect(calls.some((c) => c.init?.method === 'POST')).toBe(false);
  });

  it('aynı e-posta varsa reddeder', async () => {
    const { rest } = fakeRest({ users: [{ id: 'x' }] });
    await expect(createFirstAdmin({ ...base, rest })).rejects.toThrow(/kullanıcı zaten var/);
  });

  it('zaten süper admin varsa --allow-additional olmadan reddeder; bayrakla ekler; 3 doluysa bayrakla bile reddeder', async () => {
    await expect(createFirstAdmin({ ...base, rest: fakeRest({ admins: 1 }).rest })).rejects.toThrow(/allow-additional/);
    await expect(createFirstAdmin({ ...base, rest: fakeRest({ admins: 1 }).rest, allowAdditional: true })).resolves.toMatchObject({ id: 'new-id' });
    await expect(createFirstAdmin({ ...base, rest: fakeRest({ admins: 3 }).rest, allowAdditional: true })).rejects.toThrow(/sınır/);
  });

  it('yarışta DB tetikleyicisi sınırı reddederse anlaşılır hata verir; başka DB hatası olduğu gibi yükselir', async () => {
    await expect(createFirstAdmin({ ...base, rest: fakeRest({ insertError: 'En fazla 3 super-admin kullanicisina izin verilir' }).rest })).rejects.toBeInstanceOf(FirstAdminError);
    await expect(createFirstAdmin({ ...base, rest: fakeRest({ insertError: 'bağlantı koptu' }).rest })).rejects.toThrow('bağlantı koptu');
  });
});
