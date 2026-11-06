import { RabbitMqClient, PERSONNEL_EVENTS, EmployeeChangedEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { EmployeeCacheRepository } from '../../cache/employee-cache.repository';

/**
 * Day 15: `project-service`'teki `employee-changed.consumer.ts` ile AYNI mantık — bu dosya
 * roadmap.md'nin dosya ağacında (Bölüm 5) AÇIKÇA listelenmemiş (o listede finance-service'in
 * `/messaging/consumers`'ı sadece project-created/material-purchased/work-package-completed/
 * exchange-rate-updated'i sayıyor), AMA Kuyruk Haritası TABLOSU (satır 1394) ve Go-Live Kontrol
 * Listesi (satır 2090, "project-service VE finance-service Redis cache'leri") finance-service'i
 * AÇIKÇA bir tüketici olarak sayıyor. Day 14'ün "dosya ağacı ile Kuyruk Haritası bazen çelişiyor"
 * bulgularıyla AYNI türden bir tutarsızlık — burada daha SPESİFİK VE İKİ AYRI YERDE tekrarlanan
 * kaynak (Kuyruk Haritası + Go-Live listesi) esas alındı.
 */
export async function registerEmployeeChangedConsumer(
  rabbit: RabbitMqClient,
  deps: { employeeCacheRepo: EmployeeCacheRepository; logger: FastifyBaseLogger },
) {
  await rabbit.subscribe(
    queueName('finance-service', 'employee-changed'),
    [PERSONNEL_EVENTS.EMPLOYEE_CREATED, PERSONNEL_EVENTS.EMPLOYEE_UPDATED],
    async (routingKey, payload) => {
      const event = EmployeeChangedEventSchema.parse(payload);
      await deps.employeeCacheRepo.upsert(event.employeeId, { adSoyad: event.adSoyad, durum: event.durum });
      deps.logger.info({ routingKey, employeeId: event.employeeId, durum: event.durum }, 'Personel cache güncellendi (finance:employee-cache).');
    },
  );
}
