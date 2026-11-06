import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): e-posta şablonu yönetimi. */
export async function registerNotificationRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { notificationServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/notification', upstream: deps.notificationServiceUrl, permissionKey: PERMISSION_KEYS.NOTIFICATION_TEMPLATES });
}
