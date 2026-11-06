import type { SupabaseClient } from '@supabase/supabase-js';
import { RoleInUseCannotDeleteError, SystemRoleCannotDeleteError } from '@pms/shared';

export interface RoleRow {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  sistem_rolu: boolean;
  aktif: boolean;
}

export interface RoleRepository {
  findAll(): Promise<RoleRow[]>;
  findById(id: string): Promise<RoleRow | null>;
  create(data: { kod: string; ad: string; aciklama?: string; createdBy: string }): Promise<RoleRow>;
  update(id: string, patch: { ad?: string; aciklama?: string | null; aktif?: boolean }): Promise<RoleRow>;
  delete(id: string): Promise<void>;
  countActiveUsers(roleId: string): Promise<number>;
  copyPermissionsFromRole(fromRoleId: string, toRoleId: string): Promise<void>;
}

export class SupabaseRoleRepository implements RoleRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(): Promise<RoleRow[]> {
    const { data, error } = await this.db.from('identity_roles').select('*').order('ad');
    if (error) throw error;
    return (data ?? []) as RoleRow[];
  }

  async findById(id: string): Promise<RoleRow | null> {
    const { data, error } = await this.db
      .from('identity_roles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as RoleRow | null;
  }

  async create(data: { kod: string; ad: string; aciklama?: string; createdBy: string }): Promise<RoleRow> {
    const { data: row, error } = await this.db
      .from('identity_roles')
      .insert({ kod: data.kod, ad: data.ad, aciklama: data.aciklama ?? null, created_by: data.createdBy })
      .select('*')
      .single();
    if (error) throw error;
    return row as RoleRow;
  }

  async update(id: string, patch: { ad?: string; aciklama?: string | null; aktif?: boolean }): Promise<RoleRow> {
    const { data, error } = await this.db
      .from('identity_roles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as RoleRow;
  }

  async countActiveUsers(roleId: string): Promise<number> {
    const { count, error } = await this.db
      .from('identity_users')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId)
      .eq('is_active', true);
    if (error) throw error;
    return count ?? 0;
  }

  /** Kural: sistem_rolu=TRUE silinemez; kullanılan rolde kullanıcı varsa ROLE_IN_USE_CANNOT_DELETE. */
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
    const { error } = await this.db.from('identity_roles').delete().eq('id', id);
    if (error) throw error;
  }

  /** "Kopyala" senaryosu (docs/roadmap.md Bölüm 17.3 madde 2). */
  async copyPermissionsFromRole(fromRoleId: string, toRoleId: string): Promise<void> {
    const { data: sourcePermissions, error: selectError } = await this.db
      .from('identity_role_permissions')
      .select('permission_id, can_view, can_edit')
      .eq('role_id', fromRoleId);
    if (selectError) throw selectError;
    if (!sourcePermissions || sourcePermissions.length === 0) return;

    const rows = sourcePermissions.map((p) => ({
      role_id: toRoleId,
      permission_id: p.permission_id,
      can_view: p.can_view,
      can_edit: p.can_edit,
    }));
    const { error: insertError } = await this.db.from('identity_role_permissions').insert(rows);
    if (insertError) throw insertError;
  }
}
