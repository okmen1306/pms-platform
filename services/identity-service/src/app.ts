import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { createClient } from '@supabase/supabase-js';
import { RabbitMqClient, createAuditPublisher, IDENTITY_EVENTS, type HealthCheckResponse, registerErrorHandler } from '@pms/shared';
import { serviceConfig } from './config/service.config';
import { registerAuthRoutes } from './api/auth.controller';
import { registerRoleRoutes } from './api/role.controller';
import { registerPermissionRoutes } from './api/permission.controller';
import { registerUserOverrideRoutes } from './api/user-override.controller';
import { registerUserRoutes } from './api/user.controller';
import { SupabaseUserRepository } from './infrastructure/database/user.repository';
import { SupabaseRoleRepository } from './infrastructure/database/role.repository';
import { SupabaseRefreshTokenStore } from './infrastructure/database/refresh-token.repository';
import { withActorEmail } from './infrastructure/messaging/audit-actor';
import { SupabasePermissionRepository } from './infrastructure/database/permission.repository';

const startedAt = Date.now();

export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  await app.register(cors, { origin: true });
  await app.register(cookie);

  const db = createClient(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey);
  const rabbit = new RabbitMqClient(serviceConfig.rabbitmqUrl);
  await rabbit.connect();

  const roleRepo = new SupabaseRoleRepository(db);
  const permissionRepo = new SupabasePermissionRepository(db);
  const userRepo = new SupabaseUserRepository(db);
  const publishAudit = withActorEmail(createAuditPublisher(rabbit, 'identity-service'), userRepo);

  registerAuthRoutes(app, {
    userRepo,
    roleRepo,
    refreshStore: new SupabaseRefreshTokenStore(db),
    jwtSecret: serviceConfig.jwtSecret,
    jwtExpiresIn: serviceConfig.jwtAccessExpiresIn,
    refreshTtlDays: serviceConfig.jwtRefreshTtlDays,
    refreshCookiePath: serviceConfig.refreshCookiePath,
    cookieSecure: serviceConfig.cookieSecure,
    publishAudit,
  });

  registerRoleRoutes(app, { roleRepo, permissionRepo, rabbit, publishAudit });
  registerUserRoutes(app, { userRepo, roleRepo, permissionRepo, publishAudit });
  registerPermissionRoutes(app, { permissionRepo });
  registerUserOverrideRoutes(app, {
    permissionRepo,
    publishAudit,
    publishOverridden: (event) => rabbit.publish(IDENTITY_EVENTS.USER_PERMISSION_OVERRIDDEN, event),
  });

  app.get('/health', async (): Promise<HealthCheckResponse> => ({
    status: 'ok',
    service: 'identity-service',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok', rabbitmq: 'ok' },
  }));

  app.addHook('onClose', async () => {
    await rabbit.close();
  });

  return app;
}
