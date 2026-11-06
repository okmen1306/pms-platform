import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList } from '@pms/shared';
import { getPermissionCatalog, getEffectivePermissions } from '../core/use-cases/manage-user-override.usecase';
import type { PermissionRepository } from '../infrastructure/database/permission.repository';

/** docs/roadmap.md Bölüm 8 identity-service — İzin Kataloğu ve etkin izin sorgusu. */
export function registerPermissionRoutes(app: FastifyInstance, deps: { permissionRepo: PermissionRepository }) {
  app.get('/permissions', async () => {
    const items = await getPermissionCatalog(deps.permissionRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.get('/users/:id/effective-permissions', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await getEffectivePermissions(id, deps.permissionRepo);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });
}
