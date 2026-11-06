import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler, SystemRoleCannotDeleteError, RoleInUseCannotDeleteError, type RabbitMqClient } from '@pms/shared';
import { registerRoleRoutes } from '../role.controller';
import type { RoleRepository, RoleRow } from '../../infrastructure/database/role.repository';
import type {
  PermissionRepository,
  PermissionRow,
  EffectivePermissionRow,
  RolePermissionEntryInput,
  RolePermissionCatalogEntry,
  GrantOverrideInput,
  UserOverrideRow,
} from '../../infrastructure/database/permission.repository';

const ROLE_ID = '11111111-1111-1111-1111-111111111111';
const SYSTEM_ROLE_ID = '22222222-2222-2222-2222-222222222222';
const PERMISSION_A = '33333333-3333-3333-3333-333333333333';
const PERMISSION_B = '44444444-4444-4444-4444-444444444444';

/**
 * TL (Day 13): identity-service'in İLK in-memory fake repository'si — performance-service'in
 * Day 12'deki (InMemoryPerformanceScoreRepository) AYNI deseni izler.
 */
class InMemoryRoleRepository implements RoleRepository {
  public roles: RoleRow[] = [
    { id: ROLE_ID, kod: 'proje_yoneticisi', ad: 'Proje Yöneticisi', aciklama: null, sistem_rolu: false, aktif: true },
    { id: SYSTEM_ROLE_ID, kod: 'sirket_yoneticisi', ad: 'Şirket Yöneticisi', aciklama: null, sistem_rolu: true, aktif: true },
  ];
  public activeUserCounts = new Map<string, number>();
  public copyCalls: { fromRoleId: string; toRoleId: string }[] = [];

  async findAll(): Promise<RoleRow[]> {
    return this.roles;
  }
  async findById(id: string): Promise<RoleRow | null> {
    return this.roles.find((r) => r.id === id) ?? null;
  }
  async create(data: { kod: string; ad: string; aciklama?: string; createdBy: string }): Promise<RoleRow> {
    const row: RoleRow = { id: randomUUID(), kod: data.kod, ad: data.ad, aciklama: data.aciklama ?? null, sistem_rolu: false, aktif: true };
    this.roles.push(row);
    return row;
  }
  async delete(id: string): Promise<void> {
    const role = await this.findById(id);
    if (!role) throw new Error(`Rol bulunamadı: ${id}`);
    if (role.sistem_rolu) {
      throw new SystemRoleCannotDeleteError(id, role.kod);
    }
    const activeUserCount = await this.countActiveUsers(id);
    if (activeUserCount > 0) {
      throw new RoleInUseCannotDeleteError(id, activeUserCount);
    }
    this.roles = this.roles.filter((r) => r.id !== id);
  }
  async countActiveUsers(roleId: string): Promise<number> {
    return this.activeUserCounts.get(roleId) ?? 0;
  }
  async copyPermissionsFromRole(fromRoleId: string, toRoleId: string): Promise<void> {
    this.copyCalls.push({ fromRoleId, toRoleId });
  }
}

class InMemoryPermissionRepository implements PermissionRepository {
  public catalog: PermissionRow[] = [
    { id: PERMISSION_A, permission_key: 'project.view', grup: 'project', ad: 'Proje Görüntüleme' },
    { id: PERMISSION_B, permission_key: 'project.edit', grup: 'project', ad: 'Proje Düzenleme' },
  ];
  public rolePermissions = new Map<string, RolePermissionEntryInput[]>();

  async findAllCatalog(): Promise<PermissionRow[]> {
    return this.catalog;
  }
  async getEffectivePermissions(_userId: string): Promise<EffectivePermissionRow[]> {
    return [];
  }
  async findRolePermissions(roleId: string): Promise<RolePermissionCatalogEntry[]> {
    const assigned = this.rolePermissions.get(roleId) ?? [];
    return this.catalog.map((p) => {
      const grant = assigned.find((a) => a.permissionId === p.id);
      return {
        permissionId: p.id,
        permissionKey: p.permission_key,
        grup: p.grup,
        ad: p.ad,
        canView: grant?.canView ?? false,
        canEdit: grant?.canEdit ?? false,
      };
    });
  }
  async upsertRolePermissions(roleId: string, entries: RolePermissionEntryInput[]): Promise<void> {
    this.rolePermissions.set(roleId, entries);
  }
  async grantUserOverride(_userId: string, _data: GrantOverrideInput): Promise<unknown> {
    return {};
  }
  async revokeUserOverride(): Promise<void> {}
  async listUserOverrides(): Promise<UserOverrideRow[]> {
    return [];
  }
}

const fakeRabbit = { publish: async () => {} } as unknown as RabbitMqClient;

describe('registerRoleRoutes', () => {
  let app: FastifyInstance;
  let roleRepo: InMemoryRoleRepository;
  let permissionRepo: InMemoryPermissionRepository;

  beforeEach(() => {
    app = Fastify();
    registerErrorHandler(app);
    roleRepo = new InMemoryRoleRepository();
    permissionRepo = new InMemoryPermissionRepository();
    registerRoleRoutes(app, { roleRepo, permissionRepo, rabbit: fakeRabbit, publishAudit: async () => {} });
  });

  it('GET /roles tüm rolleri döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/roles' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it('POST /roles yeni rol oluşturur', async () => {
    const res = await app.inject({ method: 'POST', url: '/roles', payload: { kod: 'ik_yoneticisi', ad: 'İK Yöneticisi' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.kod).toBe('ik_yoneticisi');
    expect(roleRepo.roles).toHaveLength(3);
  });

  it('POST /roles geçersiz kod formatını reddeder (küçük harf/alt çizgi kuralı)', async () => {
    const res = await app.inject({ method: 'POST', url: '/roles', payload: { kod: 'Gecersiz Kod', ad: 'X' } });
    expect(res.statusCode).toBe(422);
  });

  it('DELETE /roles/:id sistem rolünü SYSTEM_ROLE_CANNOT_DELETE ile reddeder', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/roles/${SYSTEM_ROLE_ID}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('SYSTEM_ROLE_CANNOT_DELETE');
  });

  it('DELETE /roles/:id kullanımdaki rolü ROLE_IN_USE_CANNOT_DELETE ile reddeder', async () => {
    roleRepo.activeUserCounts.set(ROLE_ID, 3);
    const res = await app.inject({ method: 'DELETE', url: `/roles/${ROLE_ID}` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('ROLE_IN_USE_CANNOT_DELETE');
  });

  it('DELETE /roles/:id kullanılmayan normal rolü siler', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/roles/${ROLE_ID}` });
    expect(res.statusCode).toBe(200);
    expect(roleRepo.roles.find((r) => r.id === ROLE_ID)).toBeUndefined();
  });

  describe('GET /roles/:id/permissions (Day 13 düzeltmesi)', () => {
    it('bir role HİÇ izin atanmamışsa katalogdaki her satır canView/canEdit=false döner', async () => {
      const res = await app.inject({ method: 'GET', url: `/roles/${ROLE_ID}/permissions` });
      expect(res.statusCode).toBe(200);
      const items = res.json().data as RolePermissionCatalogEntry[];
      expect(items).toHaveLength(2);
      expect(items.every((i) => i.canView === false && i.canEdit === false)).toBe(true);
    });

    it('rol izinleri güncellendikten SONRA aynı role özgü değerleri yansıtır (başka rolü ETKİLEMEZ)', async () => {
      await app.inject({
        method: 'PUT',
        url: `/roles/${ROLE_ID}/permissions`,
        payload: { permissions: [{ permissionId: PERMISSION_A, canView: true, canEdit: false }] },
      });

      const roleRes = await app.inject({ method: 'GET', url: `/roles/${ROLE_ID}/permissions` });
      const roleItems = roleRes.json().data as RolePermissionCatalogEntry[];
      expect(roleItems.find((i) => i.permissionId === PERMISSION_A)?.canView).toBe(true);
      expect(roleItems.find((i) => i.permissionId === PERMISSION_B)?.canView).toBe(false);

      // Day 12'nin bulgusu: eskiden BÜTÜN roller için AYNI (roleId'siz) katalog dönerdi —
      // burada başka bir rolün hâlâ tamamen atanmamış göründüğünü doğruluyoruz.
      const otherRes = await app.inject({ method: 'GET', url: `/roles/${SYSTEM_ROLE_ID}/permissions` });
      const otherItems = otherRes.json().data as RolePermissionCatalogEntry[];
      expect(otherItems.every((i) => i.canView === false)).toBe(true);
    });
  });
});
