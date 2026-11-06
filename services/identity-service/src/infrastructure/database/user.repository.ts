import type { SupabaseClient } from '@supabase/supabase-js';

/** Day 1'de tanımlanan arayüz; Day 2'de implementasyonu eklendi. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRow | null>;
  findById(id: string): Promise<UserRow | null>;
  create(data: CreateUserRow): Promise<UserRow>;
  updateLastLogin(id: string): Promise<void>;
  /** Day 22: parola hash'i ve must_change_password içermeyen, API'ye güvenle dönülebilir liste. */
  findMany(filter: UserListFilter): Promise<UserListItem[]>;
  updateRole(id: string, roleId: string): Promise<void>;
  updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void>;
}

export interface UserListFilter {
  roleKod?: string;
  status?: 'active' | 'inactive';
}

/** API çıktısı — `password_hash` ASLA içermez. */
export interface UserListItem {
  id: string;
  email: string;
  roleId: string;
  roleKod: string;
  roleAd: string;
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  personnelId: string | null;
  dilTercihi: 'tr' | 'en';
  lastLoginAt: string | null;
  createdAt: string;
}

/** Hassas alanları ayıklar: repo satırı -> API öğesi (rol adı/kodu ayrıca verilir). */
export function toUserListItem(u: UserRow, role: { kod: string; ad: string }): UserListItem {
  return {
    id: u.id,
    email: u.email,
    roleId: u.role_id,
    roleKod: role.kod,
    roleAd: role.ad,
    isSuperAdmin: u.is_super_admin,
    isActive: u.is_active,
    mustChangePassword: u.must_change_password,
    personnelId: u.personnel_id,
    dilTercihi: u.dil_tercihi,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  };
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  is_super_admin: boolean;
  personnel_id: string | null;
  dil_tercihi: 'tr' | 'en';
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRow {
  email: string;
  password_hash: string;
  role_id: string;
  personnel_id?: string | null;
  dil_tercihi?: 'tr' | 'en';
  must_change_password?: boolean;
}

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findByEmail(email: string): Promise<UserRow | null> {
    const { data, error } = await this.db
      .from('identity_users')
      .select('*')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    return data as UserRow | null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await this.db
      .from('identity_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as UserRow | null;
  }

  async create(data: CreateUserRow): Promise<UserRow> {
    const { data: row, error } = await this.db
      .from('identity_users')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as UserRow;
  }

  async updateLastLogin(id: string): Promise<void> {
    const { error } = await this.db
      .from('identity_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async findMany(filter: UserListFilter): Promise<UserListItem[]> {
    let q = this.db.from('identity_users').select('*, identity_roles!inner(kod, ad)').order('email');
    if (filter.roleKod) q = q.eq('identity_roles.kod', filter.roleKod);
    if (filter.status) q = q.eq('is_active', filter.status === 'active');
    const { data, error } = await q;
    if (error) throw error;
    return ((data ?? []) as (UserRow & { identity_roles: { kod: string; ad: string } })[]).map((r) =>
      toUserListItem(r, r.identity_roles),
    );
  }

  async updateRole(id: string, roleId: string): Promise<void> {
    const { error } = await this.db
      .from('identity_users')
      .update({ role_id: roleId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async updatePassword(id: string, passwordHash: string, mustChangePassword: boolean): Promise<void> {
    const { error } = await this.db
      .from('identity_users')
      .update({ password_hash: passwordHash, must_change_password: mustChangePassword, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
