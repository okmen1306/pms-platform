import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRolePermissions, fetchUserOverrides, grantUserOverride, revokeUserOverride, type UserListItem } from './identity.api';

type Tri = 'rol' | 'ver' | 'kisitla';
const TRI_LABEL: Record<Tri, string> = { rol: 'Rolden gelsin', ver: 'İzin ver', kisitla: 'Kısıtla' };
const toBool = (v: Tri): boolean | null => (v === 'rol' ? null : v === 'ver');
const fromBool = (v: boolean | null): string => (v === null ? 'Rolden' : v ? 'Verildi' : 'Kısıtlandı');

/**
 * Day 22 (G-07): kullanıcı bazlı izin override paneli. Rolü DEĞİŞTİRMEDEN ek/kısıtlı izin verir.
 * Gerekçe ZORUNLU (en az 5 karakter — sunucu şemasıyla aynı); son kullanma tarihi opsiyoneldir.
 * Aktif override'lar listelenir ve tek tıkla geri alınır. Yalnızca admin.roles.manage sahibine
 * açık uçları kullanır (gateway alt yolları admin-only tutar), bu yüzden çağıran sayfa paneli
 * yalnızca o izne sahip kullanıcıya gösterir.
 */
export function UserOverridePanel({ user, onClose }: { user: UserListItem; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [permissionId, setPermissionId] = useState('');
  const [view, setView] = useState<Tri>('rol');
  const [edit, setEdit] = useState<Tri>('rol');
  const [gerekce, setGerekce] = useState('');
  const [expiresOn, setExpiresOn] = useState('');

  // Katalog (izin adları) kullanıcının rolünden alınır; satırlar tüm rollerde aynı set.
  const { data: catalog = [] } = useQuery({ queryKey: ['role-permissions', user.roleId], queryFn: () => fetchRolePermissions(user.roleId) });
  const { data: overrides = [], isLoading } = useQuery({ queryKey: ['user-overrides', user.id], queryFn: () => fetchUserOverrides(user.id) });

  const reasonValid = gerekce.trim().length >= 5;
  const bothInherit = view === 'rol' && edit === 'rol';
  const canSubmit = !!permissionId && reasonValid && !bothInherit;

  const grant = useMutation({
    mutationFn: () =>
      grantUserOverride(user.id, {
        permissionId,
        canView: toBool(view),
        canEdit: toBool(edit),
        gerekce: gerekce.trim(),
        // Tarih seçilirse o günün sonunda (yerel) sona erer.
        expiresAt: expiresOn ? new Date(`${expiresOn}T23:59:59`).toISOString() : null,
      }),
    onSuccess: () => {
      setPermissionId('');
      setView('rol');
      setEdit('rol');
      setGerekce('');
      setExpiresOn('');
      queryClient.invalidateQueries({ queryKey: ['user-overrides', user.id] });
    },
  });

  const revoke = useMutation({
    mutationFn: (overrideId: string) => revokeUserOverride(user.id, overrideId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-overrides', user.id] }),
  });

  const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'İşlem başarısız');

  return (
    <div className="px-4 py-3 bg-gray-50 space-y-3" data-testid="override-panel">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-900">İzin override’ları — {user.email}</p>
        <button onClick={onClose} className="text-xs text-gray-500">
          Kapat
        </button>
      </div>

      {isLoading && <p className="text-xs text-gray-500">Yükleniyor...</p>}
      {!isLoading && overrides.length === 0 && <p className="text-xs text-gray-500">Bu kullanıcının aktif override’ı yok.</p>}
      {overrides.length > 0 && (
        <ul className="divide-y divide-gray-100 bg-white rounded-md border border-gray-200">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="text-xs text-gray-700 space-y-0.5">
                <p className="font-mono text-gray-900">{o.permissionKey}</p>
                <p>
                  Görüntüle: {fromBool(o.canView)} · Düzenle: {fromBool(o.canEdit)}
                </p>
                {o.gerekce && <p className="text-gray-500">Gerekçe: {o.gerekce}</p>}
                {o.expiresAt && <p className="text-gray-500">Bitiş: {new Date(o.expiresAt).toLocaleDateString('tr-TR')}</p>}
              </div>
              <button onClick={() => revoke.mutate(o.id)} disabled={revoke.isPending} className="text-xs text-red-600 disabled:opacity-50 shrink-0">
                Geri al
              </button>
            </li>
          ))}
        </ul>
      )}
      {revoke.isError && <p className="text-xs text-red-600">{errorMessage(revoke.error)}</p>}

      <div className="space-y-2 border-t border-gray-200 pt-3">
        <p className="text-xs font-medium text-gray-500">Yeni override</p>
        <select
          aria-label="İzin"
          value={permissionId}
          onChange={(e) => setPermissionId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white"
        >
          <option value="">İzin seçin…</option>
          {catalog.map((p) => (
            <option key={p.permissionId} value={p.permissionId}>
              {p.ad} ({p.permissionKey})
            </option>
          ))}
        </select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-xs text-gray-600 space-y-1 block">
            Görüntüle
            <select value={view} onChange={(e) => setView(e.target.value as Tri)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
              {(Object.keys(TRI_LABEL) as Tri[]).map((k) => (
                <option key={k} value={k}>
                  {TRI_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600 space-y-1 block">
            Düzenle
            <select value={edit} onChange={(e) => setEdit(e.target.value as Tri)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm bg-white">
              {(Object.keys(TRI_LABEL) as Tri[]).map((k) => (
                <option key={k} value={k}>
                  {TRI_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <textarea
          aria-label="Gerekçe"
          value={gerekce}
          onChange={(e) => setGerekce(e.target.value)}
          placeholder="Gerekçe (zorunlu, en az 5 karakter — denetim kaydına yazılır)"
          rows={2}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <label className="text-xs text-gray-600 space-y-1 block max-w-xs">
          Son kullanma tarihi (opsiyonel)
          <input
            type="date"
            value={expiresOn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        {bothInherit && permissionId && <p className="text-xs text-amber-700">Görüntüle veya Düzenle’den en az biri rolden farklı olmalı.</p>}
        <button
          onClick={() => grant.mutate()}
          disabled={!canSubmit || grant.isPending}
          className="rounded-md bg-gray-900 text-white text-xs px-3 py-1.5 disabled:opacity-50"
        >
          Override ver
        </button>
        {grant.isError && <p className="text-xs text-red-600">{errorMessage(grant.error)}</p>}
      </div>
    </div>
  );
}
