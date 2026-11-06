import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerExchangeRateRoutes } from './api/exchange-rate.controller';
import { registerBusinessDaysRoutes } from './api/business-days.controller';
import { registerHolidayRoutes } from './api/holiday.controller';
import { SupabaseExchangeRateRepository } from './infrastructure/database/exchange-rate.repository';
import { SupabaseHolidayRepository } from './infrastructure/database/holiday.repository';
import { TcmbHttpAdapter } from './infrastructure/providers/tcmb.adapter';
import { createExchangeRateUpdatedPublisher } from './infrastructure/messaging/publishers/exchange-rate-updated.publisher';
import { scheduleDailyRateFetch } from './infrastructure/jobs/daily-rate-fetch.cron';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const exchangeRateRepo = new SupabaseExchangeRateRepository(db);
  const holidayRepo = new SupabaseHolidayRepository(db);
  const tcmbAdapter = new TcmbHttpAdapter(serviceConfig.tcmbXmlUrl);
  const publishExchangeRateUpdated = createExchangeRateUpdatedPublisher(rabbit);

  registerExchangeRateRoutes(app, { exchangeRateRepo });
  registerBusinessDaysRoutes(app, { holidayRepo });
  registerHolidayRoutes(app, { holidayRepo });

  scheduleDailyRateFetch(
    { tcmbAdapter, exchangeRateRepo, publishExchangeRateUpdated },
    serviceConfig.rateFetchCron,
    app.log,
  );

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'integration-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
