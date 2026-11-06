import { apiFetch } from '../../shared/api';

/**
 * Day 22 (G-08 kapanışı): identity istemcisi artık servise DOĞRUDAN değil, api-gateway üzerinden
 * (`/identity/...`) ve `apiFetch` ile (JWT + zarf açma + 401'de sessiz refresh) konuşuyor.
 * Gateway kapıları: yalnızca TAM yol `/identity/users` → `admin.users.manage`; diğer tüm
 * `/identity/*` (rol uçları, `/users/:id/role`, override uçları) admin.roles.manage ister.
 */
export interface Role {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  sistem_rolu: boolean;
  aktif: boolean;
}

export interface RolePermissionCatalogEntry {
  permissionId: string;
  permissionKey: string;
  grup: string;
  ad: string;
  canView: boolean;
  canEdit: boolean;
}

export interface UserOverride {
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

/** identity-service `UserListItem` ile birebir (password_hash ASLA gelmez). */
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

export interface UserFilter {
  role?: string;
  status?: 'active' | 'inactive';
}

export interface CreateUserInput {
  email: string;
  temporaryPassword: string;
  roleId: string;
  personnelId?: string | null;
  dilTercihi?: 'tr' | 'en';
}

export interface GrantOverrideInput {
  permissionId: string;
  canView: boolean | null;
  canEdit: boolean | null;
  gerekce: string;
  expiresAt?: string | null;
}

// ---- Kullanıcılar ---------------------------------------------------------------------------
export function fetchUsers(filter: UserFilter = {}): Promise<UserListItem[]> {
  const params = new URLSearchParams();
  if (filter.role) params.set('role', filter.role);
  if (filter.status) params.set('status', filter.status);
  const qs = params.toString();
  return apiFetch<UserListItem[]>(`/identity/users${qs ? `?${qs}` : ''}`, { fallbackError: 'Kullanıcılar getirilemedi' });
}

export function createUser(input: CreateUserInput): Promise<UserListItem> {
  return apiFetch<UserListItem>('/identity/users', { method: 'POST', body: input, fallbackError: 'Kullanıcı oluşturulamadı' });
}

export function changeUserRole(userId: string, roleId: string): Promise<UserListItem> {
  return apiFetch<UserListItem>(`/identity/users/${userId}/role`, {
    method: 'PATCH',
    body: { roleId },
    fallbackError: 'Rol değiştirilemedi',
  });
}

// ---- Roller ---------------------------------------------------------------------------------
export function fetchRoles(): Promise<Role[]> {
  return apiFetch<Role[]>('/identity/roles', { fallbackError: 'Roller getirilemedi' });
}

export function createRole(kod: string, ad: string, aciklama?: string): Promise<Role> {
  return apiFetch<Role>('/identity/roles', { method: 'POST', body: { kod, ad, aciklama }, fallbackError: 'Rol oluşturulamadı' });
}

export function updateRole(roleId: string, patch: { ad?: string; aciklama?: string | null; aktif?: boolean }): Promise<Role> {
  return apiFetch<Role>(`/identity/roles/${roleId}`, { method: 'PATCH', body: patch, fallbackError: 'Rol güncellenemedi' });
}

export async function deleteRole(roleId: string): Promise<void> {
  await apiFetch<unknown>(`/identity/roles/${roleId}`, { method: 'DELETE', fallbackError: 'Rol silinemedi' });
}

export function fetchRolePermissions(roleId: string): Promise<RolePermissionCatalogEntry[]> {
  return apiFetch<RolePermissionCatalogEntry[]>(`/identity/roles/${roleId}/permissions`, { fallbackError: 'İzin kataloğu getirilemedi' });
}

/** Tek `PUT` ile bir rolün TÜM izin satırları (toplu kayıt). */
export async function updateRolePermissions(
  roleId: string,
  permissions: { permissionId: string; canView: boolean; canEdit: boolean }[],
): Promise<void> {
  await apiFetch<unknown>(`/identity/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: { permissions },
    fallbackError: 'İzinler kaydedilemedi',
  });
}

// ---- Kullanıcı bazlı override ---------------------------------------------------------------
export function fetchUserOverrides(userId: string): Promise<UserOverride[]> {
  return apiFetch<UserOverride[]>(`/identity/users/${userId}/permission-overrides`, { fallbackError: "Override'lar getirilemedi" });
}

export function grantUserOverride(userId: string, input: GrantOverrideInput): Promise<unknown> {
  return apiFetch<unknown>(`/identity/users/${userId}/permission-overrides`, {
    method: 'POST',
    body: input,
    fallbackError: 'Override verilemedi',
  });
}

export async function revokeUserOverride(userId: string, overrideId: string): Promise<void> {
  await apiFetch<unknown>(`/identity/users/${userId}/permission-overrides/${overrideId}`, {
    method: 'DELETE',
    fallbackError: 'Override geri alınamadı',
  });
}
