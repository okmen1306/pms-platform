import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): GET -> view, puanlama/kriter yazma -> edit. */
export async function registerPerformanceRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { performanceServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/performance', upstream: deps.performanceServiceUrl, permissionKey: PERMISSION_KEYS.PERFORMANCE_SCORE });
}
