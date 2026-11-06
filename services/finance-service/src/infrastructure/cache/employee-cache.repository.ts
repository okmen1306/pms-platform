import { cacheKey, type NamespacedRedisClient } from '@pms/shared';

/**
 * Day 15: docs/roadmap.md Kuyruk Haritası'nda (satır 1394) `employee.created`/`employee.updated`
 * satırının İKİNCİ tüketicisi — `project-service`'teki `employee-cache.repository.ts` ile AYNI
 * desen, sadece namespace farklı (`finance:` — roadmap.md satır 1699'daki
 * "finance:exchange-rate-cache:*" örneğiyle AYNI kısaltılmış servis-adı kuralı). finance-service
 * BUGÜN bu cache'i hiçbir yerde OKUMUYOR (maaş zaten ayrı, senkron bir REST çağrısıyla —
 * `PersonnelServiceClient.getEmployeeSalary` — çözülüyor); bu satırın amacı SADECE Kuyruk
 * Haritası'nın vaat ettiği cache'in Day 15'ten itibaren GERÇEKTEN var olması ve event geldikçe
 * güncel kalması. Ekran tarafında kullanım (ör. maliyet raporunda personel adı gösterimi) ileri
 * bir güne bırakıldı — bkz. CHANGELOG.md Day 15 notu.
 */
export interface CachedEmployee {
  adSoyad: string;
  durum: 'active' | 'inactive';
}

export interface EmployeeCacheRepository {
  upsert(employeeId: string, value: CachedEmployee): Promise<void>;
  findById(employeeId: string): Promise<CachedEmployee | null>;
}

const SERVICE_NAMESPACE = 'finance';
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
