import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createAuditPublisher, createNamespacedRedisClient, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerProjectRoutes } from './api/project.controller';
import { registerProductCatalogRoutes } from './api/product-catalog.controller';
import { registerWorkPackageRoutes } from './api/work-package.controller';
import { registerWeeklyAllocationRoutes } from './api/weekly-allocation.controller';
import { registerAssignmentRoutes } from './api/assignment.controller';
import { registerMilestoneRoutes } from './api/milestone.controller';
import { registerWorkDraftRoutes } from './api/work-draft.controller';
import { SupabaseProjectRepository } from './infrastructure/database/project.repository';
import { SupabaseProductCatalogRepository } from './infrastructure/database/product-catalog.repository';
import { SupabaseWorkPackageRepository } from './infrastructure/database/work-package.repository';
import { SupabaseWeeklyAllocationRepository } from './infrastructure/database/weekly-allocation.repository';
import { SupabaseAssignmentRepository } from './infrastructure/database/assignment.repository';
import { SupabaseMilestoneRepository } from './infrastructure/database/milestone.repository';
import { SupabaseWorkDraftRepository } from './infrastructure/database/work-draft.repository';
import { IntegrationServiceClient } from './infrastructure/external/integration-service.client';
import { PersonnelServiceClient } from './infrastructure/external/personnel-service.client';
import { RedisEmployeeCacheRepository } from './infrastructure/cache/employee-cache.repository';
import { registerEmployeeChangedConsumer } from './infrastructure/messaging/consumers/employee-changed.consumer';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();
  const publishAudit = createAuditPublisher(rabbit, 'project-service');

  const projectRepo = new SupabaseProjectRepository(db);
  const catalogRepo = new SupabaseProductCatalogRepository(db);
  const workPackageRepo = new SupabaseWorkPackageRepository(db);
  const allocationRepo = new SupabaseWeeklyAllocationRepository(db);
  const assignmentRepo = new SupabaseAssignmentRepository(db);
  const milestoneRepo = new SupabaseMilestoneRepository(db);
  const workDraftRepo = new SupabaseWorkDraftRepository(db);
  const integrationClient = new IntegrationServiceClient(serviceConfig.integrationServiceUrl);
  const personnelClient = new PersonnelServiceClient(serviceConfig.personnelServiceUrl);

  // Day 15: docs/roadmap.md Bölüm 2.1'in "personel adı gösterimi" örneği — `project:employee-cache:*`
  // namespace'i (satır 196), önceki günlerde config'i hazır bekleyen `redisUrl`'i ilk kez kullanıyor.
  const employeeCacheRedis = createNamespacedRedisClient('project', serviceConfig.redisUrl);
  const employeeCacheRepo = new RedisEmployeeCacheRepository(employeeCacheRedis);
  await registerEmployeeChangedConsumer(rabbit, { employeeCacheRepo, logger: app.log });

  registerProjectRoutes(app, { projectRepo, allocationRepo, catalogRepo, integrationClient, rabbit, publishAudit });
  registerProductCatalogRoutes(app, { catalogRepo });
  registerWorkPackageRoutes(app, { workPackageRepo, projectRepo, rabbit, publishAudit });
  registerWeeklyAllocationRoutes(app, { allocationRepo, projectRepo, publishAudit });
  registerAssignmentRoutes(app, { assignmentRepo, workPackageRepo, projectRepo, personnelClient, rabbit, publishAudit });
  registerMilestoneRoutes(app, { milestoneRepo, projectRepo, publishAudit });
  registerWorkDraftRoutes(app, { workDraftRepo, projectRepo, publishAudit });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'project-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok', redis: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
    employeeCacheRedis.raw.disconnect();
  });

  return app;
}
