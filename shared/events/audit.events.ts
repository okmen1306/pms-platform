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
  ozet: z.string(),                 // "Aliye, Proje X'in 3. iş paketini tamamlandı işaretledi" gibi
  oncekiDeger: z.record(z.string(), z.unknown()).nullable().optional(),
  yeniDeger: z.record(z.string(), z.unknown()).nullable().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  ipAdresi: z.string().nullable().optional(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AUDIT_EVENTS = {
  GENERIC: 'audit.event',
} as const;

/**
 * Her servisteki use-case'lerin çağıracağı tek ortak yardımcı imza. Gerçek implementasyon
 * (RabbitMQ publish) her serviste kendi messaging katmanında yapılır; bu sadece TİP sözleşmesidir
 * ki bir servis "audit.event" yayınlamayı unutursa derleme zamanında değil ama code review'da
 * kolayca fark edilsin (her use-case dosyasında bu tip import edilmiş olmalı).
 */
export type AuditPublisherFn = (event: Omit<AuditEvent, 'service'>) => Promise<void>;
