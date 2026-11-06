import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, GrantUserPermissionOverrideDtoSchema, type AuditPublisherFn } from '@pms/shared';
import {
  grantUserPermissionOverride,
  revokeUserPermissionOverride,
} from '../core/use-cases/manage-user-override.usecase';
import type { PermissionRepository } from '../infrastructure/database/permission.repository';
import { NotFoundError } from '@pms/shared';

export interface UserOverrideControllerDeps {
  permissionRepo: PermissionRepository;
  publishAudit: AuditPublisherFn;
  publishOverridden: (event: {
    userId: string;
    permissionKey: string;
    canView: boolean | null;
    canEdit: boolean | null;
    grantedBy: string;
    gerekce: string;
  }) => Promise<void>;
}

/**
 * docs/roadmap.md Bölüm 8 identity-service — Kullanıcı Bazlı İzin Override.
 * Kural: rolü DEĞİŞTİRMEDEN ek/kısıtlı izin verilir; gerekçe zorunludur (Zod şemasında min 5 karakter).
 */
export function registerUserOverrideRoutes(app: FastifyInstance, deps: UserOverrideControllerDeps) {
  app.post('/users/:id/permission-overrides', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const body = GrantUserPermissionOverrideDtoSchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';

    const catalog = await deps.permissionRepo.findAllCatalog();
    const permission = catalog.find((p) => p.id === body.permissionId);
    if (!permission) throw new NotFoundError('İzin', body.permissionId);

    const result = await grantUserPermissionOverride(
      id,
      {
        permissionId: body.permissionId,
        canView: body.canView,
        canEdit: body.canEdit,
        gerekce: body.gerekce,
        grantedBy: actorUserId,
        expiresAt: body.expiresAt,
      },
      permission,
      deps.permissionRepo,
      deps.publishAudit,
      deps.publishOverridden,
    );
    return ok(result);
  });

  /**
   * TL (Day 13, "admin API'leri ince ayar"): Day 1'den beri grant/revoke VARDI ama LİSTELEME
   * yoktu (bkz. permission.repository.ts UserOverrideRow yorumu) — Day 14'ün `UserOverridePanel`'i
   * bu olmadan mevcut override'ları gösteremezdi. Sadece AKTİF override'lar döner.
   */
  app.get('/users/:id/permission-overrides', async (request) => {
    const { id } = z.object({ id: z.guid() }).parse(request.params);
    const items = await deps.permissionRepo.listUserOverrides(id);
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.delete('/users/:id/permission-overrides/:overrideId', async (request) => {
    const { id, overrideId } = z
      .object({ id: z.guid(), overrideId: z.guid() })
      .parse(request.params);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    await revokeUserPermissionOverride(id, overrideId, actorUserId, deps.permissionRepo, deps.publishAudit);
    return ok({ revoked: true });
  });
}
