import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { logout as apiLogout, restoreSession, type AuthUser } from '../features/auth/auth.api';
import { onSessionExpired } from '../shared/api';

interface AuthContextValue {
  user: AuthUser | null;
  /** 'loading': sayfa açılışında sessiz refresh (oturum geri yükleme) hâlâ sürüyor. */
  status: 'loading' | 'ready';
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Day 18: gerçek oturum yönetimi. Önceki hâli (Q, Day 10) sadece BELLEK İÇİ mock login sonucunu
 * tutuyordu ve sayfa yenilenince oturum kayboluyordu ("Gerçek JWT/kalıcı oturum yönetimi Day
 * 18'in kapsamı"). Artık: access token bellekte (bkz. shared/api/tokenStore.ts), kalıcılık
 * identity-service'in httpOnly refresh cookie'siyle — açılışta `restoreSession()` sessizce yeni
 * bir access token alıp kullanıcıyı geri yükler; refresh de başarısız olursa (oturum gerçekten
 * bitti) `onSessionExpired` kullanıcıyı düşürür ve RequireAuth giriş sayfasına yönlendirir.
 *
 * `restoreOnMount={false}`: birim testlerin (usePermission.test.tsx) ağa çıkmadan sağlayıcıyı
 * kullanabilmesi için.
 */
export function AuthProvider({ children, restoreOnMount = true }: { children: ReactNode; restoreOnMount?: boolean }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>(restoreOnMount ? 'loading' : 'ready');

  useEffect(() => onSessionExpired(() => setUserState(null)), []);

  useEffect(() => {
    if (!restoreOnMount) return;
    let cancelled = false;
    restoreSession().then((restored) => {
      if (cancelled) return;
      setUserState(restored);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [restoreOnMount]);

  const setUser = useCallback((next: AuthUser) => setUserState(next), []);
  const logout = useCallback(async () => {
    await apiLogout();
    setUserState(null);
  }, []);

  return <AuthContext.Provider value={{ user, status, setUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider dışında çağrıldı');
  return ctx;
}
