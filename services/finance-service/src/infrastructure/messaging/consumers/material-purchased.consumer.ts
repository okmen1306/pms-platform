import { RabbitMqClient, PROCUREMENT_EVENTS, MaterialPurchasedEventSchema, queueName } from '@pms/shared';
import type { FastifyBaseLogger } from 'fastify';
import type { CostRepository } from '../../database/cost.repository';
import { recordMaterialCost } from '../../../core/use-cases/record-material-cost.usecase';

/**
 * B2 (Day 8): `project-created.consumer.ts` / `assignment-created.consumer.ts` (Day 6-7) ile
 * BİREBİR aynı kayıt deseni — kendi kuyruğu (`finance-service.material-purchased`),
 * `material.purchased` routing key'ine bağlanır, event'i şema ile doğrular, use-case'e devreder.
 */
export async function registerMaterialPurchasedConsumer(
  rabbit: RabbitMqClient,
  deps: { costRepo: CostRepository; logger: FastifyBaseLogger },
) {
  await rabbit.subscribe(
    queueName('finance-service', 'material-purchased'),
    [PROCUREMENT_EVENTS.MATERIAL_PURCHASED],
    async (_routingKey, payload) => {
      const event = MaterialPurchasedEventSchema.parse(payload);
      await recordMaterialCost(event, deps.costRepo, deps.logger);
    },
  );
}
