import { RabbitMqClient, ASSIGNMENT_EVENTS, AssignmentCreatedEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { CostRepository } from '../../database/cost.repository';
import type { AssignmentCacheRepository } from '../../database/assignment-cache.repository';
import type { IntegrationServiceClient } from '../../external/integration-service.client';
import type { PersonnelServiceClient } from '../../external/personnel-service.client';
import { calculateArgeCostForAssignment } from '../../../core/use-cases/calculate-arge-cost.usecase';

/**
 * Day 7: `assignment.created` her yayınlandığında (project-service, personel atama başarılı
 * olduğunda), finance-service kendi yerel önbelleğini günceller ve AR-GE haftalık maliyetini
 * hesaplar (bkz. calculate-arge-cost.usecase.ts). Kırılmaz Kural gereği bu, project-service'in
 * tablosuna DOKUNMADAN, tamamen event + REST (integration-service, personnel-service) ile yapılır.
 */
export async function registerAssignmentCreatedConsumer(
  rabbit: RabbitMqClient,
  deps: {
    costRepo: CostRepository;
    assignmentCacheRepo: AssignmentCacheRepository;
    integrationClient: IntegrationServiceClient;
    personnelClient: PersonnelServiceClient;
    logger: FastifyBaseLogger;
  },
) {
  await rabbit.subscribe(
    queueName('finance-service', 'assignment-created'),
    [ASSIGNMENT_EVENTS.CREATED],
    async (_routingKey, payload) => {
      const event = AssignmentCreatedEventSchema.parse(payload);
      await calculateArgeCostForAssignment(
        event,
        deps.assignmentCacheRepo,
        deps.costRepo,
        deps.integrationClient,
        deps.personnelClient,
        deps.logger,
      );
    },
  );
}
