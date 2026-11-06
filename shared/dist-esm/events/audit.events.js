import { z } from 'zod';
/**
 * "Admin uçan kuştan bile haberdar olmalı" kuralının (roadmap.md Bölüm 17.4) teknik temeli.
 * Bu event, HER serviste HER yazma use-case'inin sonunda zorunlu olarak yayınlanır.
 */
export const AuditEventSchema = z.object({
    service: z.string(),
    eventType: z.enum(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'PERMISSION_CHANGE', 'VIEW_SENSITIVE']),
    actorUserId: z.guid().nullable(),
    actorEmail: z.string().email().nullable(),
    entityType: z.string(),
    entityId: z.guid().nullable(),
    ozet: z.string(), // "Aliye, Proje X'in 3. iş paketini tamamlandı işaretledi" gibi
    oncekiDeger: z.record(z.string(), z.unknown()).nullable().optional(),
    yeniDeger: z.record(z.string(), z.unknown()).nullable().optional(),
    severity: z.enum(['info', 'warning', 'critical']).default('info'),
    ipAdresi: z.string().nullable().optional(),
});
export const AUDIT_EVENTS = {
    GENERIC: 'audit.event',
};
