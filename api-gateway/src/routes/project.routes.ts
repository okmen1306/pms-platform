import type { FastifyInstance } from 'fastify';
import { PERMISSION_KEYS } from '@pms/shared';
import { registerGuardedProxy, type GuardedRouteDeps } from './_guarded';

/** Day 21 (G-01): GET -> project.records view, yazma -> edit. `project.all` kapsam (hangi projeleri görür) izni olup anahtar-seviyesi kapı değildir. */
export async function registerProjectRoutes(app: FastifyInstance, deps: GuardedRouteDeps & { projectServiceUrl: string }) {
  await registerGuardedProxy(app, deps, { prefix: '/project', upstream: deps.projectServiceUrl, permissionKey: PERMISSION_KEYS.PROJECT_RECORDS });
}
