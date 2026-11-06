import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): risk analizi okuma/yazma. */
export async function registerRiskRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { riskServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/risk', upstream: deps.riskServiceUrl, permissionKey: PERMISSION_KEYS.RISK_ANALYSIS });
}
