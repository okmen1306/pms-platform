import { randomUUID } from 'node:crypto';
import { describe, it, expect, afterAll } from 'vitest';
import { cacheKey, createNamespacedRedisClient } from '@pms/shared';
import { REDIS_URL, purgeCacheKeys } from './_helpers';

/**
 * Day 15: `employee-cache.repository.ts`'in (project-service/finance-service) her ikisi de AYNI
 * `createNamespacedRedisClient` yardımcısını kullanıyor (bkz. shared/cache/redis.client.ts,
 * Day 3/Q) ama bu yardımcı bugüne kadar HİÇBİR serviste GERÇEK Redis'e karşı çalıştırılmamıştı
 * (bkz. CHANGELOG.md Day 15 — "createNamespacedRedisClient hiçbir yerde kullanılmıyordu").
 * `docs/roadmap.md` satır 194-201'in "bir servis başka servisin Redis namespace'ine YAZAMAZ"
 * kuralının GERÇEKTEN çalışan bir kod olduğunu (sadece bir yorum satırı değil) ilk kez burada
 * kanıtlıyoruz.
 */
describe('Redis namespace izolasyonu (KIRILMAZ KURAL — gerçek Redis)', () => {
  const employeeId = randomUUID();

  afterAll(async () => {
    await purgeCacheKeys('project:employee-cache:*');
  });

  it('project-service kendi namespace\'ine (project:) yazabilir', async () => {
    const projectRedis = createNamespacedRedisClient('project', REDIS_URL);
    await expect(projectRedis.set(cacheKey('project', 'employee-cache', employeeId), JSON.stringify({ adSoyad: 'Test', durum: 'active' }))).resolves.toBeUndefined();
    const raw = await projectRedis.get(cacheKey('project', 'employee-cache', employeeId));
    expect(raw).toContain('Test');
  });

  it("project-service finance-service'in namespace'ine (finance:) YAZAMAZ — çalışma zamanında patlar", async () => {
    const projectRedis = createNamespacedRedisClient('project', REDIS_URL);
    await expect(projectRedis.set(cacheKey('finance', 'employee-cache', employeeId), JSON.stringify({ adSoyad: 'Sızma Denemesi', durum: 'active' }))).rejects.toThrow(/namespace ihlali/);
  });

  it("project-service finance-service'in namespace'inden OKUYAMAZ — aynı çalışma zamanı koruması", async () => {
    const projectRedis = createNamespacedRedisClient('project', REDIS_URL);
    await expect(projectRedis.get(cacheKey('finance', 'employee-cache', employeeId))).rejects.toThrow(/namespace ihlali/);
  });
});
