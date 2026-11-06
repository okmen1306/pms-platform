import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createAuthMiddleware } from './middleware/auth.middleware';
import { createRequirePermission, createRequirePermissionByMethod } from './middleware/rbac.middleware';
import { registerRateLimit } from './middleware/rate-limit.middleware';
import { IdentityServiceClient } from './clients/identity-service.client';
import { serviceConfig } from './config/service.config';
import { registerErrorHandler } from '@pms/shared';
import { registerIdentityRoutes } from './routes/identity.routes';
import { registerPersonnelRoutes } from './routes/personnel.routes';
import { registerProjectRoutes } from './routes/project.routes';
import { registerProcurementRoutes } from './routes/procurement.routes';
import { registerIntegrationRoutes } from './routes/integration.routes';
import { registerFinanceRoutes } from './routes/finance.routes';
import { registerPerformanceRoutes } from './routes/performance.routes';
import { registerRiskRoutes } from './routes/risk.routes';
import { registerNotificationRoutes } from './routes/notification.routes';
import { registerReportingRoutes } from './routes/reporting.routes';
import { registerLoggerRoutes } from './routes/logger.routes';

const startedAt = Date.now();

/**
 * Day 7 (TL): "proxy routing + rate limit". Day 6'nın iki demo route'u (`/whoami`, `/admin/ping`)
 * artık kaldırıldı — auth + RBAC middleware'lerin GERÇEK kanıtı, şimdi 10 servise giden gerçek
 * proxy route'ları. `/identity/auth/*` dışındaki HER ŞEY en az `authenticate` ister; finance ve
 * identity'nin yönetimsel uç noktaları ayrıca `requirePermission` ister (bkz. ilgili routes dosyası).
 */
export async function buildApp() {
  const app = Fastify({ logger: true });
  registerErrorHandler(app);
  // Day 19 (entegrasyon bulgusu, bkz. CHANGELOG.md): `@fastify/cors`'un varsayılan `methods` değeri
  // SADECE 'GET,HEAD,POST' — PATCH (atama tamamlama: PATCH /project/assignments/:id/complete) ve
  // DELETE (alt iş paketi silme) tarayıcı ön-uçuşunda (preflight) REDDEDİLİRDİ. Mock'larla ve
  // curl ile hiç fark edilmedi çünkü ikisi de CORS'a takılmaz — sadece gerçek bir tarayıcı takılır.
  await app.register(cors, {
    origin: serviceConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await registerRateLimit(app, {
    redisUrl: serviceConfig.redisUrl,
    max: serviceConfig.rateLimitMax,
    timeWindowMs: serviceConfig.rateLimitWindowMs,
  });

  const authenticate = createAuthMiddleware(serviceConfig.jwtSecret);
  const identityClient = new IdentityServiceClient(serviceConfig.identityServiceUrl);
  const requirePermission = createRequirePermission(identityClient);
  const requirePermissionByMethod = createRequirePermissionByMethod(requirePermission);
  const requireAdminRoles = requirePermission('admin.roles.manage');

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api-gateway',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    dependencies: { database: 'ok' as const, rabbitmq: 'ok' as const },
  }));

  await registerIdentityRoutes(app, { authenticate, requireAdminRoles, requirePermissionByMethod, identityServiceUrl: serviceConfig.identityServiceUrl, identityClient });
  await registerPersonnelRoutes(app, { authenticate, requirePermission, requirePermissionByMethod, personnelServiceUrl: serviceConfig.personnelServiceUrl });
  await registerProjectRoutes(app, { authenticate, requirePermissionByMethod, projectServiceUrl: serviceConfig.projectServiceUrl });
  await registerProcurementRoutes(app, { authenticate, requirePermissionByMethod, procurementServiceUrl: serviceConfig.procurementServiceUrl });
  await registerIntegrationRoutes(app, { authenticate, requirePermissionByMethod, integrationServiceUrl: serviceConfig.integrationServiceUrl });
  await registerFinanceRoutes(app, { authenticate, requirePermissionByMethod, financeServiceUrl: serviceConfig.financeServiceUrl });
  await registerPerformanceRoutes(app, { authenticate, requirePermissionByMethod, performanceServiceUrl: serviceConfig.performanceServiceUrl });
  await registerRiskRoutes(app, { authenticate, requirePermissionByMethod, riskServiceUrl: serviceConfig.riskServiceUrl });
  await registerNotificationRoutes(app, { authenticate, requirePermissionByMethod, notificationServiceUrl: serviceConfig.notificationServiceUrl });
  await registerReportingRoutes(app, { authenticate, requirePermissionByMethod, reportingServiceUrl: serviceConfig.reportingServiceUrl });
  await registerLoggerRoutes(app, { authenticate, requirePermission, loggerServiceUrl: serviceConfig.loggerServiceUrl });

  return app;
}
