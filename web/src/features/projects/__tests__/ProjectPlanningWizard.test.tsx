import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../../../app/AuthContext';

vi.mock('../project.api', () => ({
  fetchProductGroups: vi.fn(async () => [{ id: 'g1', ad: 'Sensörler' }]),
  fetchProducts: vi.fn(async () => [{ id: 'p1', ad: 'Basınç Sensörü', product_group_id: 'g1' }]),
  fetchBusinessDays: vi.fn(async () => ({ totalBusinessDays: 40 })),
  createProject: vi.fn(async () => ({ id: 'yeni-proje-id' })),
}));
vi.mock('../../personnel/personnel.api', () => ({
  fetchEmployees: vi.fn(async () => [{ id: 'e1', ad: 'Ali', soyad: 'Kaya', email: 'a@b.c', durum: 'active' }]),
}));
vi.mock('../../../shared/hooks/useExchangeRate', async (orig) => ({
  ...(await orig<typeof import('../../../shared/hooks/useExchangeRate')>()),
  useExchangeRate: () => ({ data: { tarih: '2026-10-07', usdTry: 40 } }),
}));

import { createProject } from '../project.api';
import { ProjectPlanningWizard } from '../ProjectPlanningWizard';

afterEach(cleanup);
// @testing-library/jest-dom projede yok (bilinçli — bkz. usePermission.test.tsx) → DOM özelliği doğrudan okunur.
const isDisabled = (el: HTMLElement) => (el as HTMLButtonElement | HTMLSelectElement).disabled;
beforeEach(() => vi.mocked(createProject).mockClear());

function LoginAs({ superAdmin }: { superAdmin: boolean }) {
  const { setUser } = useAuth();
  useEffect(() => {
    setUser({ id: 'u1', email: 't@t.t', roleKod: superAdmin ? 'sirket_yoneticisi' : 'personel', isSuperAdmin: superAdmin, dilTercihi: 'tr' });
  }, [setUser, superAdmin]);
  return null;
}

function renderWizard(superAdmin = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider restoreOnMount={false}>
        <LoginAs superAdmin={superAdmin} />
        <MemoryRouter initialEntries={['/projects/new']}>
          <Routes>
            <Route path="/projects/new" element={<ProjectPlanningWizard />} />
            <Route path="/projects/:id" element={<div data-testid="detail">detay</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function fillStep1() {
  fireEvent.change(screen.getByLabelText('Proje adı'), { target: { value: 'Alfa Projesi' } });
  await screen.findByRole('option', { name: 'Sensörler' }); // seçenekler yüklenmeden değer atanırsa DOM değeri boşa düşer
  fireEvent.change(screen.getByLabelText('Ürün grubu'), { target: { value: 'g1' } });
  await screen.findByRole('option', { name: 'Basınç Sensörü' });
  fireEvent.change(screen.getByLabelText('Ürün'), { target: { value: 'p1' } });
  await screen.findByRole('option', { name: 'Ali Kaya' });
  fireEvent.change(screen.getByLabelText('Ekip lideri'), { target: { value: 'e1' } });
}

describe('ProjectPlanningWizard (Day 20)', () => {
  it('adım 1 doldurulmadan İleri pasif; doldurulunca aktif', async () => {
    renderWizard();
    expect(isDisabled(screen.getByRole('button', { name: 'İleri' }))).toBe(true);
    await fillStep1();
    expect(isDisabled(screen.getByRole('button', { name: 'İleri' }))).toBe(false);
  });

  it('ürün, seçili ürün grubu olmadan seçilemez', () => {
    renderWizard();
    expect(isDisabled(screen.getByLabelText('Ürün'))).toBe(true);
  });

  it('Kural #3: tarihler girilince süre önizlemesi iş gününden hesaplanır (40 iş günü ≈ 8 hafta)', async () => {
    renderWizard();
    await fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    fireEvent.change(screen.getByLabelText('Başlangıç tarihi'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Bitiş tarihi'), { target: { value: '2026-11-27' } });
    expect(await screen.findByText(/40 iş günü ≈ 8 hafta/)).toBeTruthy();
  });

  it('bitiş başlangıçtan önceyse uyarı gösterilir ve İleri pasif kalır', async () => {
    renderWizard();
    await fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    fireEvent.change(screen.getByLabelText('Başlangıç tarihi'), { target: { value: '2026-11-27' } });
    fireEvent.change(screen.getByLabelText('Bitiş tarihi'), { target: { value: '2026-10-05' } });
    expect(screen.getByRole('alert').textContent).toContain('önce olamaz');
    expect(isDisabled(screen.getByRole('button', { name: 'İleri' }))).toBe(true);
  });

  it('gönderim: idari oran % → oran (15 → 0.15), boş maliyet alanları gönderilmez, başarıda detay sayfasına gider', async () => {
    renderWizard();
    await fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    fireEvent.change(screen.getByLabelText('Başlangıç tarihi'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Bitiş tarihi'), { target: { value: '2026-11-27' } });
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    fireEvent.change(await screen.findByLabelText('Tahmini maliyet (TL)'), { target: { value: '80000' } });
    expect(screen.getByText(/\$2,000\.00/)).toBeTruthy(); // 80000 / 40 = 2000 USD (güncel kur önizlemesi)
    fireEvent.change(screen.getByLabelText('İdari maliyet oranı (%)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Projeyi oluştur' }));

    await waitFor(() => expect(createProject).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createProject).mock.calls[0][0]).toEqual({
      projeAdi: 'Alfa Projesi', baslangicTarihi: '2026-10-05', bitisTarihi: '2026-11-27',
      productGroupId: 'g1', productId: 'p1', ekipLideriId: 'e1',
      tahminiMaliyetTl: 80000, satisFiyatiTl: undefined, danismanlikMaliyetiTl: undefined,
      paketlemeGonderimMaliyetiTl: undefined, idariMaliyetOrani: 0.15,
    });
    expect(await screen.findByTestId('detail')).toBeTruthy();
  });

  it('yetkisiz kullanıcı maliyet alanlarını GÖRMEZ (Bölüm 4.4) ama projeyi yine oluşturabilir', async () => {
    renderWizard(false);
    await fillStep1();
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    fireEvent.change(screen.getByLabelText('Başlangıç tarihi'), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText('Bitiş tarihi'), { target: { value: '2026-11-27' } });
    fireEvent.click(screen.getByRole('button', { name: 'İleri' }));
    expect(screen.queryByLabelText('Tahmini maliyet (TL)')).toBeNull();
    expect(screen.getByText(/yalnızca yetkili yöneticiler/)).toBeTruthy();
    expect(isDisabled(screen.getByRole('button', { name: 'Projeyi oluştur' }))).toBe(false);
  });
});
