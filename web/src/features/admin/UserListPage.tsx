import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { EmptyState } from '../../shared/components/EmptyState';
import { usePermission } from '../../shared/hooks/usePermission';
import { changeUserRole, createUser, fetchRoles, fetchUsers, type UserListItem } from './identity.api';
import { UserOverridePanel } from './UserOverridePanel';

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/**
 * Day 22 (G-02, G-07): kullanıcı listesi + oluşturma + rol değiştirme + override paneli.
 *
 * Gateway kapıları farklıdır: yalnızca TAM yol `/identity/users` (liste + oluşturma)
 * `admin.users.manage` ile açıktır — `ik_yoneticisi` bu sayfayı görür ve kullanıcı açabilir.
 * `PATCH /users/:id/role` ve override uçları alt yoldur, admin-only kalır; bu yüzden "Rol" seçici
 * ve "İzinler" butonu yalnızca `admin.roles.manage` sahibine çizilir (yetkisiz öğe tamamen gizli).
 *
 * Geçici parola yalnızca bir kez, oluşturma anında girilir; sunucu `must_change_password`
 * bayrağını koyar, kullanıcı ilk girişte parolasını değiştirmeye zorlanır (ForcePasswordChangePage).
 * Parola istemcide saklanmaz, listede/denetimde görünmez.
 */
export function UserListPage() {
  const queryClient = useQueryClient();
  const canManageRoles = usePermission(PERMISSION_KEYS.ADMIN_ROLES_MANAGE, 'edit');

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [openOverrideUserId, setOpenOverrideUserId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [roleId, setRoleId] = useState('');

  const { data: roles = [], isError: rolesUnavailable } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles, retry: false });
  const assignableRoles = roles.filter((r) => r.aktif);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['users', roleFilter, statusFilter],
    queryFn: () => fetchUsers({ role: roleFilter || undefined, status: statusFilter || undefined }),
  });

  const create = useMutation({
    mutationFn: () => createUser({ email: email.trim(), temporaryPassword, roleId }),
    onSuccess: () => {
      setEmail('');
      setTemporaryPassword('');
      setRoleId('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const changeRole = useMutation({
    mutationFn: (v: { userId: string; roleId: string }) => changeUserRole(v.userId, v.roleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const overrideUser: UserListItem | undefined = users.find((u) => u.id === openOverrideUserId);

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.ADMIN_USERS_MANAGE}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="Kullanıcı yönetimi yalnızca yetkili yöneticilere açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">Kullanıcılar</h1>

        <RoleGuard permissionKey={PERMISSION_KEYS.ADMIN_USERS_MANAGE} need="edit">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 max-w-xl">
            <p className="text-sm font-medium text-gray-900">Yeni kullanıcı</p>
            <input
              type="email"
              aria-label="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta"
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input
              type="password"
              aria-label="Geçici parola"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Geçici parola"
              autoComplete="new-password"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <select
              aria-label="Rol"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Rol seçin…</option>
              {assignableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.ad}
                </option>
              ))}
            </select>
            {rolesUnavailable && (
              <p className="text-xs text-amber-700" role="alert">
                Rol listesi alınamadı: gateway `GET /identity/roles` ucunu yalnızca admin.roles.manage sahibine açıyor (G-26). Rol seçilemediği için kullanıcı oluşturulamaz.
              </p>
            )}
            <p className="text-xs text-gray-500">Kullanıcı ilk girişte bu parolayı değiştirmek zorunda kalır.</p>
            <button
              onClick={() => create.mutate()}
              disabled={!email.trim() || !temporaryPassword || !roleId || create.isPending}
              className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Kullanıcı oluştur
            </button>
            {create.isError && <p className="text-xs text-red-600">{errorMessage(create.error, 'Kullanıcı oluşturulamadı')}</p>}
          </div>
        </RoleGuard>

        <div className="flex flex-wrap gap-3 items-center">
          <select
            aria-label="Rol filtresi"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Tüm roller</option>
            {roles.map((r) => (
              <option key={r.id} value={r.kod}>
                {r.ad}
              </option>
            ))}
          </select>
          <select
            aria-label="Durum filtresi"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>

        {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
        {isError && <p className="text-xs text-red-600">{errorMessage(error, 'Kullanıcılar getirilemedi')}</p>}
        {changeRole.isError && <p className="text-xs text-red-600">{errorMessage(changeRole.error, 'Rol değiştirilemedi')}</p>}

        {!isLoading && !isError && users.length === 0 && <EmptyState title="Kullanıcı bulunamadı" description="Filtreleri değiştirin ya da yeni kullanıcı oluşturun." />}

        {users.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-sm text-gray-800">{u.email}</p>
                    <p className="text-xs text-gray-500">
                      Son giriş: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('tr-TR') : 'hiç girmedi'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {u.isSuperAdmin && <span className="text-xs bg-gray-900 text-white rounded-full px-2 py-0.5">Süper admin</span>}
                    {u.mustChangePassword && <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">Geçici parola</span>}
                    {!u.isActive && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Pasif</span>}
                    {canManageRoles && !u.isSuperAdmin ? (
                      <select
                        aria-label={`${u.email} rolü`}
                        value={u.roleId}
                        disabled={changeRole.isPending}
                        onChange={(e) => changeRole.mutate({ userId: u.id, roleId: e.target.value })}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs bg-white"
                      >
                        {roles
                          .filter((r) => r.aktif || r.id === u.roleId)
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.ad}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{u.roleAd}</span>
                    )}
                    {canManageRoles && !u.isSuperAdmin && (
                      <button onClick={() => setOpenOverrideUserId(openOverrideUserId === u.id ? null : u.id)} className="text-xs text-gray-500 hover:text-gray-900 underline">
                        İzinler
                      </button>
                    )}
                  </div>
                </div>
                {overrideUser?.id === u.id && canManageRoles && <UserOverridePanel user={overrideUser} onClose={() => setOpenOverrideUserId(null)} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
