import Fastify, { type FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerUserRoutes } from '../user.controller';
import { toUserListItem, type UserRepository, type UserRow, type UserListFilter, type CreateUserRow } from '../../infrastructure/database/user.repository';
import type { RoleRepository, RoleRow } from '../../infrastructure/database/role.repository';
import type { PermissionRepository, EffectivePermissionRow, RolePermissionCatalogEntry } from '../../infrastructure/database/permission.repository';

const ID = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const R = { sirket: ID(1), ik: ID(2), personel: ID(3), pasif: ID(4), ozel: ID(5) };
const U = { admin: ID(11), ik: ID(12), personel: ID(13) };

const roles: RoleRow[] = [
  { id: R.sirket, kod: 'sirket_yoneticisi', ad: 'Şirket Yöneticisi', aciklama: null, sistem_rolu: true, aktif: true },
  { id: R.ik, kod: 'ik_yoneticisi', ad: 'İK Yöneticisi', aciklama: null, sistem_rolu: true, aktif: true },
  { id: R.personel, kod: 'personel', ad: 'Personel', aciklama: null, sistem_rolu: true, aktif: true },
  { id: R.pasif, kod: 'eski', ad: 'Eski Rol', aciklama: null, sistem_rolu: false, aktif: false },
  { id: R.ozel, kod: 'ozel', ad: 'Özel Rol', aciklama: null, sistem_rolu: false, aktif: true },
];
// Seed matrisinin ilgili kısmı: hangi rol hangi admin.* iznini veriyor.
const roleGrants: Record<string, { key: string; view: boolean; edit: boolean }[]> = {
  [R.sirket]: [
    { key: 'admin.roles.manage', view: true, edit: true },
    { key: 'admin.users.manage', view: true, edit: true },
  ],
  [R.ik]: [
    { key: 'admin.users.manage', view: true, edit: true },
    { key: 'personnel.records', view: true, edit: true },
  ],
  [R.personel]: [{ key: 'project.records', view: true, edit: false }],
  [R.ozel]: [],
  [R.pasif]: [],
};

class FakeUsers implements UserRepository {
  rows: UserRow[] = [];
  passwordCalls: { id: string; mustChange: boolean }[] = [];
  seed(id: string, email: string, roleId: string, extra: Partial<UserRow> = {}) {
    this.rows.push({
      id, email, password_hash: '', role_id: roleId, is_super_admin: false, personnel_id: null, dil_tercihi: 'tr',
      is_active: true, must_change_password: false, last_login_at: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...extra,
    });
  }
  async findByEmail(e: string) { return this.rows.find((r) => r.email === e) ?? null; }
  async findById(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async create(d: CreateUserRow) {
    const row: UserRow = {
      id: ID(100 + this.rows.length), email: d.email, password_hash: d.password_hash, role_id: d.role_id, is_super_admin: false,
      personnel_id: d.personnel_id ?? null, dil_tercihi: d.dil_tercihi ?? 'tr', is_active: true, must_change_password: d.must_change_password ?? false,
      last_login_at: null, created_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z',
    };
    this.rows.push(row);
    return row;
  }
  async updateLastLogin() {}
  async findMany(f: UserListFilter) {
    return this.rows
      .map((r) => toUserListItem(r, roles.find((x) => x.id === r.role_id)!))
      .filter((u) => (!f.roleKod || u.roleKod === f.roleKod) && (!f.status || u.isActive === (f.status === 'active')));
  }
  async updateRole(id: string, roleId: string) { this.rows.find((r) => r.id === id)!.role_id = roleId; }
  async updatePassword(id: string, hash: string, mustChange: boolean) {
    const r = this.rows.find((x) => x.id === id)!;
    r.password_hash = hash;
    r.must_change_password = mustChange;
    this.passwordCalls.push({ id, mustChange });
  }
}

class FakeRoles implements RoleRepository {
  rows = roles.map((r) => ({ ...r }));
  activeUsers = new Map<string, number>();
  async findAll() { return this.rows; }
  async findById(id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async create(): Promise<RoleRow> { throw new Error('kullanılmıyor'); }
  async update(id: string, patch: { ad?: string; aciklama?: string | null; aktif?: boolean }) {
    const r = this.rows.find((x) => x.id === id)!;
    Object.assign(r, patch);
    return r;
  }
  async delete() {}
  async countActiveUsers(id: string) { return this.activeUsers.get(id) ?? 0; }
  async copyPermissionsFromRole() {}
}

class FakePerms implements PermissionRepository {
  constructor(private readonly users: FakeUsers) {}
  async findAllCatalog() { return []; }
  async getEffectivePermissions(userId: string): Promise<EffectivePermissionRow[]> {
    const u = this.users.rows.find((r) => r.id === userId);
    return (roleGrants[u?.role_id ?? ''] ?? []).map((g) => ({ permission_key: g.key, can_view: g.view, can_edit: g.edit, is_override: false }));
  }
  async findRolePermissions(roleId: string): Promise<RolePermissionCatalogEntry[]> {
    return (roleGrants[roleId] ?? []).map((g) => ({ permissionKey: g.key, canView: g.view, canEdit: g.edit })) as unknown as RolePermissionCatalogEntry[];
  }
  async upsertRolePermissions() {}
  async grantUserOverride() { return null; }
  async revokeUserOverride() {}
  async listUserOverrides() { return []; }
}

const VALID = 'Gecici-Parola1';
describe('identity-service: kullanıcı yönetimi (Day 22, G-02)', () => {
  let app: FastifyInstance;
  let users: FakeUsers;
  let rolesRepo: FakeRoles;
  const audits: { ozet: string; severity: string }[] = [];
  const asActor = (id: string) => ({ 'x-actor-id': id });

  beforeEach(async () => {
    audits.length = 0;
    users = new FakeUsers();
    users.seed(U.admin, 'admin@x.com', R.sirket, { is_super_admin: true });
    users.seed(U.ik, 'ik@x.com', R.ik);
    users.seed(U.personel, 'personel@x.com', R.personel);
    rolesRepo = new FakeRoles();
    app = Fastify();
    registerErrorHandler(app);
    registerUserRoutes(app, {
      userRepo: users,
      roleRepo: rolesRepo,
      permissionRepo: new FakePerms(users),
      publishAudit: async (e) => { audits.push({ ozet: e.ozet, severity: e.severity }); },
    });
    await app.ready();
  });

  describe('POST /users', () => {
    it('ik_yoneticisi personel hesabı açar: 201, hash ASLA dönmez, must_change_password açık, audit yazılır', async () => {
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.ik), payload: { email: 'Yeni@X.com', temporaryPassword: VALID, roleId: R.personel } });
      expect(res.statusCode).toBe(201);
      const body = res.json().data;
      expect(body.email).toBe('yeni@x.com');
      expect(body.mustChangePassword).toBe(true);
      expect(JSON.stringify(res.json())).not.toMatch(/password_hash|passwordHash/);
      const stored = users.rows.find((r) => r.email === 'yeni@x.com')!;
      expect(stored.password_hash).not.toBe(VALID);
      expect(await bcrypt.compare(VALID, stored.password_hash)).toBe(true);
      expect(audits).toHaveLength(1);
    });

    it('YETKİ YÜKSELTME: ik_yoneticisi sirket_yoneticisi rolü atayamaz (403), kullanıcı oluşmaz', async () => {
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.ik), payload: { email: 'x@x.com', temporaryPassword: VALID, roleId: R.sirket } });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.message).toContain('admin.roles.manage');
      expect(users.rows.find((r) => r.email === 'x@x.com')).toBeUndefined();
    });

    it('ik_yoneticisi kendi seviyesindeki rolü (yalnızca sahip olduğu admin.* izinleri) atayabilir', async () => {
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.ik), payload: { email: 'ik2@x.com', temporaryPassword: VALID, roleId: R.ik } });
      expect(res.statusCode).toBe(201);
    });

    it('süper admin sirket_yoneticisi dahil her rolü atayabilir', async () => {
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'y@x.com', temporaryPassword: VALID, roleId: R.sirket } });
      expect(res.statusCode).toBe(201);
    });

    it('PASİF veya bilinmeyen kullanıcı işlem yapamaz', async () => {
      users.rows.find((r) => r.id === U.ik)!.is_active = false;
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.ik), payload: { email: 'z@x.com', temporaryPassword: VALID, roleId: R.personel } });
      expect(res.statusCode).toBe(403);
    });

    it('parola politikası: kısa / büyük harfsiz / rakamsız / 72 bayttan uzun -> 422 (hata listesi ile)', async () => {
      for (const pw of ['Kisa1a', 'kucukharf-123456', 'BUYUKHARF-123456', 'Rakamsiz-Parola', 'Aa1' + 'x'.repeat(75)]) {
        const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'p@x.com', temporaryPassword: pw, roleId: R.personel } });
        expect(res.statusCode, pw).toBe(422);
        expect(res.json().error.details.errors.length).toBeGreaterThan(0);
      }
    });

    it('aynı e-posta (büyük/küçük harf farkıyla) 409; pasif rol 422; bilinmeyen rol 404', async () => {
      const dup = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'IK@x.com', temporaryPassword: VALID, roleId: R.personel } });
      expect(dup.statusCode).toBe(409);
      const pasif = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'a@x.com', temporaryPassword: VALID, roleId: R.pasif } });
      expect(pasif.statusCode).toBe(422);
      const none = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'b@x.com', temporaryPassword: VALID, roleId: ID(999) } });
      expect(none.statusCode).toBe(404);
    });

    it('geçersiz e-posta / roleId -> 422', async () => {
      const res = await app.inject({ method: 'POST', url: '/users', headers: asActor(U.admin), payload: { email: 'degil', temporaryPassword: VALID, roleId: 'x' } });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /users', () => {
    it('listeler; role ve status filtreleri; yanıtta hash yok', async () => {
      users.seed(ID(20), 'eski@x.com', R.personel, { is_active: false });
      const all = await app.inject({ method: 'GET', url: '/users' });
      expect(all.json().data).toHaveLength(4);
      expect(JSON.stringify(all.json())).not.toMatch(/password_hash/);
      const byRole = await app.inject({ method: 'GET', url: '/users?role=personel' });
      expect(byRole.json().data).toHaveLength(2);
      const inactive = await app.inject({ method: 'GET', url: '/users?role=personel&status=inactive' });
      expect(inactive.json().data.map((u: { email: string }) => u.email)).toEqual(['eski@x.com']);
    });
    it('geçersiz status -> 422', async () => {
      expect((await app.inject({ method: 'GET', url: '/users?status=x' })).statusCode).toBe(422);
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('süper admin rol değiştirir; audit severity=warning ve eski→yeni rol adı içerir', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/users/${U.personel}/role`, headers: asActor(U.admin), payload: { roleId: R.ozel } });
      expect(res.statusCode).toBe(200);
      expect(users.rows.find((r) => r.id === U.personel)!.role_id).toBe(R.ozel);
      expect(audits[0].severity).toBe('warning');
      expect(audits[0].ozet).toContain('Personel');
      expect(audits[0].ozet).toContain('Özel Rol');
    });
    it('kendi rolünü değiştiremez (409); aynı rol 409; pasif rol 422; bilinmeyen kullanıcı 404', async () => {
      expect((await app.inject({ method: 'PATCH', url: `/users/${U.admin}/role`, headers: asActor(U.admin), payload: { roleId: R.ozel } })).statusCode).toBe(409);
      expect((await app.inject({ method: 'PATCH', url: `/users/${U.personel}/role`, headers: asActor(U.admin), payload: { roleId: R.personel } })).statusCode).toBe(409);
      expect((await app.inject({ method: 'PATCH', url: `/users/${U.personel}/role`, headers: asActor(U.admin), payload: { roleId: R.pasif } })).statusCode).toBe(422);
      expect((await app.inject({ method: 'PATCH', url: `/users/${ID(404)}/role`, headers: asActor(U.admin), payload: { roleId: R.ozel } })).statusCode).toBe(404);
    });
    it('YETKİ YÜKSELTME: ik başkasını sirket_yoneticisi yapamaz (403) ve rol DEĞİŞMEZ', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/users/${U.personel}/role`, headers: asActor(U.ik), payload: { roleId: R.sirket } });
      expect(res.statusCode).toBe(403);
      expect(users.rows.find((r) => r.id === U.personel)!.role_id).toBe(R.personel);
    });
  });

  describe('PATCH /roles/:id', () => {
    it('ad/açıklama güncellenir; boş gövde 422', async () => {
      const ok = await app.inject({ method: 'PATCH', url: `/roles/${R.ozel}`, headers: asActor(U.admin), payload: { ad: 'Yeni Ad', aciklama: null } });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().data.ad).toBe('Yeni Ad');
      expect((await app.inject({ method: 'PATCH', url: `/roles/${R.ozel}`, headers: asActor(U.admin), payload: {} })).statusCode).toBe(422);
    });
    it('sistem rolü pasife alınamaz (409); kullanıcısı olan rol pasife alınamaz (409, sayı mesajda); boş rol alınabilir', async () => {
      expect((await app.inject({ method: 'PATCH', url: `/roles/${R.sirket}`, headers: asActor(U.admin), payload: { aktif: false } })).statusCode).toBe(409);
      rolesRepo.activeUsers.set(R.ozel, 3);
      const busy = await app.inject({ method: 'PATCH', url: `/roles/${R.ozel}`, headers: asActor(U.admin), payload: { aktif: false } });
      expect(busy.statusCode).toBe(409);
      expect(busy.json().error.message).toContain('3');
      rolesRepo.activeUsers.set(R.ozel, 0);
      expect((await app.inject({ method: 'PATCH', url: `/roles/${R.ozel}`, headers: asActor(U.admin), payload: { aktif: false } })).statusCode).toBe(200);
    });
    it('kod DEĞİŞTİRİLEMEZ: gövdede kod verilse bile yok sayılır', async () => {
      await app.inject({ method: 'PATCH', url: `/roles/${R.ozel}`, headers: asActor(U.admin), payload: { ad: 'Ad Yeni', kod: 'hacked' } });
      expect(rolesRepo.rows.find((r) => r.id === R.ozel)!.kod).toBe('ozel');
    });
  });

  describe('POST /me/password', () => {
    beforeEach(async () => {
      const row = users.rows.find((r) => r.id === U.personel)!;
      row.password_hash = await bcrypt.hash(VALID, 4);
      row.must_change_password = true;
    });
    it('geçici parola değişir: bayrak kapanır, yeni parola geçerli, audit yazılır', async () => {
      const res = await app.inject({ method: 'POST', url: '/me/password', headers: asActor(U.personel), payload: { currentPassword: VALID, newPassword: 'Yeni-Parola-42' } });
      expect(res.statusCode).toBe(200);
      const row = users.rows.find((r) => r.id === U.personel)!;
      expect(row.must_change_password).toBe(false);
      expect(await bcrypt.compare('Yeni-Parola-42', row.password_hash)).toBe(true);
      expect(audits).toHaveLength(1);
    });
    it('yanlış mevcut parola 401 (hiçbir şey değişmez); zayıf parola 422; aynı parola 422', async () => {
      const wrong = await app.inject({ method: 'POST', url: '/me/password', headers: asActor(U.personel), payload: { currentPassword: 'Yanlis-Parola1', newPassword: 'Yeni-Parola-42' } });
      expect(wrong.statusCode).toBe(401);
      expect(users.passwordCalls).toHaveLength(0);
      const weak = await app.inject({ method: 'POST', url: '/me/password', headers: asActor(U.personel), payload: { currentPassword: VALID, newPassword: 'zayif' } });
      expect(weak.statusCode).toBe(422);
      const same = await app.inject({ method: 'POST', url: '/me/password', headers: asActor(U.personel), payload: { currentPassword: VALID, newPassword: VALID } });
      expect(same.statusCode).toBe(422);
      expect(users.passwordCalls).toHaveLength(0);
    });
    it('hedef kullanıcı gövdeden DEĞİL, yalnızca x-actor-id\'den gelir (başkasının parolası değiştirilemez)', async () => {
      const res = await app.inject({ method: 'POST', url: '/me/password', headers: asActor(U.personel), payload: { currentPassword: VALID, newPassword: 'Yeni-Parola-42', userId: U.admin } });
      expect(res.statusCode).toBe(200);
      expect(users.passwordCalls.map((c) => c.id)).toEqual([U.personel]);
    });
  });
});
