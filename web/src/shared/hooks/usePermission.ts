import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthContext';
import { apiFetch } from '../api';

export interface EffectivePermission {
  permissionKey: string;
  canView: boolean;
  canEdit: boolean;
  isOverride: boolean;
}

/**
 * Day 21 (G-20): mock KALDIRILDI. Giriş yapan kullanıcının etkin izinleri gateway'in
 * `GET /identity/me/effective-permissions` uç noktasından gelir (kimlik JWT'den; admin izni
 * gerektirmez — genel `/identity/*` admin.roles.manage ister, bu yüzden ayrı bir uç nokta).
 * TanStack Query ile oturum boyunca önbelleklenir (`staleTime: Infinity`); kullanıcı id'si anahtarda
 * olduğundan hesap değişince yeniden çekilir. Admin izin matrisini değiştirirse etkisi bir sonraki
 * girişte/yenilemede görünür (canlı yayın Day 22+ kapsamında).
 *
 * `isSuperAdmin` ağa HİÇ çıkmadan her kapıyı açar (gateway'deki `rbac.middleware.ts` kısa
 * devresiyle aynı mantık). Sorgu sürerken ya da hata verirse izin YOK sayılır (kapalı/fail-closed):
 * Bölüm 18 kuralı — yetkisiz öğe tamamen gizlenir; yükleme anında kısa süre gizli kalması,
 * yetkisiz bir butonun anlık görünmesinden iyidir.
 */
export function useMyPermissions() {
  const { user } = useAuth();
  const enabled = !!user && !user.isSuperAdmin;
  const query = useQuery({
    queryKey: ['permissions', 'me', user?.id],
    queryFn: () => apiFetch<EffectivePermission[]>('/identity/me/effective-permissions', { fallbackError: 'İzinler alınamadı' }),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
  return {
    permissions: query.data ?? [],
    /** Süper admin için her zaman false; diğerleri için izinler gelene kadar true. */
    isLoading: enabled && query.isLoading,
    isSuperAdmin: !!user?.isSuperAdmin,
    isAuthenticated: !!user,
  };
}

export function usePermission(permissionKey: string, need: 'view' | 'edit' = 'view'): boolean {
  const { permissions, isSuperAdmin, isAuthenticated } = useMyPermissions();
  if (!isAuthenticated) return false;
  if (isSuperAdmin) return true;
  const match = permissions.find((p) => p.permissionKey === permissionKey);
  if (!match) return false;
  return need === 'view' ? match.canView : match.canEdit;
}
