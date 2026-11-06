import httpProxy from '@fastify/http-proxy';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export type GatewayPreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

/**
 * Bir personelin bilgisini downstream servise taşır: `x-actor-id` / `x-actor-role` header'ları
 * (auth.middleware.ts'in doldurduğu `request.actor`'dan). Böylece personnel-service, project-service
 * vb. servisler `request.headers['x-actor-id'] ?? 'dev-actor'` fallback'ini artık GERÇEK bir
 * kimlikle kullanabilir (Day 1-6'da hep 'dev-actor' idi çünkü gateway proxy'si yoktu).
 *
 * NOT: `@fastify/http-proxy`, varsayılan olarak orijinal isteğin `request.headers`'ını
 * downstream'e aynen ileter (özel bir `rewriteRequestHeaders` verilmediği sürece) — bu yüzden
 * burada `request.headers` üzerinde yapılan değişiklik proxy'ye otomatik yansır.
 */
export async function attachActorHeaders(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.actor) {
    request.headers['x-actor-id'] = request.actor.sub;
    request.headers['x-actor-role'] = request.actor.roleKod;
  }
}

/**
 * Tüm servislere giden proxy route'larının ortak kaydı (TL, Day 7 — "proxy routing").
 * Her servis için `prefix` altında ne varsa `upstream`'e, prefix STRİPLENEREK iletilir
 * (`rewritePrefix: ''`) — yani `/personnel/employees` -> personnel-service'te `/employees` olur.
 */
/**
 * `@fastify/http-proxy`'nin `preHandler` seçeneği (bkz. node_modules/@fastify/http-proxy/types)
 * TEK bir hook fonksiyonu bekler, Fastify route'larının aksine dizi KABUL ETMEZ — bu yüzden
 * birden fazla preHandler (authenticate + requirePermission gibi) burada TEK bir fonksiyona
 * birleştirilir. `reply.sent` kontrolü, bir preHandler hata fırlatıp erken döndüğünde
 * (örn. UnauthorizedError) sonraki adımların çalışmamasını garanti eder.
 */
function composePreHandlers(handlers: GatewayPreHandler[]): GatewayPreHandler {
  return async (request, reply) => {
    for (const handler of handlers) {
      await handler(request, reply);
      if (reply.sent) return;
    }
  };
}

export async function registerServiceProxy(
  app: FastifyInstance,
  opts: { prefix: string; upstream: string; preHandler: GatewayPreHandler[]; rewritePrefix?: string },
): Promise<void> {
  await app.register(httpProxy, {
    upstream: opts.upstream,
    prefix: opts.prefix,
    // Day 18 (entegrasyon bulgusu): önceden HER ZAMAN '' idi ("prefix STRİPLENEREK iletilir" —
    // yukarıdaki yorum). identity.routes.ts'in `/identity/auth` kaydı için bu YANLIŞ: downstream
    // identity-service'in gerçek rotası `/auth/login`'dir, `/login` değil — `/identity/auth/login`
    // '' ile strip edilince upstream'e sadece `/login` gidiyordu ve mock login hiçbir zaman gerçek
    // isteği denemediği için bu Day 5'ten beri fark edilmemişti. Artık isteğe bağlı: verilmezse
    // davranış TÜM diğer servisler için DEĞİŞMEDİ (''), sadece identity.routes.ts kendi
    // `/auth`'unu geçiyor.
    rewritePrefix: opts.rewritePrefix ?? '',
    preHandler: composePreHandlers(opts.preHandler),
    http2: false,
  });
}

/** Sadece `authenticate` gerektiren, izin-bazlı ek kısıtlaması olmayan sıradan servisler için. */
export async function registerAuthenticatedProxy(
  app: FastifyInstance,
  opts: { prefix: string; upstream: string; authenticate: GatewayPreHandler },
): Promise<void> {
  await registerServiceProxy(app, {
    prefix: opts.prefix,
    upstream: opts.upstream,
    preHandler: [opts.authenticate, attachActorHeaders],
  });
}
