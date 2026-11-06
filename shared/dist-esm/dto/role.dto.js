import { z } from 'zod';
/**
 * NOT (Day 0 uzman inisiyatifi): Roadmap'in orijinal /shared/dto listesinde bu dosya yoktu.
 * Dinamik rol/izin sistemi (roadmap.md Bölüm 17) identity-service'in Day 1 kapsamında
 * olduğundan, rol ve izin sözleşmelerinin en baştan donmuş olması gerekiyordu — aksi halde
 * api-gateway (RBAC middleware) ve admin paneli farklı response şekilleri bekleyebilirdi.
 * Bkz. CHANGELOG.md Day 0.
 */
export const RoleSchema = z.object({
    id: z.guid(),
    kod: z.string().min(2).max(64),
    ad: z.string().min(2),
    aciklama: z.string().nullable(),
    sistemRolu: z.boolean().default(false),
    aktif: z.boolean().default(true),
    createdBy: z.guid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});
export const CreateRoleDtoSchema = z.object({
    kod: z
        .string()
        .min(2)
        .max(64)
        .regex(/^[a-z0-9_]+$/, 'kod sadece küçük harf, rakam ve alt çizgi içerebilir'),
    ad: z.string().min(2),
    aciklama: z.string().optional(),
    // "kopyala" senaryosu: yeni rol, mevcut bir rolün izin matrisiyle başlar
    copyPermissionsFromRoleId: z.guid().optional(),
});
export const UpdateRoleDtoSchema = z.object({
    ad: z.string().min(2).optional(),
    aciklama: z.string().optional(),
    aktif: z.boolean().optional(),
});
export const RolePermissionEntrySchema = z.object({
    permissionId: z.guid(),
    canView: z.boolean(),
    canEdit: z.boolean(),
});
// PUT /roles/:id/permissions body'si — tüm matris tek seferde kaydedilir
export const UpdateRolePermissionsDtoSchema = z.object({
    permissions: z.array(RolePermissionEntrySchema),
});
