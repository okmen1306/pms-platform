import { RabbitMqClient, AUDIT_EVENTS, AuditEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { AuditEventRepository } from '../../database/audit.repository';
import type { SseBroadcaster } from '../../realtime/sse-broadcaster';
import { recordAuditEvent } from '../../../core/use-cases/record-audit-event.usecase';
import { broadcastActivity } from '../../../core/use-cases/broadcast-activity.usecase';

/**
 * TL (Day 9): "logger-service: audit tablo + `audit.event` consumer" (docs/roadmap.md Bölüm
 * 14.2 satır 9). "Admin uçan kuştan bile haberdar olmalı" prensibinin (Bölüm 17.4) TEK giriş
 * noktası — Day 5'ten beri TÜM servislerdeki her yazma use-case'i `createAuditPublisher` ile
 * `audit.event` yayınlıyordu (bkz. shared/messaging/audit-publisher.factory.ts) ama BUGÜNE KADAR
 * bu event'i dinleyen HİÇBİR ŞEY yoktu — yani Day 5-8 arası yayınlanan tüm audit event'leri
 * (RabbitMQ kuyruğa bağlı bir consumer olmadığı için) sessizce KAYBOLUYORDU. Bugünden itibaren
 * kalıcı olarak `logger_audit_events`'e yazılıyor.
 *
 * Day 10 eklentisi: kalıcı kayıttan HEMEN SONRA `broadcastActivity` ile SSE bağlı admin
 * istemcilerine de anlık itiliyor (bkz. broadcast-activity.usecase.ts notu — sıralama önemli,
 * kalıcı kayıt SSE'den ÖNCE garantilenir).
 *
 * Diğer tüm consumer'lardan FARKLI olarak burada `service` ADI YOK (`queueName('logger-service',
 * 'audit-event')`) — çünkü bu kuyruk kendi başına TEK bir servise değil, TÜM servislere ait
 * (routing key `audit.event`, exchange'e HER servis kendi audit publisher'ıyla bağlanıyor).
 */
export async function registerAuditEventConsumer(
  rabbit: RabbitMqClient,
  deps: { auditRepo: AuditEventRepository; broadcaster: SseBroadcaster; logger: FastifyBaseLogger },
) {
  await rabbit.subscribe(queueName('logger-service', 'audit-event'), [AUDIT_EVENTS.GENERIC], async (_routingKey, payload) => {
    const event = AuditEventSchema.parse(payload);
    const saved = await recordAuditEvent(event, deps.auditRepo);
    broadcastActivity(saved, deps.broadcaster);
    deps.logger.info({ service: event.service, entityType: event.entityType, severity: event.severity }, 'audit.event kaydedildi');
  });
}
