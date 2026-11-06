import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createAuditPublisher, type HealthCheckResponse, type EffectivePermission, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerEmployeeRoutes } from './api/employee.controller';
import { registerTeamRoutes } from './api/team.controller';
import { ProjectServiceClient } from './infrastructure/external/project-service.client';
import { SupabaseEmployeeRepository } from './infrastructure/database/employee.repository';
import { SupabaseTeamRepository } from './infrastructure/database/team.repository';
import { createEmployeeCreatedPublisher } from './infrastructure/messaging/publishers/employee-created.publisher';
import { createEmployeeUpdatedPublisher } from './infrastructure/messaging/publishers/employee-updated.publisher';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();
  const publishAudit = createAuditPublisher(rabbit, 'personnel-service');

  const employeeRepo = new SupabaseEmployeeRepository(db);
  const teamRepo = new SupabaseTeamRepository(db);
  const projectClient = new ProjectServiceClient(serviceConfig.projectServiceUrl);
  const publishEmployeeCreated = createEmployeeCreatedPublisher(rabbit);
  const publishEmployeeUpdated = createEmployeeUpdatedPublisher(rabbit);

  registerEmployeeRoutes(app, {
    employeeRepo,
    publishAudit,
    publishEmployeeCreated,
    publishEmployeeUpdated,
    hasAssignments: (employeeId: string) => projectClient.hasAssignments(employeeId),
    // Day 2 geçici: api-gateway henüz izin enjekte etmiyor -> fail-closed, maaş herkese gizli.
    getCallerPermissions: (): EffectivePermission[] => [],
  });

  registerTeamRoutes(app, { teamRepo, employeeRepo, publishAudit });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'personnel-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
