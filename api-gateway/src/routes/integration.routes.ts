import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): kur/tatil/iş günü OKUMA her kimlikli kullanıcıya açık (sihirbaz ve takvim ihtiyacı); tatil/kur override YAZMA integration.holidays edit ister. */
export async function registerIntegrationRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { integrationServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/integration', upstream: deps.integrationServiceUrl, permissionKey: PERMISSION_KEYS.INTEGRATION_HOLIDAYS, readOpen: true });
}
