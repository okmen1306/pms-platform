import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerServiceProxy, attachActorHeaders, type GatewayPreHandler } from '../proxy/service-proxy';

/** Denetim kaydı (audit log) sadece admin.audit_log iznine sahip kullanıcılara açık. */
export async function registerLoggerRoutes(
  app: FastifyInstance,
  deps: {
    authenticate: GatewayPreHandler;
    requirePermission: (key: string, need?: 'view' | 'edit') => GatewayPreHandler;
    loggerServiceUrl: string;
  },
) {
  await registerServiceProxy(app, {
    prefix: '/logger',
    upstream: deps.loggerServiceUrl,
    preHandler: [deps.authenticate, attachActorHeaders, deps.requirePermission(PERMISSION_KEYS.ADMIN_AUDIT_LOG)],
  });
}
