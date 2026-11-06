import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerUserOverrideRoutes } from '../user-override.controller';
import type {
  PermissionRepository,
  PermissionRow,
  EffectivePermissionRow,
  RolePermissionEntryInput,
  RolePermissionCatalogEntry,
  GrantOverrideInput,
  UserOverrideRow,
} from '../../infrastructure/database/permission.repository';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const PERMISSION_A = '22222222-2222-2222-2222-222222222222';
const GRANTED_BY = '33333333-3333-3333-3333-333333333333';

interface StoredOverride {
  id: string;
  user_id: string;
  permission_id: string;
  can_view: boolean | null;
  can_edit: boolean | null;
  gerekce: string | null;
  granted_by: string;
  expires_at: string | null;
  created_at: string;
}

/**
 * TL (Day 13): `listUserOverrides`'ın "sadece AKTİF override'lar" kuralını gerçekten test
 * edebilmek için bu fake, 001_identity_tables.sql'deki `identity_effective_permissions` VIEW'i
 * ile AYNI süre kontrolünü (`expires_at IS NULL OR expires_at > NOW()`) uygular.
 */
class InMemoryPermissionRepository implements PermissionRepository {
  public catalog: PermissionRow[] = [{ id: PERMISSION_A, permission_key: 'project.view', grup: 'project', ad: 'Proje Görüntüleme' }];
  public overrides: StoredOverride[] = [];

  async findAllCatalog(): Promise<PermissionRow[]> {
    return this.catalog;
  }
  async getEffectivePermissions(): Promise<EffectivePermissionRow[]> {
    return [];
  }
  async findRolePermissions(): Promise<RolePermissionCatalogEntry[]> {
    return [];
  }
  async upsertRolePermissions(_roleId: string, _entries: RolePermissionEntryInput[]): Promise<void> {}

  async grantUserOverride(userId: string, data: GrantOverrideInput): Promise<unknown> {
    const row: StoredOverride = {
      id: randomUUID(),
      user_id: userId,
      permission_id: data.permissionId,
      can_view: data.canView ?? null,
      can_edit: data.canEdit ?? null,
      gerekce: data.gerekce,
      granted_by: data.grantedBy,
      expires_at: data.expiresAt ?? null,
      created_at: new Date().toISOString(),
    };
    this.overrides.push(row);
    return row;
  }

  async revokeUserOverride(userId: string, overrideId: string): Promise<void> {
    this.overrides = this.overrides.filter((o) => !(o.id === overrideId && o.user_id === userId));
  }

  async listUserOverrides(userId: string): Promise<UserOverrideRow[]> {
    const now = Date.now();
    return this.overrides
      .filter((o) => o.user_id === userId && (o.expires_at === null || new Date(o.expires_at).getTime() > now))
      .map((o) => ({
        id: o.id,
        permissionId: o.permission_id,
        permissionKey: this.catalog.find((p) => p.id === o.permission_id)?.permission_key ?? o.permission_id,
        canView: o.can_view,
        canEdit: o.can_edit,
        gerekce: o.gerekce,
        grantedBy: o.granted_by,
        expiresAt: o.expires_at,
        createdAt: o.created_at,
      }));
  }
}

describe('registerUserOverrideRoutes', () => {
  let app: FastifyInstance;
  let permissionRepo: InMemoryPermissionRepository;

  beforeEach(() => {
    app = Fastify();
    registerErrorHandler(app);
    permissionRepo = new InMemoryPermissionRepository();
    registerUserOverrideRoutes(app, {
      permissionRepo,
      publishAudit: async () => {},
      publishOverridden: async () => {},
    });
  });

  it('POST bilinmeyen bir permissionId için NOT_FOUND döner (katalogda yok)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${USER_ID}/permission-overrides`,
      payload: { permissionId: randomUUID(), canView: true, gerekce: 'Geçici erişim' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('POST 5 karakterden kısa gerekçeyi reddeder (zorunlu alan)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/users/${USER_ID}/permission-overrides`,
      payload: { permissionId: PERMISSION_A, canView: true, gerekce: 'kısa' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('POST geçerli bir override verir ve GET listede görünür (Day 13 eki)', async () => {
    const grantRes = await app.inject({
      method: 'POST',
      url: `/users/${USER_ID}/permission-overrides`,
      payload: { permissionId: PERMISSION_A, canView: true, canEdit: false, gerekce: 'Proje kapanışı için geçici görüntüleme' },
    });
    expect(grantRes.statusCode).toBe(200);

    const listRes = await app.inject({ method: 'GET', url: `/users/${USER_ID}/permission-overrides` });
    expect(listRes.statusCode).toBe(200);
    const items = listRes.json().data as UserOverrideRow[];
    expect(items).toHaveLength(1);
    expect(items[0].permissionKey).toBe('project.view');
    expect(items[0].canView).toBe(true);
  });

  it('DELETE ile geri alınan override GET listesinde artık görünmez', async () => {
    await permissionRepo.grantUserOverride(USER_ID, {
      permissionId: PERMISSION_A,
      canView: true,
      gerekce: 'Test override',
      grantedBy: GRANTED_BY,
    });
    const overrideId = permissionRepo.overrides[0].id;

    const deleteRes = await app.inject({ method: 'DELETE', url: `/users/${USER_ID}/permission-overrides/${overrideId}` });
    expect(deleteRes.statusCode).toBe(200);

    const listRes = await app.inject({ method: 'GET', url: `/users/${USER_ID}/permission-overrides` });
    expect(listRes.json().data).toHaveLength(0);
  });

  it('GET süresi geçmiş override\'ı LİSTELEMEZ (identity_effective_permissions VIEW\'i ile aynı kural)', async () => {
    await permissionRepo.grantUserOverride(USER_ID, {
      permissionId: PERMISSION_A,
      canView: true,
      gerekce: 'Süresi geçmiş test override',
      grantedBy: GRANTED_BY,
      expiresAt: '2020-01-01T00:00:00.000Z',
    });

    const listRes = await app.inject({ method: 'GET', url: `/users/${USER_ID}/permission-overrides` });
    expect(listRes.json().data).toHaveLength(0);
  });

  it('GET başka bir kullanıcının override\'larını GÖSTERMEZ', async () => {
    await permissionRepo.grantUserOverride(USER_ID, {
      permissionId: PERMISSION_A,
      canView: true,
      gerekce: 'Sadece bu kullanıcıya özel',
      grantedBy: GRANTED_BY,
    });

    const otherUserId = '99999999-9999-9999-9999-999999999999';
    const listRes = await app.inject({ method: 'GET', url: `/users/${otherUserId}/permission-overrides` });
    expect(listRes.json().data).toHaveLength(0);
  });
});
