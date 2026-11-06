import { RabbitMqClient, LOG_EVENTS, LogEventSchema, queueName } from '@pms/shared';
import type { ErrorEventRepository } from '../../database/error-log.repository';
import type { AlertAdapter } from '../../providers/telegram.adapter';
import { routeLogEvent } from '../../../core/use-cases/route-log-event.usecase';

/**
 * TL (Day 10): `audit-event.consumer.ts` (Day 9) İLE AYNI kayıt deseni, ama routing key
 * `log.event` — teknik hata/log, kullanıcı eylemi denetim kaydı DEĞİL (bkz. log.events.ts
 * dosyasındaki not). Bugün itibarıyla HİÇBİR servis bu event'i YAYINLAMIYOR (tüketici,
 * üreticiden önce hazır — projedeki yerleşik desen).
 */
export async function registerLogEventConsumer(
  rabbit: RabbitMqClient,
  deps: { errorRepo: ErrorEventRepository; alertAdapter: AlertAdapter },
) {
  await rabbit.subscribe(queueName('logger-service', 'log-event'), [LOG_EVENTS.GENERIC], async (_routingKey, payload) => {
    const event = LogEventSchema.parse(payload);
    await routeLogEvent(event, deps.errorRepo, deps.alertAdapter);
  });
}
