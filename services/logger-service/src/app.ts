import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import type { HealthCheckResponse } from '@pms/shared';
import { registerErrorHandler, RabbitMqClient } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { SupabaseAuditEventRepository } from './infrastructure/database/audit.repository';
import { SupabaseErrorEventRepository } from './infrastructure/database/error-log.repository';
import { TelegramAlertAdapter } from './infrastructure/providers/telegram.adapter';
import { SseBroadcaster } from './infrastructure/realtime/sse-broadcaster';
import { registerAuditEventConsumer } from './infrastructure/messaging/consumers/audit-event.consumer';
import { registerLogEventConsumer } from './infrastructure/messaging/consumers/log-event.consumer';
import { registerActivityStreamRoutes } from './api/activity-stream.controller';
import { registerAuditLogRoutes } from './api/audit-log.controller';
import { registerSystemPulseRoutes } from './api/system-pulse.controller';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const auditRepo = new SupabaseAuditEventRepository(db);
  const errorRepo = new SupabaseErrorEventRepository(db);
  const alertAdapter = new TelegramAlertAdapter(serviceConfig.telegramBotToken, serviceConfig.telegramChatId, app.log);
  const broadcaster = new SseBroadcaster();

  await registerAuditEventConsumer(rabbit, { auditRepo, broadcaster, logger: app.log });
  await registerLogEventConsumer(rabbit, { errorRepo, alertAdapter });

  registerActivityStreamRoutes(app, { broadcaster });
  registerAuditLogRoutes(app, { auditRepo });
  registerSystemPulseRoutes(app, { auditRepo });

  app.get('/health', async (): Promise<HealthCheckResponse> => {
    return {
      status: 'ok',
      service: 'logger-service',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      dependencies: {
        database: 'ok',
        rabbitmq: 'ok',
      },
    };
  });

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
