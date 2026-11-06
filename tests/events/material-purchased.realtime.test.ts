import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PROCUREMENT_EVENTS, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, waitFor } from './_helpers';

import { registerMaterialPurchasedConsumer } from '../../services/finance-service/src/infrastructure/messaging/consumers/material-purchased.consumer';
import type { CostRepository } from '../../services/finance-service/src/infrastructure/database/cost.repository';

/**
 * Day 14: Kuyruk Haritası'nın `material.purchased` satırı iki consumer listeler (finance-
 * service, reporting-service) ama reporting-service'in Day 13'te BİLİNÇLİ olarak bunu
 * tüketmediği zaten belgelenmişti (malzeme maliyeti raporu finance-service'e ince bir proxy —
 * bkz. reporting-service app.ts). Bu yüzden burada SADECE finance-service tarafı, GERÇEK bir
 * broker'a karşı doğrulanıyor.
 */
describe('material.purchased → finance-service (GERÇEK broker)', () => {
  let rabbit: RabbitMqClient;

  const event = {
    materialId: randomUUID(),
    projectId: randomUUID(),
    totalTl: 42500.5,
    totalUsd: 1250.75,
    purchaseDate: '2026-05-10',
  };

  beforeAll(async () => {
    await purgeQueue(queueName('finance-service', 'material-purchased'));
    rabbit = await createConnectedClient();
  });

  afterAll(async () => {
    await rabbit.close();
  });

  it('finance-service: gerçek broker üzerinden teslim alınır, malzeme maliyeti kaydedilir', async () => {
    const recordedCosts: { projectId: string; totalTl: number; totalUsd: number }[] = [];
    const costRepo = {
      addMaterialCost: async (projectId: string, totalTl: number, totalUsd: number) => {
        recordedCosts.push({ projectId, totalTl, totalUsd });
        return {} as never;
      },
    } as unknown as CostRepository;
    const logger = { info: () => {}, warn: () => {}, error: () => {} } as any;

    await registerMaterialPurchasedConsumer(rabbit, { costRepo, logger });
    await rabbit.publish(PROCUREMENT_EVENTS.MATERIAL_PURCHASED, event);

    await waitFor(() => recordedCosts.length > 0);
    expect(recordedCosts[0]).toMatchObject({ projectId: event.projectId, totalTl: event.totalTl, totalUsd: event.totalUsd });
  });
});
