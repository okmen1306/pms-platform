import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createAuditPublisher, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerMaterialRoutes } from './api/material.controller';
import { SupabaseMaterialRepository } from './infrastructure/database/material.repository';
import { SupabaseStockMovementRepository } from './infrastructure/database/stock-movement.repository';
import { IntegrationServiceClient } from './infrastructure/external/integration-service.client';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();
  const publishAudit = createAuditPublisher(rabbit, 'procurement-service');

  registerMaterialRoutes(app, {
    materialRepo: new SupabaseMaterialRepository(db),
    stockMovementRepo: new SupabaseStockMovementRepository(db),
    integrationClient: new IntegrationServiceClient(serviceConfig.integrationServiceUrl),
    rabbit,
    publishAudit,
  });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'procurement-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
