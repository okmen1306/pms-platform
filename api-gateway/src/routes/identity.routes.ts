import type { FastifyInstance } from 'fastify';
import { ok, PERMISSION_KEYS } from '@pms/shared';
import type { IdentityServiceClient } from '../clients/identity-service.client';
import { registerServiceProxy, attachActorHeaders, type GatewayPreHandler } from '../proxy/service-proxy';

/**
 * identity-service'in `/auth/login`, `/auth/refresh`, `/auth/logout` uç noktaları TARAYICIDAN
 * JWT olmadan çağrılır (login'in kendisi JWT üretir — "tavuk-yumurta" problemi). Bu yüzden
 * `/identity/auth/*` HİÇBİR preHandler olmadan proxy'lenir; identity-service'in kendisi
 * (refresh token / rate limit gibi) kendi güvenliğini zaten sağlıyor.
 *
 * `/identity/*`'nin geri kalanı (roller, izinler, kullanıcı override'ları) yönetimsel işlemler
 * olduğundan `admin.roles.manage` izni ister — bu, Day 6'nın `/admin/ping` demo'suyla
 * KANITLANMIŞ aynı izin anahtarı.
 */
export async function registerIdentityRoutes(
  app: FastifyInstance,
  deps: {
    authenticate: GatewayPreHandler;
    requireAdminRoles: GatewayPreHandler;
    requirePermissionByMethod: (key: string, opts?: { readOpen?: boolean }) => GatewayPreHandler;
    identityServiceUrl: string;
    identityClient: IdentityServiceClient;
  },
) {
  // Day 21 (G-20): web'in `usePermission` hook'u ve AppShell menüsü KENDİ etkin izinlerini okur. Genel
  // `/identity/*` admin.roles.manage ister (admin olmayan kullanıcı kendi izinlerini bile okuyamazdı);
  // bu yüzden gateway'e ÖZEL, kimliği yalnızca JWT'nin `sub`'ından alan bir uç nokta eklendi —
  // başka kullanıcının id'sini parametre olarak KABUL ETMEZ (yetki sızıntısı yok). identity-service
  // erişilemezse client [] döner -> kapalı (fail-closed) davranış.
  app.get('/identity/me/effective-permissions', { preHandler: [deps.authenticate] }, async (request) => {
    const actor = request.actor!;
    const perms = await deps.identityClient.getEffectivePermissions(actor.sub);
    return ok(
      perms.map((p) => ({ permissionKey: p.permission_key, canView: p.can_view, canEdit: p.can_edit, isOverride: p.is_override })),
    );
  });
  await registerServiceProxy(app, {
    prefix: '/identity/auth',
    // Day 18 (entegrasyon bulgusu): identity-service'in gerçek rotası `/auth/login` — bkz.
    // service-proxy.ts'teki Day 18 notu. Bu satır olmadan `/identity/auth/login` upstream'e
    // sadece `/login` olarak gidiyordu (404).
    rewritePrefix: '/auth',
    upstream: deps.identityServiceUrl,
    preHandler: [],
  });

  // Day 22 (G-02): kullanıcı KENDİ parolasını değiştirir (geçici parola dahil) — admin izni gerekmez,
  // yalnızca kimlik. Hedef kullanıcı gövdeden değil `x-actor-id`'den (JWT) gelir. identity-service'in
  // `/me/*` altında yalnızca `/me/password` var; `/identity/me/effective-permissions` yukarıdaki
  // statik gateway route'u olduğundan (static > wildcard) bu proxy'ye düşmez.
  await registerServiceProxy(app, {
    prefix: '/identity/me',
    rewritePrefix: '/me',
    upstream: deps.identityServiceUrl,
    preHandler: [deps.authenticate, attachActorHeaders],
  });

  // Day 22 (G-02): spec "ik_yoneticisi POST /users" — YALNIZCA tam olarak `/identity/users` (liste ve
  // oluşturma) `admin.users.manage` (yöntem bazlı) ister; alt yollar (`/users/:id/role`,
  // `/users/:id/permission-overrides`, `/roles/*`...) `admin.roles.manage` kalır. Gevşetme YALNIZCA
  // ham yol birebir eşleşince yapılır; her belirsiz yol (`/users/../roles`, `//users`, büyük harf)
  // sıkı kapıya düşer. Rol atamada yetki yükseltmeyi identity-service engeller (assertCanAssignRole).
  const usersGate = deps.requirePermissionByMethod(PERMISSION_KEYS.ADMIN_USERS_MANAGE);
  const identityGate: GatewayPreHandler = async (request, reply) => {
    const path = request.url.split('?')[0].replace(/\/$/, '');
    return path === '/identity/users' ? usersGate(request, reply) : deps.requireAdminRoles(request, reply);
  };
  await registerServiceProxy(app, {
    prefix: '/identity',
    upstream: deps.identityServiceUrl,
    preHandler: [deps.authenticate, attachActorHeaders, identityGate],
  });
}
