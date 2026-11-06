import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useMyPermissions } from '../shared/hooks/usePermission';
import { LoadingSkeleton } from '../shared/components/LoadingSkeleton';
import { permissionForPath, visibleNavGroups } from './navigation';

/**
 * Day 21 (F1): kalıcı navigasyon kabuğu (Day 10'dan beri "Day 18+" diye ertelenmişti). Menü, `/identity/me/
 * effective-permissions`tan gelen izinlerle filtrelenir. Sayfa içeriği de AYNI izne bağlı: menüde
 * olmayan bir sayfaya URL ile girilirse "erişim yok" gösterilir (gateway zaten 403 verirdi — bu yalnızca
 * kullanıcıya bozuk bir sayfa yerine açıklama gösterir; güvenlik sınırı DEĞİL, sınır gateway'dir).
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const { permissions, isSuperAdmin, isLoading } = useMyPermissions();
  const { pathname } = useLocation();

  const can = (key: string) => isSuperAdmin || permissions.some((p) => p.permissionKey === key && p.canView);
  const groups = visibleNavGroups(can);
  const required = permissionForPath(pathname);
  const allowed = required === null || can(required);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white p-4 space-y-4" aria-label="Ana menü">
        <div className="text-sm font-semibold text-gray-900">PMS</div>
        {isLoading ? (
          <LoadingSkeleton lines={5} />
        ) : (
          <nav className="space-y-4">
            {groups.map((g) => (
              <div key={g.title}>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.items.map((i) => (
                    <li key={i.to}>
                      <NavLink
                        to={i.to}
                        className={({ isActive }) =>
                          `block rounded px-2 py-1 text-xs ${isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`
                        }
                      >
                        {i.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
        <div className="pt-4 border-t border-gray-100 text-[11px] text-gray-500 space-y-1">
          <p className="truncate">{user?.email}</p>
          <button onClick={() => void logout()} className="text-blue-600 hover:underline">
            Çıkış
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : allowed ? (
          <Outlet />
        ) : (
          <div className="p-6" role="alert">
            <h1 className="text-lg font-semibold text-gray-900">Erişim yok</h1>
            <p className="text-sm text-gray-600 mt-1">Bu sayfayı görüntülemek için yetkiniz bulunmuyor.</p>
          </div>
        )}
      </main>
    </div>
  );
}
