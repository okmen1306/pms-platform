import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../app/AuthContext';
import { usePermission } from '../usePermission';

// apiFetch bilinçli olarak vi.fn() DEĞİL, düz bir sarmalayıcı: vitest'in casus (spy) katmanı reddedilen
// promise'in `settledResults` kopyasına yakalanmamış rejection üretiyor ve hata-yolu testini yapay
// olarak kırıyordu. Çağrıları `calls` dizisinden doğruluyoruz.
let apiImpl: (...a: unknown[]) => Promise<unknown> = async () => [];
const calls: unknown[][] = [];
vi.mock('../../api', async (orig) => ({
  ...(await orig<typeof import('../../api')>()),
  apiFetch: (...a: unknown[]) => {
    calls.push(a);
    return apiImpl(...a);
  },
}));
beforeEach(() => {
  calls.length = 0;
  apiImpl = async () => [];
});

function Providers({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <AuthProvider restoreOnMount={false}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

// Vitest'in globals:true AYARI yok (bilinçli — proje genelinde açık import tercih ediliyor),
// bu yüzden @testing-library/react'ın otomatik temizliği tetiklenmiyor; testler arasında DOM
// kalıntısı KALMASIN diye elle temizleniyor.
afterEach(cleanup);

/**
 * Q (Day 10): `web` paketindeki İLK test dosyası. Playwright E2E senaryosunun (bkz.
 * e2e/tests/login-role-visibility.spec.ts) test ettiği AYNI mantığı — ama bu sandbox'ta gerçek
 * bir tarayıcı çalıştırılamadığından (bkz. CHANGELOG.md Day 8 notu) — React Testing Library ile
 * DOĞRUDAN doğrular. İkisi TAMAMLAYICI: Playwright kullanıcının GÖRDÜĞÜ şeyi (gerçek DOM, gerçek
 * navigasyon) test eder, bu dosya ALTINDAKİ mantığı (AuthContext + usePermission) izole test eder.
 */
function TestConsumer({ permissionKey }: { permissionKey: string }) {
  const canView = usePermission(permissionKey, 'view');
  return <div data-testid="result">{canView ? 'GÖRÜNÜR' : 'GİZLİ'}</div>;
}

function LoginButton({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { setUser } = useAuth();
  return (
    <button
      onClick={() =>
        setUser({ id: 'u1', email: 'test@example.com', roleKod: isSuperAdmin ? 'sirket_yoneticisi' : 'personel', isSuperAdmin, dilTercihi: 'tr' })
      }
    >
      giriş yap
    </button>
  );
}

describe('usePermission + AuthContext', () => {
  it('giriş yapılmamışsa (user: null) her izin GİZLİ döner', () => {
    render(
      <Providers>
        <TestConsumer permissionKey="finance.cost_analysis" />
      </Providers>,
    );
    expect(screen.getByTestId('result').textContent).toBe('GİZLİ');
  });

  it('isSuperAdmin:true ile giriş yapılınca istenen HER izin GÖRÜNÜR olur', () => {
    render(
      <Providers>
        <LoginButton isSuperAdmin={true} />
        <TestConsumer permissionKey="finance.cost_analysis" />
      </Providers>,
    );
    expect(screen.getByTestId('result').textContent).toBe('GİZLİ');
    act(() => screen.getByText('giriş yap').click());
    expect(screen.getByTestId('result').textContent).toBe('GÖRÜNÜR');
  });

  it('isSuperAdmin:false (personel) ile giriş yapılınca izin HÂLÂ GİZLİ kalır', () => {
    render(
      <Providers>
        <LoginButton isSuperAdmin={false} />
        <TestConsumer permissionKey="finance.cost_analysis" />
      </Providers>,
    );
    act(() => screen.getByText('giriş yap').click());
    expect(screen.getByTestId('result').textContent).toBe('GİZLİ');
  });

  it('süper admin ağa HİÇ çıkmadan her izni görür', () => {
    render(
      <Providers>
        <LoginButton isSuperAdmin={true} />
        <TestConsumer permissionKey="x.y" />
      </Providers>,
    );
    act(() => screen.getByText('giriş yap').click());
    expect(screen.getByTestId('result').textContent).toBe('GÖRÜNÜR');
    expect(calls).toHaveLength(0);
  });

  it('personel: izinler gateway\'den gelir — view\'u olan görünür, olmayan ve edit gerektiren GİZLİ (Day 21, G-20)', async () => {
    apiImpl = async () => [{ permissionKey: 'project.records', canView: true, canEdit: false, isOverride: false }];
    function Two() {
      const v = usePermission('project.records', 'view');
      const e = usePermission('project.records', 'edit');
      const f = usePermission('finance.cost_analysis', 'view');
      return <div data-testid="r">{`${v}|${e}|${f}`}</div>;
    }
    render(
      <Providers>
        <LoginButton isSuperAdmin={false} />
        <Two />
      </Providers>,
    );
    act(() => screen.getByText('giriş yap').click());
    await waitFor(() => expect(screen.getByTestId('r').textContent).toBe('true|false|false'));
    expect(calls[0][0]).toBe('/identity/me/effective-permissions');
  });

  it('izin sorgusu hata verirse (ör. identity-service çökük) KAPALI kalır — izin yok sayılır', async () => {
    apiImpl = async () => {
      throw new Error('503');
    };
    render(
      <Providers>
        <LoginButton isSuperAdmin={false} />
        <TestConsumer permissionKey="project.records" />
      </Providers>,
    );
    await act(async () => {
      screen.getByText('giriş yap').click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.getByTestId('result').textContent).toBe('GİZLİ');
  });
});
