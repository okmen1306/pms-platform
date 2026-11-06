import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ForcePasswordChangePage } from '../features/auth/ForcePasswordChangePage';

/**
 * Day 18: `/login` dışındaki tüm rotaların layout'u. Oturum geri yüklenirken (`loading`) hiçbir şey
 * çizilmez — aksi hâlde sayfa yenilemede giriş sayfasına bir anlık "flash" olurdu. Oturum yoksa
 * (ya da refresh de başarısız olup `onSessionExpired` kullanıcıyı düşürdüyse) giriş sayfasına yönlenir.
 */
export function RequireAuth() {
  const { user, status } = useAuth();
  if (status === 'loading') return null;
  if (!user) return <Navigate to="/login" replace />;
  // Day 22 (G-02): geçici parolayla girenler parolalarını değiştirene kadar başka hiçbir sayfayı görmez.
  if (user.mustChangePassword) return <ForcePasswordChangePage />;
  return <Outlet />;
}
