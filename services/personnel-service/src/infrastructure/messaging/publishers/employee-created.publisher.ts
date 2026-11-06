import { RabbitMqClient, PERSONNEL_EVENTS, EmployeeCreatedEventSchema, type EmployeeCreatedEvent } from '@pms/shared';

/**
 * Day 15: `integration-service`'in `exchange-rate-updated.publisher.ts`'i (Day 1) ile AYNI
 * fabrika deseni — use-case, RabbitMQ'ya değil bu fonksiyonun imzasına bağımlı (test edilebilir).
 * Bu dosyanın klasörü (`/messaging/publishers`) Day 1'den beri `.gitkeep` ile bekliyordu (bkz.
 * docs/roadmap.md Bölüm 5 dosya ağacı) — Day 14 denetimi bunun HİÇBİR ZAMAN doldurulmadığını
 * ortaya çıkardı.
 */
export function createEmployeeCreatedPublisher(rabbit: RabbitMqClient) {
  return async (event: EmployeeCreatedEvent): Promise<void> => {
    const parsed = EmployeeCreatedEventSchema.parse(event);
    await rabbit.publish(PERSONNEL_EVENTS.EMPLOYEE_CREATED, parsed);
  };
}
