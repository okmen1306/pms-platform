import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PERMISSION_KEYS, ok, ServiceUnavailableError } from '@pms/shared';
import { registerServiceProxy, attachActorHeaders, type GatewayPreHandler } from '../proxy/service-proxy';

/**
 * `GET /employees/:id/salary` (bkz. personnel-service CHANGELOG.md Day 7) roadmap.md'de
 * "ik_yoneticisi, sirket_yoneticisi" ile kısıtlı olarak tanımlı. Genel `/personnel/*` proxy'si
 * SADECE `authenticate` ister (bkz. dosya başı notu); bu yüzden maaş uç noktası için AYRI ve
 * DAHA ÖZEL bir route tanımlanıp genel proxy'den ÖNCE eklendi — Fastify'ın router'ı (find-my-way)
 * kayıt sırasından bağımsız olarak her zaman en spesifik eşleşmeyi (statik/parametreli route)
 * genel joker (`/personnel/*`) proxy'sinden ÖNCE seçer, bu yüzden sıralama burada davranışı
 * etkilemez ama okunabilirlik için önce yazıldı.
 */
export async function registerPersonnelRoutes(
  app: FastifyInstance,
  deps: {
    authenticate: GatewayPreHandler;
    requirePermission: (key: string, need?: 'view' | 'edit') => GatewayPreHandler;
    requirePermissionByMethod: (key: string, opts?: { readOpen?: boolean }) => GatewayPreHandler;
    personnelServiceUrl: string;
  },
) {
  app.get(
    '/personnel/employees/:id/salary',
    { preHandler: [deps.authenticate, deps.requirePermission(PERMISSION_KEYS.PERSONNEL_SALARY)] },
    async (request) => {
      const { id } = z.object({ id: z.guid() }).parse(request.params);
      const upstream = await fetch(new URL(`/employees/${id}/salary`, deps.personnelServiceUrl));
      if (!upstream.ok) throw new ServiceUnavailableError('personnel-service');
      const body = (await upstream.json()) as any; // NOT: fetch tiplemesi Promise<unknown> döner (bkz. CHANGELOG.md Day 7 Q notu)
      return ok(body.data);
    },
  );

  await registerServiceProxy(app, {
    prefix: '/personnel',
    upstream: deps.personnelServiceUrl,
    // Day 21 (G-01): genel /personnel/* artık personnel.records ister (GET view, yazma edit).
    // Maaş uç noktası yukarıdaki ÖZEL route'ta ayrıca personnel.salary ister.
    preHandler: [deps.authenticate, attachActorHeaders, deps.requirePermissionByMethod(PERMISSION_KEYS.PERSONNEL_RECORDS)],
  });
}
