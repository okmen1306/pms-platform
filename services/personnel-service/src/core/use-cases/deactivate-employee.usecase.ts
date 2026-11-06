import { EmployeeDeletionNotAllowedError, NotFoundError, type AuditPublisherFn } from '@pms/shared';
import type { EmployeeRepository } from '../../infrastructure/database/employee.repository';
import type { EmployeeUpdatedPublisherFn } from './update-employee.usecase';

/**
 * Kural #9: DELETE yok, sadece inactive. Bir personel projeye atanmışsa dahi inactive
 * yapılabilir (kural sadece SİLMEYİ yasaklıyor) — bu yüzden burada engel yok, sadece bilgi
 * amaçlı audit event'i "warning" seviyesinde işaretleniyor ki admin fark etsin.
 * (EmployeeDeletionNotAllowedError, Day 11+'da employee.controller.ts'e eklenecek DELETE
 * endpoint'inin reddi için burada import edilmiş durumda tutuluyor — bkz. TODO.)
 *
 * Day 15 eklendi: `employee.updated` (`durum: 'inactive'`) de yayınlanır. roadmap.md satır 1366
 * ayrı bir `employee.deactivated` event'i tanımlıyor ama Kuyruk Haritası'nda (satır 1394) bu
 * event'in HİÇBİR tüketicisi yok — oysa `project-service`/`finance-service`'in Redis cache'i
 * (`{ adSoyad, durum }`) TAM OLARAK bu bilgiye muhtaç: cache'lenmiş `durum` değeri deactivate
 * sonrası GÜNCELLENMEZSE sonsuza kadar "active" görünür kalırdı (roadmap.md satır 137'nin "TTL
 * yok, event geldikçe güncellenir" ilkesinin ihlali). Ayrı bir `employee.deactivated` +
 * consumer'sız bir event daha eklemek yerine, mevcut cache-güncelleme yolunu (`employee.updated`)
 * yeniden kullanmak bugünün kapsamına (Redis senkronizasyonu) daha sadık bir çözüm — bu bir
 * mimari sapma değil, aynı Day 14'ün "Kuyruk Haritası güncel değil" bulgularıyla aynı türden,
 * gerekçeli bir seçim (bkz. shared/events/personnel.events.ts başlık notu).
 */
export async function deactivateEmployee(
  employeeId: string,
  actorUserId: string,
  repo: EmployeeRepository,
  publishAudit: AuditPublisherFn,
  publishEmployeeUpdated: EmployeeUpdatedPublisherFn,
  hasAssignments: (employeeId: string) => Promise<boolean>,
): Promise<void> {
  const employee = await repo.findById(employeeId);
  if (!employee) {
    throw new NotFoundError('Personel', employeeId);
  }

  // Day 20 (G-15): kontrol artık project-service'e REST ile yapılıyor (`ProjectServiceClient`).
  // Kural #9 deactivate'i ENGELLEMEZ (sadece silmeyi yasaklar) — sonuç yalnızca audit önem
  // derecesini belirler. project-service ulaşılamazsa pasife alma ENGELLENMEZ; atanmış olabileceği
  // varsayılarak (muhafazakâr) 'warning' yazılır ki admin fark etsin.
  let isAssigned: boolean;
  try {
    isAssigned = await hasAssignments(employeeId);
  } catch {
    isAssigned = true;
  }
  await repo.deactivate(employeeId);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'personnel_employees',
    entityId: employeeId,
    ozet: `${employee.ad} ${employee.soyad} pasife alındı.`,
    severity: isAssigned ? 'warning' : 'info',
  });

  await publishEmployeeUpdated({
    employeeId,
    adSoyad: `${employee.ad} ${employee.soyad}`,
    durum: 'inactive',
  });
}

// TODO (Day 11+): DELETE /employees/:id endpoint'i eklenirse burada kullanılacak:
export function assertDeletionNotAllowed(employeeId: string): never {
  throw new EmployeeDeletionNotAllowedError(employeeId);
}
