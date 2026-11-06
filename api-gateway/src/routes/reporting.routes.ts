import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): raporlar salt-okunur read-model; yine de yöntem bazlı. */
export async function registerReportingRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { reportingServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/reporting', upstream: deps.reportingServiceUrl, permissionKey: PERMISSION_KEYS.REPORTS_VIEW });
}
