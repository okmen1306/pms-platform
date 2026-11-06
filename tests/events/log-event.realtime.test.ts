import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { LOG_EVENTS, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, waitFor } from './_helpers';

import { registerLogEventConsumer } from '../../services/logger-service/src/infrastructure/messaging/consumers/log-event.consumer';
import type { ErrorEventRepository, ErrorEventRow } from '../../services/logger-service/src/infrastructure/database/error-log.repository';
import type { AlertAdapter } from '../../services/logger-service/src/infrastructure/providers/telegram.adapter';

/**
 * Day 14 ("tüketici hazırlığı doğrulaması" — bkz. docs/testing/event-integration-audit.md,
 * `log.event` satırı): bu event'in HİÇBİR üreticisi yok (log.events.ts'in kendi yorumu bunu
 * açıkça belgeliyor) — bu yüzden burada "gerçek bir üreticiyi tetikleyip doğrulama" MÜMKÜN
 * DEĞİL. Bunun yerine, gelecekteki bir üretici adına GEÇERLİ bir `log.event` biz yayınlıyoruz
 * ve logger-service'in GERÇEK consumer'ının bunu broker üzerinden doğru işlediğini kanıtlıyoruz
 * — "tüketici hazır" iddiasının kod okumasıyla değil, ÇALIŞTIRARAK doğrulanmış hali.
 *
 * NOT: consumer SADECE BİR KEZ (beforeAll) kaydediliyor — aynı kuyruğa iki kez `subscribe`
 * çağırmak RabbitMQ'da İKİ ayrı consumer açar ve mesajlar aralarında round-robin dağıtılır
 * (bir testin mesajı diğerinin fake'ine gidebilir); bunun yerine fake'lerin ARKASINDAKİ
 * dizi `beforeEach`'te temizleniyor.
 */
describe('log.event → logger-service (GERÇEK broker, tüketici-hazırlığı doğrulaması — üretici YOK)', () => {
  let rabbit: RabbitMqClient;
  let insertedRows: unknown[] = [];
  let alerts: string[] = [];

  beforeAll(async () => {
    await purgeQueue(queueName('logger-service', 'log-event'));
    rabbit = await createConnectedClient();

    const errorRepo: ErrorEventRepository = {
      insert: async (row) => {
        insertedRows.push(row);
        return { id: 'e-1', created_at: new Date().toISOString(), ...row } as ErrorEventRow;
      },
    } as unknown as ErrorEventRepository;
    const alertAdapter: AlertAdapter = { send: async (message) => void alerts.push(message) };
    await registerLogEventConsumer(rabbit, { errorRepo, alertAdapter });
  });

  beforeEach(() => {
    insertedRows = [];
    alerts = [];
  });

  afterAll(async () => {
    await rabbit.close();
  });

  it('"error" seviyesinde bir log.event GERÇEK broker üzerinden teslim alınır, KAYDEDİLİR VE Telegram\'a uyarı gönderilir', async () => {
    await rabbit.publish(LOG_EVENTS.GENERIC, {
      level: 'error',
      service: 'project-service',
      message: 'Day 14 doğrulaması — sentetik hata kaydı',
    });

    await waitFor(() => insertedRows.length > 0 && alerts.length > 0);
    expect(insertedRows[0]).toMatchObject({ service: 'project-service', level: 'error' });
    expect(alerts[0]).toContain('project-service');
  });

  it('"info" seviyesinde bir log.event KAYDEDİLİR ama Telegram\'a GÖNDERİLMEZ (gürültü önleme, Day 10 kararı)', async () => {
    await rabbit.publish(LOG_EVENTS.GENERIC, { level: 'info', service: 'project-service', message: 'Day 14 doğrulaması — bilgi kaydı' });

    await waitFor(() => insertedRows.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 150)); // alert GÖNDERİLMEDİĞİNİ doğrulamak için kısa bir bekleme
    expect(alerts).toHaveLength(0);
  });
});
