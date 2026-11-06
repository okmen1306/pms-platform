import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): malzeme/stok. Yalnızca procurement.materials sahibi roller. */
export async function registerProcurementRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { procurementServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/procurement', upstream: deps.procurementServiceUrl, permissionKey: PERMISSION_KEYS.PROCUREMENT_MATERIALS });
}
