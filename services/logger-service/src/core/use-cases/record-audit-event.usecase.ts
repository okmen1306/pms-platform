import type { AuditEvent } from '@pms/shared';
import type { AuditEventRepository, AuditEventRow } from '../../infrastructure/database/audit.repository';

/**
 * TL (Day 9): roadmap'in kendi dosya ağacında bu isimle zaten planlanmıştı
 * ("record-audit-event.usecase.ts # audit.event -> logger_audit_events"). Basit bir eşleme +
 * kayıt: `audit.event`'in kendisi zaten TÜM servislerdeki use-case'lerin (Day 5'ten beri, bkz.
 * shared/messaging/audit-publisher.factory.ts) yayınladığı NİHAİ, doğrulanmış olaydır — burada
 * ek bir iş kuralı YOK, sadece camelCase (event) -> snake_case (DB satırı) dönüşümü.
 */
export async function recordAuditEvent(event: AuditEvent, auditRepo: AuditEventRepository): Promise<AuditEventRow> {
  return auditRepo.insert({
    service: event.service,
    event_type: event.eventType,
    actor_user_id: event.actorUserId,
    actor_email: event.actorEmail,
    entity_type: event.entityType,
    entity_id: event.entityId,
    ozet: event.ozet,
    onceki_deger: event.oncekiDeger ?? null,
    yeni_deger: event.yeniDeger ?? null,
    severity: event.severity,
    ip_adresi: event.ipAdresi ?? null,
  });
}
