/**
 * Tüm servislerde cache anahtarlarının "{servis}:{kaynak}:{id}" formatında olmasını zorunlu
 * kılan tek yardımcı. Serbest string birleştirme yerine bu fonksiyon kullanılır ki namespace
 * ihlali (başka servisin anahtar alanına yazma) kod incelemesinde kolayca yakalansın.
 */
export function cacheKey(service: string, resource: string, id: string): string {
  return `${service}:${resource}:${id}`;
}

/**
 * Day 3 (Q): Redis namespace kuralının ÇALIŞMA ZAMANI garantisi. `createNamespacedRedisClient`
 * (bkz. redis.client.ts) her get/set/del çağrısından önce bu fonksiyonu çalıştırır — bir servis
 * yanlışlıkla başka bir servisin anahtar alanına ("{başka-servis}:...") yazmaya çalışırsa hemen
 * (build zamanında değil ama en azından ilk çalıştırmada, sessizce veri karışmadan) patlar.
 */
export function assertOwnNamespace(service: string, key: string): void {
  const expectedPrefix = `${service}:`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error(
      `Redis namespace ihlali: "${service}" servisi "${key}" anahtarına erişmeye çalıştı. ` +
        `Anahtar "${expectedPrefix}" ile başlamalı (bkz. docs/roadmap.md Bölüm 2.1 Kırılmaz Kural).`,
    );
  }
}
