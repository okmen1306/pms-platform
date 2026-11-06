import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerNotificationRoutes } from './api/notification.controller';
import { SupabaseEmailTemplateRepository } from './infrastructure/database/email-template.repository';
import { NodemailerAdapter } from './infrastructure/providers/smtp.adapter';
import { PersonnelServiceClient } from './infrastructure/external/personnel-service.client';
import { ProjectServiceClient } from './infrastructure/external/project-service.client';
import { SupabaseScheduledJobRepository } from './infrastructure/database/scheduled-job.repository';
import { registerProjectCreatedConsumer } from './infrastructure/messaging/consumers/project-created.consumer';
import { registerAssignmentCreatedConsumer } from './infrastructure/messaging/consumers/assignment-created.consumer';
import { registerWorkPackageCompletedConsumer } from './infrastructure/messaging/consumers/work-package-completed.consumer';
import { registerProjectCompletedConsumer } from './infrastructure/messaging/consumers/project-completed.consumer';
import { scheduleDelayCheck } from './infrastructure/jobs/delay-check.cron';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const templateRepo = new SupabaseEmailTemplateRepository(db);
  const emailAdapter = new NodemailerAdapter(
    serviceConfig.smtpHost,
    serviceConfig.smtpPort,
    serviceConfig.smtpUser,
    serviceConfig.smtpPass,
  );
  const personnelClient = new PersonnelServiceClient(serviceConfig.personnelServiceUrl);
  const projectClient = new ProjectServiceClient(serviceConfig.projectServiceUrl);
  const scheduledJobRepo = new SupabaseScheduledJobRepository(db);

  registerNotificationRoutes(app, { templateRepo, emailAdapter });
  await registerProjectCreatedConsumer(rabbit, { templateRepo, emailAdapter, personnelClient });
  await registerAssignmentCreatedConsumer(rabbit, { templateRepo, emailAdapter, personnelClient, scheduledJobRepo });
  await registerWorkPackageCompletedConsumer(rabbit, { templateRepo, emailAdapter, personnelClient, projectClient });
  await registerProjectCompletedConsumer(rabbit, {
    templateRepo,
    emailAdapter,
    personnelClient,
    projectClient,
    companyManagementEmail: serviceConfig.companyManagementEmail,
  });

  scheduleDelayCheck(
    { scheduledJobRepo, templateRepo, emailAdapter, personnelClient, projectClient, companyManagementEmail: serviceConfig.companyManagementEmail },
    serviceConfig.delayCheckCron,
    app.log,
  );

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'notification-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
