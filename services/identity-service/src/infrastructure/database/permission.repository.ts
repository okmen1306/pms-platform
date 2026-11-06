import type { SupabaseClient } from '@supabase/supabase-js';

export interface PermissionRow {
  id: string;
  permission_key: string;
  grup: string;
  ad: string;
}

export interface EffectivePermissionRow {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  is_override: boolean;
}

export interface RolePermissionEntryInput {
  permissionId: string;
  canView: boolean;
  canEdit: boolean;
}

export interface GrantOverrideInput {
  permissionId: string;
  canView?: boolean | null;
  canEdit?: boolean | null;
  gerekce: string;
  grantedBy: string;
  expiresAt?: string | null;
}

/**
 * TL (Day 13, "admin API'leri ince ayar"): `GET /roles/:id/permissions` Day 1'den beri
 * `roleId`'yi TAMAMEN GÖRMEZDEN GELİP tüm izin kataloğunu dönüyordu (bkz. role.controller.ts —
 * `findAllCatalog()` çağrısı `id` parametresini hiç kullanmıyordu). Bu, Day 12'nin
 * RoleManagementPage'inde sarı bir uyarıyla KULLANICIYA açıkça gösterilmiş, bilinçli bir
 * boşluktu (bkz. CHANGELOG.md Day 12, F2 notu: "role-spesifik bir 'effective permissions'
 * sorgusu identity-service'te yok"). Bugün kapatılıyor: katalog artık `identity_role_permissions`
 * ile LEFT JOIN edilip her satıra o ROLE ÖZGÜ `canView`/`canEdit` (henüz atanmamışsa `false`)
 * eklenerek dönüyor — `PUT /roles/:id/permissions`'ın kabul ettiği `{permissionId, canView,
 * canEdit}` şekliyle SİMETRİK (frontend aynı listeyi hem render eder hem geri gönderir).
 */
export interface RolePermissionCatalogEntry {
  permissionId: string;
  permissionKey: string;
  grup: string;
  ad: string;
  canView: boolean;
  canEdit: boolean;
}

/**
 * TL (Day 13): `POST /users/:id/permission-overrides` Day 1'den beri VARDI ama karşılığı bir
 * LİSTELEME uç noktası yoktu — `DELETE /users/:id/permission-overrides/:overrideId` var olan bir
 * override'ı geri almak için `overrideId`'yi zaten BİLMEYİ gerektiriyordu; bu, sadece grant
 * isteğinin YANITINDAN (tek seferlik, sayfa yenilenince kaybolan) elde edilebiliyordu — Day 14'te
 * planlanan `UserOverridePanel`'in mevcut override'ları YÖNETEBİLMESİ için bu liste şarttı
 * (aynı "tüketici üreticiden önce hazır" deseni — bkz. Day 6 assignment.created notu). Sadece
 * AKTİF (süresi geçmemiş) override'lar döner — `identity_effective_permissions` VIEW'indeki
 * (001_identity_tables.sql) AYNI `expires_at IS NULL OR expires_at > NOW()` kuralı.
 */
export interface UserOverrideRow {
  id: string;
  permissionId: string;
  permissionKey: string;
  canView: boolean | null;
  canEdit: boolean | null;
  gerekce: string | null;
  grantedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Day 1'de tanımlanan arayüz; Day 3'te tam implementasyon eklendi
 * (bkz. docs/roadmap.md Bölüm 17.3 — Admin Rol Yönetimi Ekranı).
 */
export interface PermissionRepository {
  findAllCatalog(): Promise<PermissionRow[]>;
  getEffectivePermissions(userId: string): Promise<EffectivePermissionRow[]>;
  findRolePermissions(roleId: string): Promise<RolePermissionCatalogEntry[]>;
  upsertRolePermissions(roleId: string, entries: RolePermissionEntryInput[]): Promise<void>;
  grantUserOverride(userId: string, data: GrantOverrideInput): Promise<unknown>;
  revokeUserOverride(userId: string, overrideId: string): Promise<void>;
  listUserOverrides(userId: string): Promise<UserOverrideRow[]>;
}

export class SupabasePermissionRepository implements PermissionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAllCatalog(): Promise<PermissionRow[]> {
    const { data, error } = await this.db
      .from('identity_permissions')
      .select('*')
      .order('grup')
      .order('ad');
    if (error) throw error;
    return (data ?? []) as PermissionRow[];
  }

  /** identity_effective_permissions VIEW'i okur (001_identity_tables.sql — override > rol varsayılanı). */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissionRow[]> {
    const { data, error } = await this.db
      .from('identity_effective_permissions')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return (data ?? []) as EffectivePermissionRow[];
  }

  /** Bkz. RolePermissionCatalogEntry yorumu — katalog + bu role atanmış can_view/can_edit. */
  async findRolePermissions(roleId: string): Promise<RolePermissionCatalogEntry[]> {
    const [{ data: catalog, error: catalogError }, { data: assigned, error: assignedError }] = await Promise.all([
      this.db.from('identity_permissions').select('*').order('grup').order('ad'),
      this.db.from('identity_role_permissions').select('permission_id, can_view, can_edit').eq('role_id', roleId),
    ]);
    if (catalogError) throw catalogError;
    if (assignedError) throw assignedError;

    const grantByPermissionId = new Map(
      (assigned ?? []).map((row) => [row.permission_id as string, row as { can_view: boolean; can_edit: boolean }]),
    );
    return ((catalog ?? []) as PermissionRow[]).map((p) => {
      const grant = grantByPermissionId.get(p.id);
      return {
        permissionId: p.id,
        permissionKey: p.permission_key,
        grup: p.grup,
        ad: p.ad,
        canView: grant?.can_view ?? false,
        canEdit: grant?.can_edit ?? false,
      };
    });
  }

  /** Tüm matrisi TEK seferde kaydeder (docs/roadmap.md Bölüm 17.3 madde 4 — yığın güncelleme). */
  async upsertRolePermissions(roleId: string, entries: RolePermissionEntryInput[]): Promise<void> {
    const rows = entries.map((e) => ({
      role_id: roleId,
      permission_id: e.permissionId,
      can_view: e.canView,
      can_edit: e.canEdit,
    }));
    const { error } = await this.db
      .from('identity_role_permissions')
      .upsert(rows, { onConflict: 'role_id,permission_id' });
    if (error) throw error;
  }

  async grantUserOverride(userId: string, data: GrantOverrideInput): Promise<unknown> {
    const { data: row, error } = await this.db
      .from('identity_user_permission_overrides')
      .upsert(
        {
          user_id: userId,
          permission_id: data.permissionId,
          can_view: data.canView ?? null,
          can_edit: data.canEdit ?? null,
          gerekce: data.gerekce,
          granted_by: data.grantedBy,
          expires_at: data.expiresAt ?? null,
        },
        { onConflict: 'user_id,permission_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return row;
  }

  async revokeUserOverride(userId: string, overrideId: string): Promise<void> {
    const { error } = await this.db
      .from('identity_user_permission_overrides')
      .delete()
      .eq('id', overrideId)
      .eq('user_id', userId);
    if (error) throw error;
  }

  /** Bkz. UserOverrideRow yorumu — sadece aktif (süresi geçmemiş) override'lar, izin adıyla. */
  async listUserOverrides(userId: string): Promise<UserOverrideRow[]> {
    const { data, error } = await this.db
      .from('identity_user_permission_overrides')
      .select('id, permission_id, can_view, can_edit, gerekce, granted_by, expires_at, created_at, identity_permissions(permission_key)')
      .eq('user_id', userId)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });
    if (error) throw error;

    type OverrideJoinRow = {
      id: string;
      permission_id: string;
      can_view: boolean | null;
      can_edit: boolean | null;
      gerekce: string | null;
      granted_by: string;
      expires_at: string | null;
      created_at: string;
      identity_permissions: { permission_key: string } | { permission_key: string }[] | null;
    };
    return ((data ?? []) as unknown as OverrideJoinRow[]).map((row) => {
      const joined = Array.isArray(row.identity_permissions) ? row.identity_permissions[0] : row.identity_permissions;
      return {
        id: row.id,
        permissionId: row.permission_id,
        permissionKey: joined?.permission_key ?? row.permission_id,
        canView: row.can_view,
        canEdit: row.can_edit,
        gerekce: row.gerekce,
        grantedBy: row.granted_by,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    });
  }
}
