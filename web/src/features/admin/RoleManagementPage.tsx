import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PERMISSION_KEYS } from '@pms/shared';
import { fetchRoles, createRole, deleteRole, updateRole, fetchUsers, changeUserRole, fetchRolePermissions, updateRolePermissions, type Role } from './identity.api';
import { RoleGuard } from '../../shared/components/RoleGuard';
import { EmptyState } from '../../shared/components/EmptyState';

/**
 * F2 (Day 12): "Admin: RoleManagementPage" — CostAnalysisPage'teki (Day 6) AYNI `RoleGuard`
 * deseni: yetkisi olmayan kullanıcı sayfayı GÖRMEZ (Bölüm 18 kuralı — devre dışı değil, tamamen
 * gizli). `ADMIN_ROLES_MANAGE` izni identity-service'in kendi rol/izin YÖNETİMİNİ korur.
 */
export function RoleManagementPage() {
  const queryClient = useQueryClient();
  const [kod, setKod] = useState('');
  const [ad, setAd] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [targetRoleId, setTargetRoleId] = useState('');
  const [pendingPermissions, setPendingPermissions] = useState<Record<string, { canView: boolean; canEdit: boolean }>>({});

  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles'], queryFn: fetchRoles });

  const { data: catalog = [] } = useQuery({
    queryKey: ['role-permissions', selectedRoleId],
    queryFn: () => fetchRolePermissions(selectedRoleId as string),
    enabled: !!selectedRoleId,
  });

  const createMutation = useMutation({
    mutationFn: () => createRole(kod, ad, aciklama || undefined),
    onSuccess: () => {
      setKod('');
      setAd('');
      setAciklama('');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  // Day 22: sil = "önce kullanıcıları taşı, sonra rolü sil". Taşıma hedefi ZORUNLU seçimdir
  // (kullanıcı yoksa seçim gerekmez). Mevcut API'yle tek adımda yapılır: her kullanıcı için
  // PATCH /users/:id/role, ardından DELETE /roles/:id. Atomik DEĞİL — ortada hata olursa taşınanlar
  // taşınmış kalır, rol silinmez (sunucu RoleInUse verir) ve işlem yeniden denenebilir.
  const { data: roleUsers = [] } = useQuery({
    queryKey: ['users', 'by-role', deletingRole?.kod],
    queryFn: () => fetchUsers({ role: deletingRole?.kod }),
    enabled: !!deletingRole,
  });
  const reassignTargets = roles.filter((r) => r.aktif && r.id !== deletingRole?.id);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deletingRole) return;
      for (const u of roleUsers) await changeUserRole(u.id, targetRoleId);
      await deleteRole(deletingRole.id);
    },
    onSuccess: () => {
      setDeletingRole(null);
      setTargetRoleId('');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (role: Role) => updateRole(role.id, { aktif: !role.aktif }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  const savePermissionsMutation = useMutation({
    mutationFn: () =>
      updateRolePermissions(
        selectedRoleId as string,
        // F2 (Day 13): taban değer artık `p.canView`/`p.canEdit` — TL'nin bugün düzelttiği
        // `findRolePermissions()` sayesinde bu, rolün GERÇEK mevcut durumu (Day 12'de her zaman
        // `false` varsayılırdı, bkz. identity.api.ts'teki eski not).
        catalog.map((p) => ({
          permissionId: p.permissionId,
          canView: pendingPermissions[p.permissionId]?.canView ?? p.canView,
          canEdit: pendingPermissions[p.permissionId]?.canEdit ?? p.canEdit,
        })),
      ),
  });

  function selectRole(role: Role) {
    setSelectedRoleId(role.id);
    setPendingPermissions({});
  }

  function toggle(entry: { permissionId: string; canView: boolean; canEdit: boolean }, field: 'canView' | 'canEdit') {
    setPendingPermissions((prev) => {
      const current = prev[entry.permissionId] ?? { canView: entry.canView, canEdit: entry.canEdit };
      return { ...prev, [entry.permissionId]: { ...current, [field]: !current[field] } };
    });
  }

  return (
    <RoleGuard
      permissionKey={PERMISSION_KEYS.ADMIN_ROLES_MANAGE}
      fallback={
        <div className="p-6">
          <EmptyState title="Bu sayfayı görüntüleme yetkiniz yok" description="Rol yönetimi yalnızca yetkili yöneticilere açıktır." />
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">Rol Yönetimi</h1>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 max-w-xl">
          <p className="text-sm font-medium text-gray-900">Yeni rol</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={kod}
              onChange={(e) => setKod(e.target.value)}
              placeholder="Kod (örn. saha_muhendisi)"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ad" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <input
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Açıklama (opsiyonel)"
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!kod || !ad || createMutation.isPending}
            className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
          >
            Oluştur
          </button>
          {createMutation.isError && (
            <p className="text-xs text-red-600">{createMutation.error instanceof Error ? createMutation.error.message : 'Rol oluşturulamadı'}</p>
          )}
        </div>

        {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}

        {roles.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {roles.map((role) => (
              <div key={role.id} data-testid={`role-row-${role.kod}`}>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <button onClick={() => selectRole(role)} className="text-left">
                    <p className="text-sm text-gray-800">
                      {role.ad} <span className="text-xs text-gray-400 font-mono">({role.kod})</span>
                    </p>
                    {role.aciklama && <p className="text-xs text-gray-500">{role.aciklama}</p>}
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {role.sistem_rolu && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Sistem rolü</span>}
                    {!role.aktif && <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Pasif</span>}
                    {/* Sistem rolünde butonlar pasif + neden (Bölüm 18: gizlemek yerine açıklamak burada daha öğretici) */}
                    <button
                      onClick={() => toggleActiveMutation.mutate(role)}
                      disabled={role.sistem_rolu || toggleActiveMutation.isPending}
                      title={role.sistem_rolu ? 'Sistem rolü pasife alınamaz' : undefined}
                      className="text-xs text-gray-400 hover:text-gray-900 disabled:opacity-40 disabled:hover:text-gray-400"
                    >
                      {role.aktif ? 'Pasife al' : 'Aktifleştir'}
                    </button>
                    <button
                      onClick={() => {
                        setDeletingRole(role);
                        setTargetRoleId('');
                      }}
                      disabled={role.sistem_rolu}
                      title={role.sistem_rolu ? 'Sistem rolü silinemez' : undefined}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:hover:text-gray-400"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                {deletingRole?.id === role.id && (
                  <div className="px-4 py-3 bg-red-50 space-y-2" data-testid="delete-role-panel">
                    <p className="text-sm text-gray-800">
                      “{role.ad}” silinecek. Bu role atanmış <strong>{roleUsers.length}</strong> kullanıcı var.
                    </p>
                    {roleUsers.length > 0 && (
                      <label className="text-xs text-gray-600 block space-y-1">
                        {roleUsers.length} kullanıcıyı hangi role taşıyalım? (zorunlu)
                        <select
                          aria-label="Hedef rol"
                          value={targetRoleId}
                          onChange={(e) => setTargetRoleId(e.target.value)}
                          className="w-full max-w-xs rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
                        >
                          <option value="">Hedef rol seçin…</option>
                          {reassignTargets.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.ad}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending || (roleUsers.length > 0 && !targetRoleId)}
                        className="rounded-md bg-red-600 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        Taşı ve sil
                      </button>
                      <button onClick={() => setDeletingRole(null)} className="text-xs text-gray-500">
                        Vazgeç
                      </button>
                    </div>
                    {deleteMutation.isError && (
                      <p className="text-xs text-red-600">{deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Rol silinemedi'}</p>
                    )}
                  </div>
                )}

                {selectedRoleId === role.id && (
                  <div className="px-4 py-3 bg-gray-50 space-y-3">
                    {/*
                      F2 (Day 13): Day 12'nin amber uyarısı KALDIRILDI — backend artık bu rolün
                      GERÇEK canView/canEdit durumunu döner (bkz. identity.api.ts'teki güncel not),
                      onay kutuları bu değerlerle başlar.
                    */}
                    {catalog.length === 0 && <p className="text-xs text-gray-500">İzin kataloğu yükleniyor...</p>}
                    {Object.entries(
                      catalog.reduce<Record<string, typeof catalog>>((groups, p) => {
                        (groups[p.grup] ??= []).push(p);
                        return groups;
                      }, {}),
                    ).map(([grup, permissions]) => (
                      <div key={grup}>
                        <p className="text-xs font-medium text-gray-500 mb-1">{grup}</p>
                        {permissions.map((p) => (
                          <div key={p.permissionId} className="flex items-center justify-between py-1">
                            <span className="text-sm text-gray-700">{p.ad}</span>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={pendingPermissions[p.permissionId]?.canView ?? p.canView}
                                  onChange={() => toggle(p, 'canView')}
                                />
                                Görüntüle
                              </label>
                              <label className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={pendingPermissions[p.permissionId]?.canEdit ?? p.canEdit}
                                  onChange={() => toggle(p, 'canEdit')}
                                />
                                Düzenle
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => savePermissionsMutation.mutate()}
                        disabled={savePermissionsMutation.isPending}
                        className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        İzinleri Kaydet
                      </button>
                      <button onClick={() => setSelectedRoleId(null)} className="text-xs text-gray-500">
                        Kapat
                      </button>
                    </div>
                    {savePermissionsMutation.isError && (
                      <p className="text-xs text-red-600">
                        {savePermissionsMutation.error instanceof Error ? savePermissionsMutation.error.message : 'İzinler kaydedilemedi'}
                      </p>
                    )}
                    {savePermissionsMutation.isSuccess && <p className="text-xs text-green-700">İzinler kaydedildi.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
