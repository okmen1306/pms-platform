import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AUDIT_EVENTS, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, waitFor } from './_helpers';

import { registerAuditEventConsumer } from '../../services/logger-service/src/infrastructure/messaging/consumers/audit-event.consumer';
import { SseBroadcaster } from '../../services/logger-service/src/infrastructure/realtime/sse-broadcaster';
import type { AuditEventRepository, AuditEventRow } from '../../services/logger-service/src/infrastructure/database/audit.repository';

/**
 * Day 14: Kuyruk Haritası'nın EN yaygın satırı — `audit.event`, TÜM servislerdeki HER yazma
 * use-case'i tarafından yayınlanır (bkz. shared/messaging/audit-publisher.factory.ts). Bu test
 * TEK bir servisi değil, sözleşmenin KENDİSİNİ (herhangi bir servis "service" alanına kendi adını
 * koyup yayınladığında logger-service'in bunu GERÇEK broker üzerinden yakaladığını) doğruluyor —
 * `SseBroadcaster` burada FAKE değil, gerçek sınıf (dış bağımlılığı yok, bağlı istemci olmadan
 * broadcast etmek güvenli).
 */
describe('audit.event → logger-service (GERÇEK broker)', () => {
  let rabbit: RabbitMqClient;

  const event = {
    service: 'project-service',
    eventType: 'CREATE' as const,
    actorUserId: randomUUID(),
    actorEmail: 'proje.yoneticisi@acme.test',
    entityType: 'project',
    entityId: randomUUID(),
    ozet: 'Day 14 doğrulama projesi oluşturuldu',
    severity: 'info' as const,
  };

  beforeAll(async () => {
    await purgeQueue(queueName('logger-service', 'audit-event'));
    rabbit = await createConnectedClient();
  });

  afterAll(async () => {
    await rabbit.close();
  });

  it('herhangi bir servisten gelen audit.event GERÇEK broker üzerinden logger-service\'e ulaşır ve kaydedilir', async () => {
    const insertedRows: unknown[] = [];
    const auditRepo: AuditEventRepository = {
      insert: async (row) => {
        insertedRows.push(row);
        return { id: randomUUID(), created_at: new Date().toISOString(), ...row } as AuditEventRow;
      },
    } as unknown as AuditEventRepository;
    const broadcaster = new SseBroadcaster(); // gerçek sınıf — bağlı istemci yok, no-op broadcast
    const logger = { info: () => {}, warn: () => {}, error: () => {} } as any;

    await registerAuditEventConsumer(rabbit, { auditRepo, broadcaster, logger });
    await rabbit.publish(AUDIT_EVENTS.GENERIC, event);

    await waitFor(() => insertedRows.length > 0);
    expect(insertedRows[0]).toMatchObject({ service: event.service, event_type: event.eventType, entity_id: event.entityId, ozet: event.ozet });
  });
});
