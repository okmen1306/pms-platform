import { createRedisClient } from '@pms/shared';

/**
 * Day 15: RabbitMQ tarafı için Day 14'ün `tests/events/_helpers.ts`'i AYNEN yeniden kullanılıyor
 * (createConnectedClient/purgeQueue/waitFor) — bu dosya SADECE Redis'e özgü doğrulama
 * yardımcılarını ekliyor. Bu kum havuzunda Day 14'teki AYNI şekilde `apt-get install
 * redis-server` ile GERÇEK bir Redis kuruldu (Docker yok).
 */
export { createConnectedClient, purgeQueue, waitFor, RABBITMQ_URL } from '../events/_helpers';

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

/**
 * Testler bağımsız çalışsın diye — `project:employee-cache:*` / `finance:employee-cache:*`
 * namespace'lerindeki test anahtarlarını temizler. `flushdb` KULLANILMIYOR: gerçek bir ortamda
 * (CI'daki servis konteyneri) o DB'de başka şeyler de olabilir, sadece bu testlerin kendi
 * anahtarlarını silmek KIRILMAZ KURAL'ın (bir servis/test sadece kendi namespace'ine dokunur)
 * ruhuna daha uygun.
 */
export async function purgeCacheKeys(pattern: string): Promise<void> {
  const raw = createRedisClient(REDIS_URL);
  await raw.connect();
  const keys = await raw.keys(pattern);
  if (keys.length > 0) {
    await raw.del(...keys);
  }
  await raw.quit();
}

/** Consumer'ın YAZDIĞI değeri, repository katmanının DIŞINDAN (ham `GET`) doğrulamak için. */
export async function readRawCacheValue(key: string): Promise<string | null> {
  const raw = createRedisClient(REDIS_URL);
  await raw.connect();
  const value = await raw.get(key);
  await raw.quit();
  return value;
}
