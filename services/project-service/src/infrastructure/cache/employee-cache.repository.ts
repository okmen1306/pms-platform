import { cacheKey, type NamespacedRedisClient } from '@pms/shared';

/**
 * Day 15: docs/roadmap.md Bölüm 2.1'in TAM OLARAK tarif ettiği "somut örnek" — `project-service`,
 * `personnel_employees` tablosuna asla dokunmadan, `employee.created`/`employee.updated`
 * event'inden kendi Redis'ine `employee:{id} -> { adSoyad, durum }` yazar (satır 133-138).
 * `docs/testing/event-integration-audit.md`'nin Day 14'te bulduğu boşluk bu dosyayla kapanıyor
 * (üretici artık var — bkz. personnel-service — ve şimdi tüketici de var).
 *
 * TTL YOK (roadmap.md satır 137: "TTL yok, event geldikçe güncellenir") — cache'in tazeliği
 * SADECE event akışına bağlı, süre dolumuna değil.
 */
export interface CachedEmployee {
  adSoyad: string;
  durum: 'active' | 'inactive';
}

export interface EmployeeCacheRepository {
  upsert(employeeId: string, value: CachedEmployee): Promise<void>;
  findById(employeeId: string): Promise<CachedEmployee | null>;
}

const SERVICE_NAMESPACE = 'project';
const RESOURCE = 'employee-cache';

export class RedisEmployeeCacheRepository implements EmployeeCacheRepository {
  constructor(private readonly redis: NamespacedRedisClient) {}

  async upsert(employeeId: string, value: CachedEmployee): Promise<void> {
    await this.redis.set(cacheKey(SERVICE_NAMESPACE, RESOURCE, employeeId), JSON.stringify(value));
  }

  async findById(employeeId: string): Promise<CachedEmployee | null> {
    const raw = await this.redis.get(cacheKey(SERVICE_NAMESPACE, RESOURCE, employeeId));
    return raw ? (JSON.parse(raw) as CachedEmployee) : null;
  }
}
