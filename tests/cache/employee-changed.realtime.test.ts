import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PERSONNEL_EVENTS, cacheKey, createNamespacedRedisClient, queueName, type RabbitMqClient } from '@pms/shared';
import { createConnectedClient, purgeQueue, purgeCacheKeys, readRawCacheValue, waitFor } from './_helpers';

import { registerEmployeeChangedConsumer as registerProjectConsumer } from '../../services/project-service/src/infrastructure/messaging/consumers/employee-changed.consumer';
import { RedisEmployeeCacheRepository as ProjectEmployeeCacheRepository } from '../../services/project-service/src/infrastructure/cache/employee-cache.repository';

import { registerEmployeeChangedConsumer as registerFinanceConsumer } from '../../services/finance-service/src/infrastructure/messaging/consumers/employee-changed.consumer';
import { RedisEmployeeCacheRepository as FinanceEmployeeCacheRepository } from '../../services/finance-service/src/infrastructure/cache/employee-cache.repository';

/**
 * Day 15 (roadmap.md Bölüm 14.4: "Redis cache senkronizasyon testleri —
 * `employee.updated` → project/finance cache doğru güncelleniyor mu"): Day 14'ün
 * `tests/events/` deseninden BİR ADIM İLERİDE — orada DB katmanı fake'ti çünkü test sadece
 * broker teslimatını doğruluyordu, burada ise Redis GERÇEK (bu kum havuzunda `apt-get install
 * redis-server` ile kuruldu), çünkü test edilen ŞEY zaten "cache'e doğru yazıldı mı" sorusu —
 * fake bir repo ile bunu test etmek anlamsız olurdu (assertOwnNamespace'in GERÇEK Redis
 * anahtar formatını, `RedisEmployeeCacheRepository`'nin GERÇEK JSON serileştirmesini test dışı
 * bırakır).
 *
 * Bu event Day 14'e kadar hiç yoktu (bkz. docs/testing/event-integration-audit.md,
 * "Kuyruk Haritası'nın İLK satırı") — bugün önce üretici (personnel-service) + 2 tüketici
 * (project-service, finance-service) yazıldı, bu test o zincirin UCTAN UCA (gerçek broker +
 * gerçek cache) çalıştığını kanıtlıyor.
 */
describe('employee.created / employee.updated → project-service + finance-service Redis cache (GERÇEK broker + GERÇEK Redis)', () => {
  let rabbit: RabbitMqClient;
  const employeeId = randomUUID();
  const projectKey = cacheKey('project', 'employee-cache', employeeId);
  const financeKey = cacheKey('finance', 'employee-cache', employeeId);

  beforeAll(async () => {
    await purgeQueue(queueName('project-service', 'employee-changed'));
    await purgeQueue(queueName('finance-service', 'employee-changed'));
    await purgeCacheKeys('project:employee-cache:*');
    await purgeCacheKeys('finance:employee-cache:*');

    rabbit = await createConnectedClient();

    const projectRedis = createNamespacedRedisClient('project', process.env.REDIS_URL ?? 'redis://localhost:6379');
    const financeRedis = createNamespacedRedisClient('finance', process.env.REDIS_URL ?? 'redis://localhost:6379');

    await registerProjectConsumer(rabbit, {
      employeeCacheRepo: new ProjectEmployeeCacheRepository(projectRedis),
      logger: { info: () => {} } as never,
    });
    await registerFinanceConsumer(rabbit, {
      employeeCacheRepo: new FinanceEmployeeCacheRepository(financeRedis),
      logger: { info: () => {} } as never,
    });
  });

  afterAll(async () => {
    await rabbit.close();
    await purgeCacheKeys('project:employee-cache:*');
    await purgeCacheKeys('finance:employee-cache:*');
  });

  it('employee.created: HER İKİ serviste de {adSoyad, durum:"active"} GERÇEK Redis\'e yazılır', async () => {
    await rabbit.publish(PERSONNEL_EVENTS.EMPLOYEE_CREATED, { employeeId, adSoyad: 'Elif Şahin', durum: 'active' });

    await waitFor(async () => (await readRawCacheValue(projectKey)) !== null);
    await waitFor(async () => (await readRawCacheValue(financeKey)) !== null);

    expect(JSON.parse((await readRawCacheValue(projectKey))!)).toEqual({ adSoyad: 'Elif Şahin', durum: 'active' });
    expect(JSON.parse((await readRawCacheValue(financeKey))!)).toEqual({ adSoyad: 'Elif Şahin', durum: 'active' });
  });

  it('employee.updated (ad değişikliği): GERÇEK Redis\'teki değer ÜZERİNE YAZILIR (upsert), eski değer kalmaz', async () => {
    await rabbit.publish(PERSONNEL_EVENTS.EMPLOYEE_UPDATED, { employeeId, adSoyad: 'Elif Kaya', durum: 'active' });

    await waitFor(async () => {
      const raw = await readRawCacheValue(projectKey);
      return raw !== null && JSON.parse(raw).adSoyad === 'Elif Kaya';
    });
    await waitFor(async () => {
      const raw = await readRawCacheValue(financeKey);
      return raw !== null && JSON.parse(raw).adSoyad === 'Elif Kaya';
    });

    expect(JSON.parse((await readRawCacheValue(projectKey))!)).toEqual({ adSoyad: 'Elif Kaya', durum: 'active' });
    expect(JSON.parse((await readRawCacheValue(financeKey))!)).toEqual({ adSoyad: 'Elif Kaya', durum: 'active' });
  });

  it("employee.updated (durum: inactive — deactivate-employee.usecase.ts'in yayınladığı olay): cache BAYATLAMAZ", async () => {
    await rabbit.publish(PERSONNEL_EVENTS.EMPLOYEE_UPDATED, { employeeId, adSoyad: 'Elif Kaya', durum: 'inactive' });

    await waitFor(async () => {
      const raw = await readRawCacheValue(projectKey);
      return raw !== null && JSON.parse(raw).durum === 'inactive';
    });
    await waitFor(async () => {
      const raw = await readRawCacheValue(financeKey);
      return raw !== null && JSON.parse(raw).durum === 'inactive';
    });

    expect(JSON.parse((await readRawCacheValue(projectKey))!).durum).toBe('inactive');
    expect(JSON.parse((await readRawCacheValue(financeKey))!).durum).toBe('inactive');
  });

  it("maas_tl/maasTl HİÇBİR ZAMAN cache'e yazılmaz (event payload'ında zaten yok, ama ekstra bir güvence)", async () => {
    const raw = await readRawCacheValue(projectKey);
    expect(raw).not.toContain('maas');
  });
});
