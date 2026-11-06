import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createAuditPublisher, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerRiskRoutes } from './api/risk.controller';
import { SupabaseRiskRepository } from './infrastructure/database/risk.repository';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();
  const publishAudit = createAuditPublisher(rabbit, 'risk-service');

  registerRiskRoutes(app, { riskRepo: new SupabaseRiskRepository(db), publishAudit });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'risk-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
