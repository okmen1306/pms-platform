import { RabbitMqClient, PERSONNEL_EVENTS, EmployeeChangedEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { EmployeeCacheRepository } from '../../cache/employee-cache.repository';

/**
 * Day 15: docs/roadmap.md Bölüm 5 dosya ağacında (satır 994) Day 1'den beri planlıydı:
 * "employee-changed.consumer.ts # employee.created/updated -> cache yaz". `employee.created` VE
 * `employee.updated` AYNI kuyruğa bağlanır (routing key farklı ama işlem AYNI: upsert) — çünkü
 * cache'in bakış açısından ikisi de "bu personelin GÜNCEL adı/durumu bu" demek (roadmap.md
 * satır 137).
 */
export async function registerEmployeeChangedConsumer(
  rabbit: RabbitMqClient,
  deps: { employeeCacheRepo: EmployeeCacheRepository; logger: FastifyBaseLogger },
) {
  await rabbit.subscribe(
    queueName('project-service', 'employee-changed'),
    [PERSONNEL_EVENTS.EMPLOYEE_CREATED, PERSONNEL_EVENTS.EMPLOYEE_UPDATED],
    async (routingKey, payload) => {
      const event = EmployeeChangedEventSchema.parse(payload);
      await deps.employeeCacheRepo.upsert(event.employeeId, { adSoyad: event.adSoyad, durum: event.durum });
      deps.logger.info({ routingKey, employeeId: event.employeeId, durum: event.durum }, 'Personel cache güncellendi (project:employee-cache).');
    },
  );
}
