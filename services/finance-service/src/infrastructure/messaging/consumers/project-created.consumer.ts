import { RabbitMqClient, PROJECT_EVENTS, ProjectCreatedEventSchema, queueName } from '@pms/shared';
import type { CostRepository } from '../../database/cost.repository';
import type { AssignmentCacheRepository } from '../../database/assignment-cache.repository';

/**
 * "Proje maliyeti iskeleti": bir proje oluşturulduğunda finance-service kendi maliyet
 * kaydını sıfırlarla açar. Böylece Day 7-9'daki hesaplama use-case'leri her zaman UPDATE
 * yapar, hiçbir zaman "kayıt yok" durumuyla uğraşmaz.
 *
 * Day 7 eklentisi: `sureHafta` alanı event'e eklendiğinden (bkz. shared/events/project.events.ts),
 * finance-service artık projenin başlangıç tarihi + hafta sayısını da önbelleğe alır — AR-GE
 * maliyeti hesabı (calculate-arge-cost.usecase.ts), integration-service'in `/week-ranges`
 * uç noktasını çağırırken bu ikisine ihtiyaç duyar (Kırılmaz Kural: hafta hesaplaması SADECE
 * integration-service'te yapılır).
 *
 * Day 9 eklentisi (B2 — idari maliyet + kâr marjı): tahmini maliyet/satış fiyatı/danışmanlık/
 * paketleme/idari maliyet oranı da artık event üzerinden kopyalanıyor (bkz.
 * cost.repository.ts InitializeProjectCostInput).
 */
export async function registerProjectCreatedConsumer(
  rabbit: RabbitMqClient,
  deps: { costRepo: CostRepository; assignmentCacheRepo: AssignmentCacheRepository },
) {
  await rabbit.subscribe(
    queueName('finance-service', 'project-created'),
    [PROJECT_EVENTS.CREATED],
    async (_routingKey, payload) => {
      const event = ProjectCreatedEventSchema.parse(payload);
      await deps.costRepo.initializeForProject(event.projectId, {
        toplamTahminiMaliyetTl: event.tahminiMaliyetTl,
        satisFiyatiTl: event.satisFiyatiTl,
        danismanlikMaliyetiTl: event.danismanlikMaliyetiTl,
        paketlemeMaliyetiTl: event.paketlemeGonderimMaliyetiTl,
        idariMaliyetOrani: event.idariMaliyetOrani,
      });
      if (event.sureHafta) {
        await deps.assignmentCacheRepo.upsertProjectMeta({
          project_id: event.projectId,
          baslangic_tarihi: event.startDate,
          sure_hafta: event.sureHafta,
        });
      }
    },
  );
}
