import { RabbitMqClient, PROJECT_EVENTS, WorkPackageCompletedEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { CostRepository } from '../../database/cost.repository';

/**
 * B2 (Day 10): "finance tamamlama". docs/roadmap.md Bölüm 5 dosya mimarisinde finance-service'in
 * `work-package-completed.consumer.ts`'i ZATEN planlıydı (Kuyruk Haritası: `work_package.completed`
 * → "notification-service, finance-service, reporting-service, performance-service") ama Day 8'de
 * SADECE notification-service'in tarafı yazılmıştı — finance-service'inki bugüne kadar eksikti.
 *
 * Amaç: bir iş paketi tamamlandığında maliyet rollup'ını YENİDEN tetiklemek. Bu, AYRICA
 * `calculate-arge-cost.usecase.ts`'teki self-documented "recompute" TODO'sunun (proje meta
 * önbelleği henüz yoksa AR-GE hesabının sessizce atlanması) kısmi bir telafisi — bir iş paketi
 * tamamlandığında proje meta'sı artık KESİNLİKLE var olacağından, bu tetikleme atlanan hesabı
 * YAKALAMAZ (o gerçek bir "recompute" değil) ama en azından malzeme/idari/kâr marjı gibi diğer
 * bileşenlerin GÜNCEL kalmasını sağlar. Tam bir manuel "recompute" endpoint'i hâlâ ileri bir
 * güne bırakıldı.
 */
export async function registerWorkPackageCompletedConsumer(
  rabbit: RabbitMqClient,
  deps: { costRepo: CostRepository; logger: FastifyBaseLogger },
) {
  await rabbit.subscribe(queueName('finance-service', 'work-package-completed'), [PROJECT_EVENTS.WORK_PACKAGE_COMPLETED], async (_routingKey, payload) => {
    const event = WorkPackageCompletedEventSchema.parse(payload);
    await deps.costRepo.recalculateCostRollup(event.projectId);
    deps.logger.info({ projectId: event.projectId, workPackageId: event.workPackageId }, 'İş paketi tamamlandı — maliyet rollup\'ı yeniden hesaplandı.');
  });
}
