import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createNamespacedRedisClient, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerCostAnalysisRoutes } from './api/cost-analysis.controller';
import { SupabaseCostRepository } from './infrastructure/database/cost.repository';
import { SupabaseAssignmentCacheRepository } from './infrastructure/database/assignment-cache.repository';
import { IntegrationServiceClient } from './infrastructure/external/integration-service.client';
import { PersonnelServiceClient } from './infrastructure/external/personnel-service.client';
import { registerProjectCreatedConsumer } from './infrastructure/messaging/consumers/project-created.consumer';
import { registerAssignmentCreatedConsumer } from './infrastructure/messaging/consumers/assignment-created.consumer';
import { registerMaterialPurchasedConsumer } from './infrastructure/messaging/consumers/material-purchased.consumer';
import { registerWorkPackageCompletedConsumer } from './infrastructure/messaging/consumers/work-package-completed.consumer';
import { registerEmployeeChangedConsumer } from './infrastructure/messaging/consumers/employee-changed.consumer';
import { RedisEmployeeCacheRepository } from './infrastructure/cache/employee-cache.repository';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const costRepo = new SupabaseCostRepository(db);
  const assignmentCacheRepo = new SupabaseAssignmentCacheRepository(db);
  const integrationClient = new IntegrationServiceClient(serviceConfig.integrationServiceUrl);
  const personnelClient = new PersonnelServiceClient(serviceConfig.personnelServiceUrl);

  // Day 15: Kuyruk Haritası satır 1394'ün ikinci tüketicisi — bkz. employee-cache.repository.ts başlık notu.
  const employeeCacheRedis = createNamespacedRedisClient('finance', serviceConfig.redisUrl);
  const employeeCacheRepo = new RedisEmployeeCacheRepository(employeeCacheRedis);
  await registerEmployeeChangedConsumer(rabbit, { employeeCacheRepo, logger: app.log });

  registerCostAnalysisRoutes(app, { costRepo });
  await registerProjectCreatedConsumer(rabbit, { costRepo, assignmentCacheRepo });
  await registerAssignmentCreatedConsumer(rabbit, {
    costRepo,
    assignmentCacheRepo,
    integrationClient,
    personnelClient,
    logger: app.log,
  });
  await registerMaterialPurchasedConsumer(rabbit, { costRepo, logger: app.log });
  await registerWorkPackageCompletedConsumer(rabbit, { costRepo, logger: app.log });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'finance-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok', redis: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
    employeeCacheRedis.raw.disconnect();
  });

  return app;
}
