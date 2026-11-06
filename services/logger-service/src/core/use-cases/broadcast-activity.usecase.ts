import type { AuditEventRow } from '../../infrastructure/database/audit.repository';
import type { SseBroadcaster } from '../../infrastructure/realtime/sse-broadcaster';

/**
 * TL (Day 10): roadmap'in kendi dosya ağacındaki yorum — "kalici kayittan sonra SSE ile admin'e
 * it" (bkz. Bölüm 5 dosya mimarisi). `audit-event.consumer.ts` (Day 9), `recordAuditEvent` ile
 * KALICI kayıttan hemen sonra bunu çağırır — sıralama önemli: SSE bağlantısı hiç açık olmasa da
 * (kimse admin panelini açmamışsa) kalıcı kayıt ZATEN yapılmış olmalı (append-only denetim
 * kaydının güvenilirliği SSE'ye bağlı değildir).
 */
export function broadcastActivity(row: AuditEventRow, broadcaster: SseBroadcaster): void {
  broadcaster.broadcast({
    id: row.id,
    service: row.service,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    entityType: row.entity_type,
    entityId: row.entity_id,
    ozet: row.ozet,
    severity: row.severity,
    createdAt: row.created_at,
  });
}
