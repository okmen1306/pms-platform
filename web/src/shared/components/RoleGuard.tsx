import { ReactNode } from 'react';
import { usePermission } from '../hooks/usePermission';

interface RoleGuardProps {
  /** identity_permissions.permission_key (bkz. shared/dto/permission.dto.ts PERMISSION_KEYS) */
  permissionKey: string;
  need?: 'view' | 'edit';
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Day 3: artık inline mock yerine `usePermission` hook'unu kullanıyor (bkz.
 * shared/hooks/usePermission.ts) — Day 22'de hook'un içi gerçek API'ye bağlanınca bu bileşenin
 * KENDİSİ değişmeyecek, sadece hook'un implementasyonu değişecek. Bu ayrım (bileşen izin
 * sorgusunun NASIL yapıldığını bilmiyor) Day 1'deki inline mock'a göre daha temiz bir arayüz.
 *
 * docs/roadmap.md Bölüm 18 kuralı: yetkisi olmayan kullanıcı için buton/sekme TAMAMEN GİZLENİR
 * (devre dışı + kilit ikonu değil) — bu yüzden `fallback` varsayılan olarak null'dur.
 */
export function RoleGuard({ permissionKey, need = 'view', children, fallback = null }: RoleGuardProps) {
  const hasPermission = usePermission(permissionKey, need);
  return <>{hasPermission ? children : fallback}</>;
}
