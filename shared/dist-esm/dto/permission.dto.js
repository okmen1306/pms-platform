import { z } from 'zod';
// identity_permissions kataloğu — her yeni sayfa/aksiyon eklendiğinde buraya bir kayıt düşer.
export const PermissionSchema = z.object({
    id: z.guid(),
    permissionKey: z.string().min(3), // 'finance.cost_analysis', 'admin.roles.manage', vb.
    grup: z.string(), // UI gruplama: 'Finans', 'Personel', 'Proje', 'Admin'
    ad: z.string(),
    createdAt: z.string().datetime(),
});
export const EffectivePermissionSchema = z.object({
    permissionKey: z.string(),
    canView: z.boolean(),
    canEdit: z.boolean(),
    isOverride: z.boolean(), // true ise bu kullanıcıya özel override'dan geliyor, rol varsayılanı değil
});
export const GrantUserPermissionOverrideDtoSchema = z
    .object({
    permissionId: z.guid(),
    canView: z.boolean().nullable().optional(),
    canEdit: z.boolean().nullable().optional(),
    gerekce: z.string().min(5, 'Gerekçe zorunludur (denetim kaydı için)'),
    expiresAt: z.string().datetime().nullable().optional(),
})
    .refine((v) => v.canView !== undefined || v.canEdit !== undefined, {
    message: 'En az canView veya canEdit belirtilmeli',
});
// Sistem geneli izin kataloğu anahtarları (permissionKey sabitleri) — tüm servisler burayı
// import eder, string literal'i elle tekrar yazmaz (yazım hatası riskini ortadan kaldırır).
export const PERMISSION_KEYS = {
    // --- Day 6-17'den (DEĞİŞMEDİ) ---
    ADMIN_ROLES_MANAGE: 'admin.roles.manage',
    ADMIN_AUDIT_LOG: 'admin.audit_log',
    PERSONNEL_SALARY: 'personnel.salary',
    PROJECT_ALL: 'project.all',
    FINANCE_COST_ANALYSIS: 'finance.cost_analysis',
    PERFORMANCE_ALL: 'performance.all',
    // --- Day 21 (G-01): gateway'in her modülü için bir anahtar. GET -> can_view, diğer yöntemler ->
    // can_edit (bkz. api-gateway/src/middleware/rbac.middleware.ts `requirePermissionByMethod`).
    ADMIN_USERS_MANAGE: 'admin.users.manage',
    PROJECT_RECORDS: 'project.records',
    PERSONNEL_RECORDS: 'personnel.records',
    PROCUREMENT_MATERIALS: 'procurement.materials',
    PERFORMANCE_SCORE: 'performance.score',
    RISK_ANALYSIS: 'risk.analysis',
    REPORTS_VIEW: 'reports.view',
    INTEGRATION_HOLIDAYS: 'integration.holidays',
    NOTIFICATION_TEMPLATES: 'notification.templates',
};
