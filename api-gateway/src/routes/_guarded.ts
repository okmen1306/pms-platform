import type { FastifyInstance } from 'fastify';
import { registerServiceProxy, attachActorHeaders, type GatewayPreHandler } from '../proxy/service-proxy';

/** Day 21: izin anahtarı + yöntem bazlı kapıyla korunan tek-modül proxy'si. */
export interface GuardedRouteDeps {
  authenticate: GatewayPreHandler;
  requirePermissionByMethod: (key: string, opts?: { readOpen?: boolean }) => GatewayPreHandler;
}

export async function registerGuardedProxy(
  app: FastifyInstance,
  deps: GuardedRouteDeps,
  opts: { prefix: string; upstream: string; permissionKey: string; readOpen?: boolean; rewritePrefix?: string },
): Promise<void> {
  await registerServiceProxy(app, {
    prefix: opts.prefix,
    upstream: opts.upstream,
    rewritePrefix: opts.rewritePrefix,
    preHandler: [
      deps.authenticate,
      attachActorHeaders,
      deps.requirePermissionByMethod(opts.permissionKey, { readOpen: opts.readOpen }),
    ],
  });
}
