import { z } from 'zod';

/**
 * Day 15: bu dosya Day 14 denetiminin en ciddi bulgularından birini kapatıyor —
 * `employee.created`/`employee.updated` şeması `grep`'te SIFIR sonuç veriyordu (bkz.
 * docs/testing/event-integration-audit.md, "Kuyruk Haritası'nın İLK satırı").
 *
 * Kasıtlı bir sadeleştirme notu: roadmap.md'nin İKİ farklı yerinde bu event'ler için FARKLI
 * şema var — satır ~1364'teki hızlı referans tablosu `employee.created` için
 * `{ employeeId, adSoyad, teamIds[] }` yazıyor, ama Bölüm 2.1'in (satır 133-138) somut,
 * gerekçeli örneği HER İKİ event için de sadece `{ employeeId, adSoyad, durum }` kullanıyor ve
 * cache'in TEK ihtiyacının bu olduğunu açıkça anlatıyor ("Ekranda personel adı gösterileceği an
 * project-service kendi Redis'inden okur"). `teamIds[]` bugün itibariyle hiçbir consumer
 * tarafından tüketilmiyor — hatta `assign-employee-to-team.usecase.ts` kendisi de hiçbir event
 * yayınlamıyor, yani bu alan her zaman boş bir dizi olarak kalırdı. Day 14'ün "Kuyruk Haritası
 * güncel değil" bulgularıyla (ör. exchange_rate.updated) AYNI muhakemeyle, burada daha ayrıntılı
 * ve gerekçeli olan Bölüm 2.1 esas alındı: created/updated için TEK, ortak bir şema.
 *
 * `maas_tl` KESİNLİKLE bu şemaya girmez (roadmap.md satır 134, 1364-1365 — hassas alan, sadece
 * `GET /employees/:id/salary` senkron REST çağrısıyla, izin kontrolüyle okunur).
 */
export const EmployeeChangedEventSchema = z.object({
  employeeId: z.string().uuid(),
  adSoyad: z.string().min(1),
  durum: z.enum(['active', 'inactive']),
});
export type EmployeeChangedEvent = z.infer<typeof EmployeeChangedEventSchema>;

// İsim ayrımı sadece okunabilirlik için (publisher/consumer kodunda "hangi event" belli olsun) —
// şema kasıtlı olarak aynı (yukarıdaki not).
export const EmployeeCreatedEventSchema = EmployeeChangedEventSchema;
export type EmployeeCreatedEvent = EmployeeChangedEvent;
export const EmployeeUpdatedEventSchema = EmployeeChangedEventSchema;
export type EmployeeUpdatedEvent = EmployeeChangedEvent;

export const PERSONNEL_EVENTS = {
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
} as const;
