import Redis from 'ioredis';
import { assertOwnNamespace } from './cache-key.helper';
/**
 * Her servis KENDİ REDIS_URL'sindeki (ayrı DB index'i, bkz. .env.example) bağlantıyı açar.
 * Başka bir servisin DB index'ine bağlanmak KIRILMAZ KURAL ihlalidir (roadmap.md Bölüm 2/2.1).
 */
export function createRedisClient(redisUrl) {
    return new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
    });
}
export function createNamespacedRedisClient(service, redisUrl) {
    const raw = createRedisClient(redisUrl);
    return {
        raw,
        async get(key) {
            assertOwnNamespace(service, key);
            return raw.get(key);
        },
        async set(key, value, ttlSeconds) {
            assertOwnNamespace(service, key);
            if (ttlSeconds) {
                await raw.set(key, value, 'EX', ttlSeconds);
            }
            else {
                await raw.set(key, value);
            }
        },
        async del(key) {
            assertOwnNamespace(service, key);
            await raw.del(key);
        },
    };
}
