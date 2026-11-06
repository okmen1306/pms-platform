import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Role, UserListItem } from '../identity.api';

// ---- identity.api sahte: çağrı sırası ve gövdeleri doğrulanır, ağa çıkılmaz --------------------
const calls: Array<[string, ...unknown[]]> = [];
const ROLES: Role[] = [
  { id: 'r-admin', kod: 'sirket_yoneticisi', ad: 'Şirket Yöneticisi', aciklama: null, sistem_rolu: true, aktif: true },
  { id: 'r-ik', kod: 'ik_yoneticisi', ad: 'İK Yöneticisi', aciklama: null, sistem_rolu: true, aktif: true },
  { id: 'r-saha', kod: 'saha_muhendisi', ad: 'Saha Mühendisi', aciklama: null, sistem_rolu: false, aktif: true },
];
const user = (over: Partial<UserListItem>): UserListItem => ({
  id: 'u1',
  email: 'ali@acme.test',
  roleId: 'r-saha',
  roleKod: 'saha_muhendisi',
  roleAd: 'Saha Mühendisi',
  isSuperAdmin: false,
  isActive: true,
  mustChangePassword: false,
  personnelId: null,
  dilTercihi: 'tr',
  lastLoginAt: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...over,
});
let USERS: UserListItem[] = [];

vi.mock('../identity.api', () => ({
  fetchRoles: async () => ROLES,
  fetchUsers: async (f: { role?: string } = {}) => (f.role ? USERS.filter((u) => u.roleKod === f.role) : USERS),
  createUser: async (i: unknown) => (calls.push(['createUser', i]), USERS[0]),
  changeUserRole: async (id: string, roleId: string) => (calls.push(['changeUserRole', id, roleId]), USERS[0]),
  createRole: async () => ROLES[0],
  updateRole: async (id: string, patch: unknown) => (calls.push(['updateRole', id, patch]), ROLES[0]),
  deleteRole: async (id: string) => void calls.push(['deleteRole', id]),
  fetchRolePermissions: async () => [
    { permissionId: 'p1', permissionKey: 'reports.view', grup: 'Rapor', ad: 'Raporlar', canView: true, canEdit: false },
    { permissionId: 'p2', permissionKey: 'finance.cost_analysis', grup: 'Finans', ad: 'Maliyet', canView: false, canEdit: false },
  ],
  updateRolePermissions: async (id: string, perms: unknown) => void calls.push(['updateRolePermissions', id, perms]),
  fetchUserOverrides: async () => [],
  grantUserOverride: async (uid: string, i: unknown) => (calls.push(['grantUserOverride', uid, i]), {}),
  revokeUserOverride: async () => {},
}));

// Yetki kapısı: hangi anahtarlara `edit`/`view` verildiği teste göre değişir.
let allowed: Record<string, boolean> = {};
vi.mock('../../../shared/hooks/usePermission', () => ({
  usePermission: (key: string, need: 'view' | 'edit' = 'view') => !!allowed[`${key}:${need}`] || !!allowed[`${key}:*`],
  useMyPermissions: () => ({ permissions: [], isLoading: false, isSuperAdmin: false, isAuthenticated: true }),
}));

import { UserListPage } from '../UserListPage';
import { UserOverridePanel } from '../UserOverridePanel';
import { RoleManagementPage } from '../RoleManagementPage';
import { PermissionMatrixPage } from '../PermissionMatrixPage';

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  calls.length = 0;
  USERS = [user({})];
  allowed = {};
});
afterEach(cleanup);

describe('UserListPage (Day 22, G-02/G-07)', () => {
  it('izni olmayan kullanıcı sayfayı görmez', () => {
    wrap(<UserListPage />);
    expect(screen.getByText('Bu sayfayı görüntüleme yetkiniz yok')).toBeTruthy();
  });

  it('ik_yoneticisi (yalnız admin.users.manage): liste + oluşturma VAR; rol seçici ve İzinler butonu YOK', async () => {
    allowed = { 'admin.users.manage:*': true };
    wrap(<UserListPage />);
    await screen.findByText('ali@acme.test');
    expect(screen.getByRole('button', { name: 'Kullanıcı oluştur' })).toBeTruthy();
    expect(screen.queryByLabelText('ali@acme.test rolü')).toBeNull();
    expect(screen.queryByRole('button', { name: 'İzinler' })).toBeNull();
  });

  it('oluşturma: alanlar dolmadan buton pasif; doluysa gövde doğru gider ve parola temizlenir', async () => {
    allowed = { 'admin.users.manage:*': true };
    wrap(<UserListPage />);
    await screen.findByText('ali@acme.test');
    const submit = screen.getByRole('button', { name: 'Kullanıcı oluştur' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'yeni@acme.test' } });
    fireEvent.change(screen.getByLabelText('Geçici parola'), { target: { value: 'Gecici-Parola-1' } });
    await waitFor(() => expect(screen.getAllByRole('option', { name: 'Saha Mühendisi' }).length).toBeGreaterThan(0));
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'r-saha' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(calls).toContainEqual(['createUser', { email: 'yeni@acme.test', temporaryPassword: 'Gecici-Parola-1', roleId: 'r-saha' }]));
    await waitFor(() => expect((screen.getByLabelText('Geçici parola') as HTMLInputElement).value).toBe(''));
  });

  it('admin.roles.manage sahibi: rol değiştirebilir; süper admin satırında seçici yok', async () => {
    allowed = { 'admin.users.manage:*': true, 'admin.roles.manage:*': true };
    USERS = [user({}), user({ id: 'u2', email: 'root@acme.test', isSuperAdmin: true })];
    wrap(<UserListPage />);
    const select = (await screen.findByLabelText('ali@acme.test rolü')) as HTMLSelectElement;
    expect(screen.queryByLabelText('root@acme.test rolü')).toBeNull();
    fireEvent.change(select, { target: { value: 'r-ik' } });
    await waitFor(() => expect(calls).toContainEqual(['changeUserRole', 'u1', 'r-ik']));
  });
});

describe('UserOverridePanel (Day 22, G-07)', () => {
  it('gerekçe < 5 karakter ya da iki alan da "rolden" iken gönderilemez; geçerliyse gövde doğru gider', async () => {
    wrap(<UserOverridePanel user={user({})} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('option', { name: /Raporlar/ })).toBeTruthy());
    const submit = screen.getByRole('button', { name: 'Override ver' }) as HTMLButtonElement;

    fireEvent.change(screen.getByLabelText('İzin'), { target: { value: 'p2' } });
    fireEvent.change(screen.getByLabelText('Gerekçe'), { target: { value: 'kısa' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Gerekçe'), { target: { value: 'Geçici maliyet erişimi gerekiyor' } });
    expect(submit.disabled).toBe(true); // Görüntüle/Düzenle ikisi de "rolden gelsin"
    expect(screen.getByText(/en az biri rolden farklı olmalı/)).toBeTruthy();

    fireEvent.change(screen.getAllByDisplayValue('Rolden gelsin')[0], { target: { value: 'ver' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(calls).toContainEqual([
        'grantUserOverride',
        'u1',
        { permissionId: 'p2', canView: true, canEdit: null, gerekce: 'Geçici maliyet erişimi gerekiyor', expiresAt: null },
      ]),
    );
  });
});

describe('RoleManagementPage — silme akışı (Day 22, G-07)', () => {
  beforeEach(() => {
    allowed = { 'admin.roles.manage:*': true };
  });

  it('sistem rolünde Sil ve Pasife al butonları pasif ve nedeni başlıkta', async () => {
    wrap(<RoleManagementPage />);
    await screen.findByText('Şirket Yöneticisi');
    const row = screen.getByTestId('role-row-sirket_yoneticisi');
    const del = within(row).getByRole('button', { name: 'Sil' }) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
    expect(del.title).toMatch(/Sistem rolü silinemez/);
    expect((within(row).getByRole('button', { name: 'Pasife al' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('kullanıcısı olan rolü silerken hedef rol ZORUNLU; önce kullanıcılar taşınır, sonra rol silinir', async () => {
    USERS = [user({}), user({ id: 'u3', email: 'veli@acme.test' })];
    wrap(<RoleManagementPage />);
    await screen.findByText('Saha Mühendisi');
    const row = screen.getByTestId('role-row-saha_muhendisi');
    fireEvent.click(within(row).getByRole('button', { name: 'Sil' }));

    const panel = await screen.findByTestId('delete-role-panel');
    await waitFor(() => expect(panel.textContent).toMatch(/2.*kullanıcıyı hangi role taşıyalım/s));
    const confirm = within(panel).getByRole('button', { name: 'Taşı ve sil' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    // Hedef listesinde silinen rolün kendisi yok.
    expect(within(panel).queryByRole('option', { name: 'Saha Mühendisi' })).toBeNull();

    fireEvent.change(within(panel).getByLabelText('Hedef rol'), { target: { value: 'r-ik' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(calls.at(-1)).toEqual(['deleteRole', 'r-saha']));
    expect(calls.slice(0, 2)).toEqual([
      ['changeUserRole', 'u1', 'r-ik'],
      ['changeUserRole', 'u3', 'r-ik'],
    ]);
  });

  it('kullanıcısı olmayan rol: hedef seçimi istenmez, doğrudan silinir', async () => {
    USERS = [];
    wrap(<RoleManagementPage />);
    await screen.findByText('Saha Mühendisi');
    const row = screen.getByTestId('role-row-saha_muhendisi');
    fireEvent.click(within(row).getByRole('button', { name: 'Sil' }));
    const panel = await screen.findByTestId('delete-role-panel');
    expect(within(panel).queryByLabelText('Hedef rol')).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Taşı ve sil' }));
    await waitFor(() => expect(calls).toEqual([['deleteRole', 'r-saha']]));
  });
});

describe('PermissionMatrixPage — toplu kayıt (Day 22, G-07)', () => {
  it('yalnızca değişen role, tek PUT ile tüm satırlarıyla gider; Düzenle işareti Görüntüle’yi de açar', async () => {
    allowed = { 'admin.roles.manage:*': true };
    wrap(<PermissionMatrixPage />);
    const save = (await screen.findByRole('button', { name: /^Kaydet/ })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    // "Maliyet" (p2) başlangıçta ne görüntüleme ne düzenleme: Düzenle'yi işaretle -> Görüntüle de gelir.
    const edit = (await screen.findByLabelText('İK Yöneticisi Maliyet düzenle')) as HTMLInputElement;
    const view = screen.getByLabelText('İK Yöneticisi Maliyet görüntüle') as HTMLInputElement;
    fireEvent.click(edit);
    expect(edit.checked).toBe(true);
    expect(view.checked).toBe(true);
    expect(save.textContent).toMatch(/1 rol/);

    fireEvent.click(save);
    await waitFor(() => expect(calls.filter((c) => c[0] === 'updateRolePermissions')).toHaveLength(1));
    expect(calls.find((c) => c[0] === 'updateRolePermissions')).toEqual([
      'updateRolePermissions',
      'r-ik',
      [
        { permissionId: 'p1', canView: true, canEdit: false },
        { permissionId: 'p2', canView: true, canEdit: true },
      ],
    ]);
  });

  it('hücreyi eski değerine döndürmek değişikliği geri alır (Kaydet tekrar pasif)', async () => {
    allowed = { 'admin.roles.manage:*': true };
    wrap(<PermissionMatrixPage />);
    const save = (await screen.findByRole('button', { name: /^Kaydet/ })) as HTMLButtonElement;
    const view = (await screen.findByLabelText('Saha Mühendisi Maliyet görüntüle')) as HTMLInputElement;
    fireEvent.click(view);
    expect(save.disabled).toBe(false);
    fireEvent.click(view);
    expect(save.disabled).toBe(true);
  });
});
