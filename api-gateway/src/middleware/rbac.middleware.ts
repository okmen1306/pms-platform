import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenPageAccessError } from '@pms/shared';
import type { IdentityServiceClient } from '../clients/identity-service.client';

/**
 * Day 6 (TL): RBAC middleware. `auth.middleware.ts` zaten `request.actor`'ı doldurmuş olmalı
 * (preHandler sırası önemli: authenticate -> requirePermission). `is_super_admin` her zaman
 * geçer (bkz. docs/roadmap.md Bölüm 11.0 `has_permission()` ile birebir aynı mantık — burada
 * frontend/gateway seviyesinde, RLS'te veritabanı seviyesinde uygulanıyor; iki katman da
 * savunma derinliği için gerekli).
 */
export function createRequirePermission(identityClient: IdentityServiceClient) {
  return function requirePermission(permissionKey: string, need: 'view' | 'edit' = 'view') {
    return async function rbacMiddleware(request: FastifyRequest, _reply: FastifyReply) {
      const actor = request.actor;
      if (!actor) {
        throw new ForbiddenPageAccessError('bilinmiyor', permissionKey);
      }
      if (actor.isSuperAdmin) return;

      const permissions = await identityClient.getEffectivePermissions(actor.sub);
      const match = permissions.find((p) => p.permission_key === permissionKey);
      const allowed = match ? (need === 'view' ? match.can_view : match.can_edit) : false;

      if (!allowed) {
        throw new ForbiddenPageAccessError(actor.roleKod, permissionKey);
      }
    };
  };
}

/**
 * Day 21 (TL, G-01): yöntem bazlı izin — GET/HEAD -> `view`, POST/PUT/PATCH/DELETE -> `edit`.
 * `OPTIONS` (CORS ön-uçuşu) kimlik taşımaz ve @fastify/cors tarafından zaten yanıtlanır; yine de
 * buraya düşerse geçirilir.
 * `readOpen: true` — okuma (GET) herhangi bir kimliği doğrulanmış kullanıcıya açık, yalnızca yazma
 * izin ister (örn. integration: kur/iş günü okuması proje sihirbazı için herkese gerekli).
 */
export function createRequirePermissionByMethod(requirePermission: ReturnType<typeof createRequirePermission>) {
  return function requirePermissionByMethod(permissionKey: string, opts: { readOpen?: boolean } = {}) {
    const needView = requirePermission(permissionKey, 'view');
    const needEdit = requirePermission(permissionKey, 'edit');
    return async function methodRbac(request: FastifyRequest, reply: FastifyReply) {
      const method = request.method.toUpperCase();
      if (method === 'OPTIONS') return;
      if (method === 'GET' || method === 'HEAD') {
        if (opts.readOpen) return;
        return needView(request, reply);
      }
      return needEdit(request, reply);
    };
  };
}

