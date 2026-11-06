import { PERMISSION_KEYS } from '@pms/shared';

export interface NavItem {
  label: string;
  to: string;
  /** Menüde yalnızca bu izne `view` ile sahip kullanıcılara görünür (Bölüm 18: yetkisiz öğe TAMAMEN gizli). */
  permissionKey: string;
}
export interface NavGroup {
  title: string;
  items: NavItem[];
}

const K = PERMISSION_KEYS;

/**
 * Day 21 (F1): AppShell menüsü. Her öğenin izin anahtarı, gateway'in o rotaya uyguladığı anahtarla
 * AYNI (bkz. docs/testing/rbac-matrix.md) — menüde görünen sayfa gateway'de 403 vermez.
 */
export const NAV_GROUPS: NavGroup[] = [
  { title: 'Proje', items: [{ label: 'Projeler', to: '/projects', permissionKey: K.PROJECT_RECORDS }] },
  {
    title: 'Personel',
    items: [
      { label: 'Personel', to: '/personnel/employees', permissionKey: K.PERSONNEL_RECORDS },
      { label: 'Ekipler', to: '/personnel/teams', permissionKey: K.PERSONNEL_RECORDS },
    ],
  },
  { title: 'Satın Alma', items: [{ label: 'Malzemeler', to: '/procurement/materials', permissionKey: K.PROCUREMENT_MATERIALS }] },
  {
    title: 'Finans',
    items: [
      { label: 'Maliyet Analizi', to: '/finance/cost-analysis', permissionKey: K.FINANCE_COST_ANALYSIS },
      { label: 'Ar-Ge Maliyeti', to: '/finance/arge-cost', permissionKey: K.FINANCE_COST_ANALYSIS },
    ],
  },
  {
    title: 'Performans',
    items: [
      { label: 'Personel Performansı', to: '/performance/employee', permissionKey: K.PERFORMANCE_SCORE },
      { label: 'Ekip Performansı', to: '/performance/team', permissionKey: K.PERFORMANCE_SCORE },
      { label: 'Puanlama', to: '/performance/score', permissionKey: K.PERFORMANCE_SCORE },
    ],
  },
  { title: 'Risk', items: [{ label: 'Risk Kaydı', to: '/risk/register', permissionKey: K.RISK_ANALYSIS }] },
  {
    title: 'Raporlar',
    items: [
      { label: 'İş Akışı', to: '/reports/workflow', permissionKey: K.REPORTS_VIEW },
      { label: 'Tamamlanma', to: '/reports/completion-status', permissionKey: K.REPORTS_VIEW },
      { label: 'Proje Planlayıcı', to: '/reports/project-planner', permissionKey: K.REPORTS_VIEW },
      { label: 'İş Detayı', to: '/reports/work-detail', permissionKey: K.REPORTS_VIEW },
    ],
  },
  {
    title: 'Yönetim',
    items: [
      { label: 'Kullanıcılar', to: '/admin/users', permissionKey: K.ADMIN_USERS_MANAGE },
      { label: 'Aktivite Akışı', to: '/admin/activity', permissionKey: K.ADMIN_AUDIT_LOG },
      { label: 'Roller', to: '/admin/roles', permissionKey: K.ADMIN_ROLES_MANAGE },
      { label: 'İzin Matrisi', to: '/admin/permission-matrix', permissionKey: K.ADMIN_ROLES_MANAGE },
    ],
  },
];

/** Süper admin hepsini görür; diğerleri yalnızca `canView` izni olan öğeleri. Boş kalan grup düşer. */
export function visibleNavGroups(can: (permissionKey: string) => boolean): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permissionKey)) })).filter((g) => g.items.length > 0);
}

/** Yol önekine göre sayfanın gerektirdiği izin (doğrudan URL ile girişi engellemek için). */
export function permissionForPath(pathname: string): string | null {
  const all = NAV_GROUPS.flatMap((g) => g.items);
  const hit = all.find((i) => pathname === i.to || pathname.startsWith(i.to + '/'));
  if (hit) return hit.permissionKey;
  if (pathname === '/personnel/employees/new') return K.PERSONNEL_RECORDS;
  if (pathname === '/projects/new') return K.PROJECT_RECORDS;
  return null;
}
