import { ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { EmployeeRepository, CreateEmployeeRow, EmployeeRow } from '../../infrastructure/database/employee.repository';
import type { EmployeeUpdatedPublisherFn } from './update-employee.usecase';

export interface CreateEmployeeInput {
  ad: string;
  soyad: string;
  email: string;
  iseBaslamaTarihi: string;
  maasTl: number;
}

/**
 * Day 15: `employee.created` şeması (`shared/events/personnel.events.ts`) `employee.updated`
 * ile AYNI (bkz. o dosyadaki gerekçe notu), bu yüzden publisher imzası da aynı — tek fonksiyon
 * tipini iki yerde tanımlamak yerine `EmployeeUpdatedPublisherFn` burada yeniden kullanılıyor.
 */
export async function createEmployee(
  input: CreateEmployeeInput,
  actorUserId: string,
  repo: EmployeeRepository,
  publishAudit: AuditPublisherFn,
  publishEmployeeCreated: EmployeeUpdatedPublisherFn,
): Promise<EmployeeRow> {
  if (input.maasTl <= 0) {
    throw new ValidationError('maasTl 0\'dan büyük olmalı');
  }

  const data: CreateEmployeeRow = {
    ad: input.ad,
    soyad: input.soyad,
    email: input.email,
    ise_baslama_tarihi: input.iseBaslamaTarihi,
    maas_tl: input.maasTl,
    olusturan_id: actorUserId,
  };

  const created = await repo.create(data);

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'personnel_employees',
    entityId: created.id,
    ozet: `${created.ad} ${created.soyad} personel olarak eklendi.`,
    severity: 'info',
  });

  await publishEmployeeCreated({
    employeeId: created.id,
    adSoyad: `${created.ad} ${created.soyad}`,
    durum: created.durum,
  });

  return created;
}
