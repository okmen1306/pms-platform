import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ok, okList, type AuditPublisherFn } from '@pms/shared';
import { createUser, type UserAdminDeps } from '../core/use-cases/create-user.usecase';
import { changeUserRole } from '../core/use-cases/change-user-role.usecase';
import { changeOwnPassword } from '../core/use-cases/change-own-password.usecase';
import { updateRole } from '../core/use-cases/update-role.usecase';

const ListQuerySchema = z.object({
  role: z.string().regex(/^[a-z0-9_]+$/).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});
const CreateUserBodySchema = z.object({
  email: z.string().email(),
  temporaryPassword: z.string().min(1),
  roleId: z.string().uuid(),
  personnelId: z.string().uuid().nullable().optional(),
  dilTercihi: z.enum(['tr', 'en']).optional(),
});
const IdParam = z.object({ id: z.string().uuid() });
const ChangeRoleBodySchema = z.object({ roleId: z.string().uuid() });
const ChangePasswordBodySchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) });
const UpdateRoleBodySchema = z
  .object({ ad: z.string().min(2).optional(), aciklama: z.string().nullable().optional(), aktif: z.boolean().optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'En az bir alan verilmeli' });

/** Eylemi yapan kullanıcı: gateway `x-actor-id`'yi JWT'den yazar (istemci başlığı ezilir). */
const actorOf = (headers: Record<string, unknown>) => (headers['x-actor-id'] as string) ?? 'dev-actor';

export function registerUserRoutes(app: FastifyInstance, deps: UserAdminDeps & { publishAudit: AuditPublisherFn }) {
  app.get('/users', async (request) => {
    const q = ListQuerySchema.parse(request.query);
    const items = await deps.userRepo.findMany({ roleKod: q.role, status: q.status });
    return okList(items, { page: 1, pageSize: items.length, total: items.length });
  });

  app.post('/users', async (request, reply) => {
    const body = CreateUserBodySchema.parse(request.body);
    const created = await createUser(body, actorOf(request.headers), deps);
    reply.code(201);
    return ok(created);
  });

  app.patch('/users/:id/role', async (request) => {
    const { id } = IdParam.parse(request.params);
    const { roleId } = ChangeRoleBodySchema.parse(request.body);
    return ok(await changeUserRole(id, roleId, actorOf(request.headers), deps));
  });

  app.patch('/roles/:id', async (request) => {
    const { id } = IdParam.parse(request.params);
    const body = UpdateRoleBodySchema.parse(request.body);
    return ok(await updateRole(id, body, actorOf(request.headers), deps.roleRepo, deps.publishAudit));
  });

  /** Kimliği yalnızca gateway'in yazdığı `x-actor-id`'den alır — gövdede kullanıcı id'si KABUL EDİLMEZ. */
  app.post('/me/password', async (request) => {
    const body = ChangePasswordBodySchema.parse(request.body);
    await changeOwnPassword(actorOf(request.headers), body.currentPassword, body.newPassword, deps);
    return ok({ changed: true });
  });
}
