import { NotFoundError, ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { EmployeeRepository, EmployeeRow, UpdateEmployeeRow } from '../../infrastructure/database/employee.repository';

export interface UpdateEmployeeInput {
  ad?: string;
  soyad?: string;
  email?: string;
  maasTl?: number;
}

/**
 * Publisher imzası burada (create-employee.usecase.ts ile AYNI desen) — gerçek RabbitMQ
 * bağımlılığı `employee-updated.publisher.ts`'te, use-case sadece imzaya bağımlı (test edilebilir).
 */
export type EmployeeUpdatedPublisherFn = (event: { employeeId: string; adSoyad: string; durum: 'active' | 'inactive' }) => Promise<void>;

/**
 * Day 15: roadmap.md satır 1471'de Day 1'den beri planlı olan `PATCH /employees/:id` ilk kez
 * burada gerçekleşiyor. `durum` KASITLI OLARAK güncellenebilir alanların DIŞINDA — o zaten ayrı
 * bir endpoint'in (`/deactivate`) sorumluluğu (Kural #9). Bu use-case sadece ad/soyad/email/maaş
 * değiştiğinde çalışır; `employee.updated` event'i HER ZAMAN yayınlanır (personel adı DEĞİŞMESE
 * bile) çünkü cache'i tüketen servisler için "bu personel hâlâ var ve güncel" sinyali de değerli
 * — Day 14'ün audit dokümanındaki "üretici yoktu" bulgusunu kapatmanın amacı, cache'in event
 * geldikçe güncellenmesini GARANTİ etmek (roadmap.md satır 137: "TTL yok, event geldikçe
 * güncellenir").
 */
export async function updateEmployee(
  employeeId: string,
  input: UpdateEmployeeInput,
  actorUserId: string,
  repo: EmployeeRepository,
  publishAudit: AuditPublisherFn,
  publishEmployeeUpdated: EmployeeUpdatedPublisherFn,
): Promise<EmployeeRow> {
  const existing = await repo.findById(employeeId);
  if (!existing) {
    throw new NotFoundError('Personel', employeeId);
  }

  if (Object.keys(input).length === 0) {
    throw new ValidationError('Güncellenecek en az bir alan gerekli (ad, soyad, email, maasTl).');
  }
  if (input.maasTl !== undefined && input.maasTl <= 0) {
    throw new ValidationError('maasTl 0\'dan büyük olmalı');
  }

  const data: UpdateEmployeeRow = {};
  if (input.ad !== undefined) data.ad = input.ad;
  if (input.soyad !== undefined) data.soyad = input.soyad;
  if (input.email !== undefined) data.email = input.email;
  if (input.maasTl !== undefined) data.maas_tl = input.maasTl;

  const updated = await repo.update(employeeId, data);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'personnel_employees',
    entityId: employeeId,
    ozet: `${updated.ad} ${updated.soyad} personel bilgileri güncellendi.`,
    severity: 'info',
  });

  await publishEmployeeUpdated({
    employeeId: updated.id,
    adSoyad: `${updated.ad} ${updated.soyad}`,
    durum: updated.durum,
  });

  return updated;
}
