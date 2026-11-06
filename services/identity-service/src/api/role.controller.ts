import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ok,
  okList,
  RolePermissionEntrySchema,
  RabbitMqClient,
  IDENTITY_EVENTS,
  type AuditPublisherFn,
} from '@pms/shared';
import { createRole } from '../core/use-cases/create-role.usecase';
import { deleteRole } from '../core/use-cases/delete-role.usecase';
import { updateRolePermissions } from '../core/use-cases/update-role-permissions.usecase';
import type { RoleRepository } from '../infrastructure/database/role.repository';
import type { PermissionRepository } from '../infrastructure/database/permission.repository';

const CreateRoleBodySchema = z.object({
  kod: z.string().regex(/^[a-z0-9_]+$/),
  ad: z.string().min(2),
  aciklama: z.string().optional(),
  copyPermissionsFromRoleId: z.string().uuid().optional(),
});

const UpdatePermissionsBodySchema = z.object({ permissions: z.array(RolePermissionEntrySchema) });

export interface RoleControllerDeps {
  roleRepo: RoleRepository;
  permissionRepo: PermissionRepository;
  rabbit: RabbitMqClient;
  publishAudit: AuditPublisherFn;
}

/** docs/roadmap.md Bölüm 8 identity-service — Rol Yönetimi (admin.roles.manage izni gerektirir). */
export function registerRoleRoutes(app: FastifyInstance, deps: RoleControllerDeps) {
  app.get('/roles', async () => {
    const items = await deps.roleRepo.findAll();
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/roles', async (request) => {
    const body = CreateRoleBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    const created = await createRole(body, actorUserId, deps.roleRepo, deps.publishAudit, (event) =>
      deps.rabbit.publish(IDENTITY_EVENTS.ROLE_CREATED, event),
    );
    return ok(created);
  });

  app.delete('/roles/:id', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    await deleteRole(id, actorUserId, deps.roleRepo, deps.publishAudit, (event) =>
      deps.rabbit.publish(IDENTITY_EVENTS.ROLE_DELETED, event),
    );
    return ok({ deleted: true });
  });

  /**
   * TL (Day 13, "admin API'leri ince ayar"): Day 12'ye kadar `id` parametresi HİÇ
   * kullanılmıyordu, her rol için AYNI tam katalog dönüyordu (bkz. permission.repository.ts
   * RolePermissionCatalogEntry yorumu — RoleManagementPage'in Day 12'deki sarı uyarısı buydu).
   */
  app.get('/roles/:id/permissions', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const catalog = await deps.permissionRepo.findRolePermissions(id);
    return okList(catalog, { page: 1, pageSize: catalog.length, total: catalog.length });
  });

  app.put('/roles/:id/permissions', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = UpdatePermissionsBodySchema.parse(request.body);
    const actorUserId = (request.headers['x-actor-id'] as string) ?? 'dev-actor';
    await updateRolePermissions(
      id,
      body.permissions,
      actorUserId,
      deps.roleRepo,
      deps.permissionRepo,
      deps.publishAudit,
      (event) => deps.rabbit.publish(IDENTITY_EVENTS.ROLE_PERMISSIONS_UPDATED, event),
    );
    return ok({ updated: true });
  });
}
