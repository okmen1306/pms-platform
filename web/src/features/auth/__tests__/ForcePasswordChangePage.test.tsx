import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../../../app/AuthContext';
import { RequireAuth } from '../../../app/RequireAuth';

const changeCalls: [string, string][] = [];
let changeImpl: () => Promise<void> = async () => {};
vi.mock('../auth.api', async (orig) => ({
  ...(await orig<typeof import('../auth.api')>()),
  changeOwnPassword: (c: string, n: string) => {
    changeCalls.push([c, n]);
    return changeImpl();
  },
}));

const logout = vi.fn(async () => {});
function renderAs(user: { mustChangePassword?: boolean } | null) {
  const value = {
    user: user && { id: 'u1', email: 'a@b.com', roleKod: 'personel', isSuperAdmin: false, dilTercihi: 'tr' as const, ...user },
    status: user ? ('authenticated' as const) : ('unauthenticated' as const),
    setUser: () => {},
    logout,
  };
  return render(
    <AuthContext.Provider value={value as never}>
      <MemoryRouter initialEntries={['/projects']}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<div>PROJELER</div>} />
          </Route>
          <Route path="/login" element={<div>GİRİŞ</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
const fill = async (cur: string, next: string, again: string) => {
  fireEvent.change(screen.getByLabelText('Geçici parola'), { target: { value: cur } });
  fireEvent.change(screen.getByLabelText('Yeni parola'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Yeni parola (tekrar)'), { target: { value: again } });
  fireEvent.click(screen.getByRole('button', { name: 'Parolayı değiştir' }));
};

beforeEach(() => {
  changeCalls.length = 0;
  changeImpl = async () => {};
  logout.mockClear();
});
afterEach(cleanup);

describe('geçici parola zorlaması (Day 22, G-02)', () => {
  it('mustChangePassword=true: uygulama sayfası YERİNE parola ekranı; bayrak yoksa normal sayfa', () => {
    renderAs({ mustChangePassword: true });
    expect(screen.getByText('Parolanızı belirleyin')).toBeTruthy();
    expect(screen.queryByText('PROJELER')).toBeNull();
    cleanup();
    renderAs({ mustChangePassword: false });
    expect(screen.getByText('PROJELER')).toBeTruthy();
  });

  it('zayıf / uyuşmayan / geçici parolayla aynı parola API\'ye HİÇ gitmez, hatalar listelenir', async () => {
    renderAs({ mustChangePassword: true });
    await fill('Gecici-Parola-1', 'zayif', 'baska');
    expect(screen.getByRole('alert').textContent).toMatch(/en az 10 karakter/);
    expect(screen.getByRole('alert').textContent).toMatch(/aynı olmalı/);
    expect(changeCalls).toHaveLength(0);
  });

  it('geçerli parola gönderilir; başarıda "yeniden giriş" ekranı, buton logout çağırır', async () => {
    renderAs({ mustChangePassword: true });
    await fill('Gecici-Parola-1', 'Yeni-Parola-42', 'Yeni-Parola-42');
    await waitFor(() => expect(screen.getByText('Parolanız değiştirildi')).toBeTruthy());
    expect(changeCalls).toEqual([['Gecici-Parola-1', 'Yeni-Parola-42']]);
    fireEvent.click(screen.getByRole('button', { name: 'Girişe dön' }));
    expect(logout).toHaveBeenCalled();
  });

  it('sunucu hatası (ör. yanlış geçici parola) kullanıcıya gösterilir, form açık kalır', async () => {
    changeImpl = async () => {
      throw new Error('Mevcut parola hatalı.');
    };
    renderAs({ mustChangePassword: true });
    await fill('Yanlis-Parola-9', 'Yeni-Parola-42', 'Yeni-Parola-42');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Mevcut parola hatalı.'));
    expect(screen.queryByText('Parolanız değiştirildi')).toBeNull();
  });
});
