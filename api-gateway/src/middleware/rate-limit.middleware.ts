import rateLimit from '@fastify/rate-limit';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { RateLimitExceededError } from '@pms/shared';

/**
 * "Tüm servislere tek giriş kapısı, JWT doğrulama, rate limit" (docs/roadmap.md, api-gateway
 * satırı). Redis'in `gateway:ratelimit:*` namespace'i mimaride zaten ayrılmıştı (bkz.
 * docs/roadmap.md Redis satırı) — bu, o namespace'in ilk gerçek kullanımı.
 *
 * NOT: bu, TÜM isteklere (route preHandler'larından ÖNCE, `onRequest` aşamasında) uygulanan
 * GLOBAL/IP bazlı bir limittir. Kullanıcı bazlı (JWT sub'a göre) limitleme için JWT'nin bu
 * aşamadan önce doğrulanmış olması gerekirdi ki bu, auth kontrolünü iki kere yapmak anlamına
 * gelir (Uzman İnisiyatifi: over-engineering'den kaçınmak için Day 7 kapsamı IP bazlı tutuldu;
 * kullanıcı bazlı limitleme ileri bir günün TODO'su).
 */
export async function registerRateLimit(
  app: FastifyInstance,
  opts: { redisUrl: string; max: number; timeWindowMs: number },
): Promise<void> {
  const redis = new Redis(opts.redisUrl, { enableAutoPipelining: true, maxRetriesPerRequest: null });

  await app.register(rateLimit, {
    max: opts.max,
    timeWindow: opts.timeWindowMs,
    redis,
    nameSpace: 'gateway:ratelimit:',
    // Q (Day 8 düzeltmesi — bkz. RateLimitExceededError yorumu): @fastify/rate-limit bu
    // fonksiyonun döndürdüğü değeri THROW eder ve onun bir Error (statusCode'lu) olmasını
    // bekler; Day 7'nin çıplak obje döndüren hali 429 yerine sessizce 500 üretiyordu.
    errorResponseBuilder: (_request, context) =>
      new RateLimitExceededError(Math.ceil(context.ttl / 1000), context.max, opts.timeWindowMs),
  });
}
