import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { AuditPublisherFn } from '@pms/shared';
import { updateEmployee, type EmployeeUpdatedPublisherFn } from '../update-employee.usecase';
import { InMemoryEmployeeRepository } from './in-memory-employee.repository';

/**
 * Day 15: docs/testing/event-integration-audit.md'nin bulduğu boşluğu kapatan asıl kod —
 * `PATCH /employees/:id` roadmap.md'de Day 1'den beri planlıydı ama hiç yazılmamıştı, bu yüzden
 * `employee.updated`'ı tetikleyecek hiçbir yol yoktu. Bu test dosyası SADECE use-case katmanını
 * (gerçek RabbitMQ YOK, `publishEmployeeUpdated` bir `vi.fn()`) doğrular; gerçek broker + Redis
 * cache senkronizasyonu `tests/cache/employee-changed.realtime.test.ts`'te (Day 14'ün
 * `tests/events/` desenini izleyerek) ayrıca test edilir.
 */
describe('updateEmployee (Day 15)', () => {
  let repo: InMemoryEmployeeRepository;
  let publishAudit: Mock<AuditPublisherFn>;
  let publishEmployeeUpdated: Mock<EmployeeUpdatedPublisherFn>;

  beforeEach(async () => {
    repo = new InMemoryEmployeeRepository();
    publishAudit = vi.fn<AuditPublisherFn>().mockResolvedValue(undefined);
    publishEmployeeUpdated = vi.fn<EmployeeUpdatedPublisherFn>().mockResolvedValue(undefined);
    await repo.create({ ad: 'Ayşe', soyad: 'Yılmaz', email: 'ayse@acme.test', ise_baslama_tarihi: '2026-01-01', maas_tl: 50000, olusturan_id: 'aktor-1' });
  });

  function run(input: Parameters<typeof updateEmployee>[1], employeeId = 'personel-1') {
    return updateEmployee(employeeId, input, 'aktor-1', repo, publishAudit, publishEmployeeUpdated);
  }

  it('ad/soyad güncellenir + employee.updated GÜNCEL adSoyad ve mevcut durum ile yayınlanır', async () => {
    const updated = await run({ ad: 'Ayşe', soyad: 'Kaya' });
    expect(updated.soyad).toBe('Kaya');
    expect(publishEmployeeUpdated).toHaveBeenCalledWith({ employeeId: 'personel-1', adSoyad: 'Ayşe Kaya', durum: 'active' });
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'UPDATE', entityType: 'personnel_employees' }));
  });

  it("maasTl değişse bile event payload'ına ASLA girmez (KIRILMAZ KURAL)", async () => {
    await run({ maasTl: 75000 });
    const publishedEvent = publishEmployeeUpdated.mock.calls[0][0];
    expect(publishedEvent).not.toHaveProperty('maasTl');
    expect(publishedEvent).not.toHaveProperty('maas_tl');
    expect(repo.rows[0].maas_tl).toBe(75000);
  });

  it('sadece email değişse dahi employee.updated yine de yayınlanır (adSoyad değişmese de)', async () => {
    await run({ email: 'ayse.yilmaz@acme.test' });
    expect(publishEmployeeUpdated).toHaveBeenCalledWith({ employeeId: 'personel-1', adSoyad: 'Ayşe Yılmaz', durum: 'active' });
  });

  it('personel bulunamazsa NotFoundError fırlatır, hiçbir event yayınlanmaz', async () => {
    await expect(run({ ad: 'X' }, 'yok-boyle-bir-id')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(publishEmployeeUpdated).not.toHaveBeenCalled();
    expect(publishAudit).not.toHaveBeenCalled();
  });

  it('boş body ValidationError fırlatır', async () => {
    await expect(run({})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('maasTl 0 veya negatifse ValidationError fırlatır', async () => {
    await expect(run({ maasTl: 0 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
