import { PERMISSION_KEYS, type PermissionKey } from './permission.dto';

/**
 * Day 21 (TL, G-01): izin kataloğu + 5 seed rolün varsayılan izin matrisi için TEK KAYNAK.
 * `migrations/supabase/013_seed_data.sql`'in "GENERATED" bloğu `renderPermissionSeedSql()`'in
 * çıktısıdır; api-gateway'in `permission-catalog.test.ts`'i dosya ile bu fonksiyonun çıktısı
 * birebir aynı değilse kırılır (kaynak ve SQL birbirinden sessizce ayrışamaz).
 * Bu matris docs/roadmap.md Bölüm 1 "Rol (seed)" tablosunun koda çevrilmiş hâlidir.
 */
export interface PermissionCatalogEntry {
  key: PermissionKey;
  grup: string;
  ad: string;
}

export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  { key: PERMISSION_KEYS.ADMIN_ROLES_MANAGE, grup: 'Admin', ad: 'Rol ve izin yönetimi' },
  { key: PERMISSION_KEYS.ADMIN_AUDIT_LOG, grup: 'Admin', ad: 'Denetim kaydı görüntüleme' },
  { key: PERMISSION_KEYS.ADMIN_USERS_MANAGE, grup: 'Admin', ad: 'Kullanıcı yönetimi' },
  { key: PERMISSION_KEYS.PERSONNEL_SALARY, grup: 'Personel', ad: 'Personel maaş bilgisi görüntüleme' },
  { key: PERMISSION_KEYS.PERSONNEL_RECORDS, grup: 'Personel', ad: 'Personel kayıtları (liste, ekip, pasife alma)' },
  { key: PERMISSION_KEYS.PROJECT_ALL, grup: 'Proje', ad: 'Tüm projelere erişim' },
  { key: PERMISSION_KEYS.PROJECT_RECORDS, grup: 'Proje', ad: 'Proje, iş paketi ve atama kayıtları' },
  { key: PERMISSION_KEYS.FINANCE_COST_ANALYSIS, grup: 'Finans', ad: 'Finansal maliyet analizi' },
  { key: PERMISSION_KEYS.PERFORMANCE_ALL, grup: 'Performans', ad: 'Tüm performans verilerine erişim' },
  { key: PERMISSION_KEYS.PERFORMANCE_SCORE, grup: 'Performans', ad: 'Performans puanlama' },
  { key: PERMISSION_KEYS.RISK_ANALYSIS, grup: 'Risk', ad: 'Risk analizi' },
  { key: PERMISSION_KEYS.PROCUREMENT_MATERIALS, grup: 'Satın Alma', ad: 'Malzeme girişi ve stok takibi' },
  { key: PERMISSION_KEYS.REPORTS_VIEW, grup: 'Raporlar', ad: 'Raporları görüntüleme' },
  { key: PERMISSION_KEYS.INTEGRATION_HOLIDAYS, grup: 'Entegrasyon', ad: 'Resmî tatil ve kur override yönetimi' },
  { key: PERMISSION_KEYS.NOTIFICATION_TEMPLATES, grup: 'Bildirim', ad: 'E-posta şablonu yönetimi' },
];

export const SEED_ROLE_KODLARI = [
  'sirket_yoneticisi',
  'ekip_lideri',
  'ik_yoneticisi',
  'satinalma_personeli',
  'personel',
] as const;
export type SeedRoleKod = (typeof SEED_ROLE_KODLARI)[number];

/** 'V' = yalnızca görüntüle, 'VE' = görüntüle + düzenle. Listede olmayan izin = ikisi de FALSE. */
export type PermissionGrant = 'V' | 'VE';

const K = PERMISSION_KEYS;

/**
 * Varsayılan matris. Gerekçeler (roadmap Bölüm 1 "Varsayılan Kısıtlar"):
 * - sirket_yoneticisi: "tüm ekranlar, tüm raporlar, maliyet analizi, rol/izin yönetimi" -> hepsi VE.
 *   (is_super_admin bayrağı bunun ÜSTÜNDE ayrı bir garanti; satırlar tutarlılık + bayraksız
 *   sirket_yoneticisi kullanıcısının da yazabilmesi için.)
 * - ekip_lideri: maaş, maliyet analizi, admin YOK; proje/performans puanı/risk VE; personel listesi V.
 * - ik_yoneticisi: personel CRUD + maaş + kullanıcı oluşturma (Day 22 `POST /users`); proje/maliyet YOK.
 * - satinalma_personeli: YALNIZCA procurement.
 * - personel: proje/performans/risk için yalnızca V. NOT: "yalnızca KENDİ kayıtları" kısıtı veri
 *   seviyesinde (satır filtresi) bir kuraldır, anahtar seviyesinde ifade edilemez -> G-21.
 */
export const DEFAULT_ROLE_MATRIX: Record<SeedRoleKod, Partial<Record<PermissionKey, PermissionGrant>>> = {
  sirket_yoneticisi: Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.key, 'VE' as const])),
  ekip_lideri: {
    [K.PROJECT_RECORDS]: 'VE',
    [K.PERSONNEL_RECORDS]: 'V',
    [K.PERFORMANCE_SCORE]: 'VE',
    [K.RISK_ANALYSIS]: 'VE',
    [K.REPORTS_VIEW]: 'V',
  },
  ik_yoneticisi: {
    [K.PERSONNEL_RECORDS]: 'VE',
    [K.PERSONNEL_SALARY]: 'VE',
    [K.ADMIN_USERS_MANAGE]: 'VE',
  },
  satinalma_personeli: {
    [K.PROCUREMENT_MATERIALS]: 'VE',
  },
  personel: {
    [K.PROJECT_RECORDS]: 'V',
    [K.PERFORMANCE_SCORE]: 'V',
    [K.RISK_ANALYSIS]: 'V',
  },
};

const sqlStr = (v: string) => `'${v.replace(/'/g, "''")}'`;

export const PERMISSION_SEED_BEGIN = '-- BEGIN GENERATED: permission-catalog (shared/dto/permission-catalog.ts) — ELLE DÜZENLEME';
export const PERMISSION_SEED_END = '-- END GENERATED: permission-catalog';

/** 013_seed_data.sql'in izin kataloğu + rol-izin matrisi bloğu. Rol satırları ayrıca (bölüm 2) seed edilir. */
export function renderPermissionSeedSql(): string {
  const catalog = PERMISSION_CATALOG.map((p) => `  (${sqlStr(p.key)}, ${sqlStr(p.grup)}, ${sqlStr(p.ad)})`).join(',\n');
  const grants: string[] = [];
  for (const rol of SEED_ROLE_KODLARI) {
    for (const p of PERMISSION_CATALOG) {
      const g = DEFAULT_ROLE_MATRIX[rol][p.key];
      grants.push(`  (${sqlStr(rol)}, ${sqlStr(p.key)}, ${g ? 'TRUE' : 'FALSE'}, ${g === 'VE' ? 'TRUE' : 'FALSE'})`);
    }
  }
  return [
    PERMISSION_SEED_BEGIN,
    'INSERT INTO identity_permissions (permission_key, grup, ad) VALUES',
    `${catalog};`,
    '',
    '-- Rol -> izin matrisi: 5 rol × tüm izinler, her hücre açık (rol_kod, izin, can_view, can_edit).',
    'INSERT INTO identity_role_permissions (role_id, permission_id, can_view, can_edit)',
    'SELECT r.id, p.id, g.can_view, g.can_edit',
    'FROM (VALUES',
    `${grants.join(',\n')}`,
    ') AS g(rol_kod, permission_key, can_view, can_edit)',
    'JOIN identity_roles r ON r.kod = g.rol_kod',
    'JOIN identity_permissions p ON p.permission_key = g.permission_key;',
    PERMISSION_SEED_END,
  ].join('\n');
}
