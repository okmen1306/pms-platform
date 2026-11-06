import Redis from 'ioredis';
import { assertOwnNamespace } from './cache-key.helper';

/**
 * Her servis KENDİ REDIS_URL'sindeki (ayrı DB index'i, bkz. .env.example) bağlantıyı açar.
 * Başka bir servisin DB index'ine bağlanmak KIRILMAZ KURAL ihlalidir (roadmap.md Bölüm 2/2.1).
 */
export function createRedisClient(redisUrl: string): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

/**
 * Day 3 (Q): namespace kuralını ÇALIŞMA ZAMANINDA zorlayan sarmalayıcı. Ham `Redis` istemcisi
 * yerine tercihen bu fabrika kullanılır — her get/set/del çağrısı, anahtarın "{service}:" ile
 * başladığını `assertOwnNamespace` ile doğrular. Bir servis yanlışlıkla başka servisin
 * namespace'ine yazmaya kalkarsa exception fırlatır, sessizce veri karışmaz.
 */
export interface NamespacedRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  raw: Redis;
}

export function createNamespacedRedisClient(service: string, redisUrl: string): NamespacedRedisClient {
  const raw = createRedisClient(redisUrl);

  return {
    raw,
    async get(key: string) {
      assertOwnNamespace(service, key);
      return raw.get(key);
    },
    async set(key: string, value: string, ttlSeconds?: number) {
      assertOwnNamespace(service, key);
      if (ttlSeconds) {
        await raw.set(key, value, 'EX', ttlSeconds);
      } else {
        await raw.set(key, value);
      }
    },
    async del(key: string) {
      assertOwnNamespace(service, key);
      await raw.del(key);
    },
  };
}
