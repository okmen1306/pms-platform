import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './AuthContext';
import '../shared/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/**
 * Day 1: QueryClient + i18n aktif. Q (Day 10): AuthProvider eklendi — bu satırın Day 2'de
 * eklenmesi PLANLANMIŞTI ("AuthProvider (JWT/kullanıcı context'i), Day 2'de identity-service
 * login akışıyla birlikte eklenecek") ama hiç tutulmamıştı (bkz. AuthContext.tsx Day 10 notu).
 * Bugünkü hâli hâlâ MOCK (gerçek JWT/kalıcı oturum Day 18'de).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
