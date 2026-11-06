import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { EmptyState } from '../../shared/components/EmptyState';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchRoles, fetchRolePermissions, updateRolePermissions, type RolePermissionCatalogEntry } from './identity.api';

/**
 * F2 (Day 13): "Admin: PermissionMatrixPage (grid)" — RoleManagementPage (Day 12) "bir rol seç,
 * o rolün izinlerini düzenle" akışını sunar; bu sayfa TÜM rolleri TÜM izinlerle YAN YANA
 * gösteren salt-okunur bir genel bakıştır ("hangi rolde ne var" sorusuna TEK ekranda cevap).
 * Düzenleme burada YAPILMAZ — RoleManagementPage'e yönlendirilir. TL'nin bugün düzelttiği
 * `findRolePermissions` (bkz. identity-service permission.repository.ts Day 13 notu) OLMADAN bu
 * sayfa mümkün DEĞİLDİ: Day 12'ye kadar her rol için AYNI (roleId'siz) katalog dönerdi, grid'in
 * her sütunu birbirinin AYNISI görünürdü.
 */
type Cell = { canView: boolean; canEdit: boolean };

export function PermissionMatrixPage() {
  const queryClient = useQueryClient();
  // Day 22 (G-07): matris artık DÜZENLENEBİLİR. Değişiklikler rol -> izin -> hücre olarak
  // biriktirilir; "Kaydet" yalnızca değişen rollere, her biri için TEK `PUT` (o rolün tüm satırları)
  // gönderir. Düzenle işaretlenirse Görüntüle de işaretlenir; Görüntüle kaldırılırsa Düzenle de düşer.
  const [pending, setPending] = useState<Record<string, Record<string, Cell>>>({});
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  const { data: matrix, isLoading } = useQuery({
    queryKey: ['permission-matrix', roles.map((r) => r.id)],
    queryFn: async () => {
      const perRole = await Promise.all(roles.map((r) => fetchRolePermissions(r.id)));
      return roles.map((role, i) => ({ role, permissions: perRole[i] }));
    },
    enabled: roles.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!matrix) return;
      for (const { role, permissions } of matrix) {
        const changes = pending[role.id];
        if (!changes) continue;
        await updateRolePermissions(
          role.id,
          permissions.map((e) => ({ permissionId: e.permissionId, ...(changes[e.permissionId] ?? { canView: e.canView, canEdit: e.canEdit }) })),
        );
      }
    },
    onSuccess: () => {
      setPending({});
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    },
  });
  const dirtyRoleCount = Object.keys(pending).length;

  function toggleCell(roleId: string, entry: RolePermissionCatalogEntry, field: 'canView' | 'canEdit') {
    setPending((prev) => {
      const current: Cell = prev[roleId]?.[entry.permissionId] ?? { canView: entry.canView, canEdit: entry.canEdit };
      const next: Cell = { ...current, [field]: !current[field] };
      if (field === 'canEdit' && next.canEdit) next.canView = true;
      if (field === 'canView' && !next.canView) next.canEdit = false;
      const roleChanges = { ...(prev[roleId] ?? {}), [entry.permissionId]: next };
      // Orijinal değere dönen hücre değişiklik sayılmaz.
      if (next.canView === entry.canView && next.canEdit === entry.canEdit) delete roleChanges[entry.permissionId];
      const out = { ...prev };
      if (Object.keys(roleChanges).length === 0) delete out[roleId];
      else out[roleId] = roleChanges;
      return out;
    });
  }

  // Katalog TÜM rollerde AYNI izin setini listeler (sadece canView/canEdit farklıdır) — bu
  // yüzden grubu/satırları birinci rolden çıkarmak yeterli.
  const permissionRows: Pick<RolePermissionCatalogEntry, 'permissionId' | 'permissionKey' | 'grup' | 'ad'>[] = matrix?.[0]?.permissions ?? [];
  const groupedRows = permissionRows.reduce<Record<string, typeof permissionRows>>((groups, p) => {
    (groups[p.grup] ??= []).push(p);
    return groups;
  }, {});

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.ADMIN_ROLES_MANAGE}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="İzin matrisi yalnızca yetkili yöneticilere açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">İzin Matrisi</h1>
        <p className="text-xs text-gray-500">
          Hücreleri işaretleyip <strong>Kaydet</strong>’e basın; yalnızca değişen roller güncellenir. Rol oluşturma/silme için{' '}
          <a href="/admin/roles" className="underline">
            Rol Yönetimi
          </a>{' '}
          sayfasını kullanın.
        </p>

        {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

        {matrix && roles.length === 0 && <EmptyState title="Henüz rol yok" description="Önce Rol Yönetimi'nden bir rol oluşturun." />}

        {matrix && roles.length > 0 && (
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table className="text-sm min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 sticky left-0 bg-white">İzin</th>
                  {roles.map((role) => (
                    <th key={role.id} className="px-3 py-2 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                      {role.ad}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(groupedRows).map(([grup, rows]) => (
                  <Fragment key={grup}>
                    <tr className="bg-gray-50">
                      <td colSpan={roles.length + 1} className="px-4 py-1 text-xs font-medium text-gray-500">
                        {grup}
                      </td>
                    </tr>
                    {rows.map((p) => (
                      <tr key={p.permissionId}>
                        <td className="px-4 py-1.5 text-gray-800 sticky left-0 bg-white whitespace-nowrap">{p.ad}</td>
                        {matrix.map(({ role, permissions }) => {
                          const entry = permissions.find((e) => e.permissionId === p.permissionId);
                          if (!entry) return <td key={role.id} className="px-3 py-1.5 text-center text-xs text-gray-300">—</td>;
                          const cell = pending[role.id]?.[p.permissionId] ?? { canView: entry.canView, canEdit: entry.canEdit };
                          const changed = !!pending[role.id]?.[p.permissionId];
                          return (
                            <td key={role.id} className={`px-3 py-1.5 text-center ${changed ? 'bg-amber-50' : ''}`}>
                              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                                <label className="flex items-center gap-1">
                                  <input type="checkbox" aria-label={`${role.ad} ${p.ad} görüntüle`} checked={cell.canView} onChange={() => toggleCell(role.id, entry, 'canView')} />G
                                </label>
                                <label className="flex items-center gap-1">
                                  <input type="checkbox" aria-label={`${role.ad} ${p.ad} düzenle`} checked={cell.canEdit} onChange={() => toggleCell(role.id, entry, 'canEdit')} />D
                                </label>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {matrix && roles.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={dirtyRoleCount === 0 || saveMutation.isPending}
              className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Kaydet{dirtyRoleCount > 0 ? ` (${dirtyRoleCount} rol)` : ''}
            </button>
            {dirtyRoleCount > 0 && (
              <button onClick={() => setPending({})} className="text-xs text-gray-500">
                Değişiklikleri at
              </button>
            )}
            {saveMutation.isError && <p className="text-xs text-red-600">{saveMutation.error instanceof Error ? saveMutation.error.message : 'İzinler kaydedilemedi'}</p>}
            {saveMutation.isSuccess && dirtyRoleCount === 0 && <p className="text-xs text-green-700">İzinler kaydedildi.</p>}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
