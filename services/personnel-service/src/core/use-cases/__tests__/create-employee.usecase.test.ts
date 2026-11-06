import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { AuditPublisherFn } from '@pms/shared';
import { createEmployee } from '../create-employee.usecase';
import type { EmployeeUpdatedPublisherFn } from '../update-employee.usecase';
import { InMemoryEmployeeRepository } from './in-memory-employee.repository';

/** Day 15: `employee.created` Day 14'ün denetimine kadar HİÇ yayınlanmıyordu — bkz. CHANGELOG.md. */
describe('createEmployee (Day 15 — employee.created eklendi)', () => {
  let repo: InMemoryEmployeeRepository;
  let publishAudit: Mock<AuditPublisherFn>;
  let publishEmployeeCreated: Mock<EmployeeUpdatedPublisherFn>;

  beforeEach(() => {
    repo = new InMemoryEmployeeRepository();
    publishAudit = vi.fn<AuditPublisherFn>().mockResolvedValue(undefined);
    publishEmployeeCreated = vi.fn<EmployeeUpdatedPublisherFn>().mockResolvedValue(undefined);
  });

  it('personel oluşturulur + employee.created {employeeId, adSoyad, durum:"active"} ile yayınlanır', async () => {
    const created = await createEmployee(
      { ad: 'Mehmet', soyad: 'Demir', email: 'mehmet@acme.test', iseBaslamaTarihi: '2026-02-01', maasTl: 60000 },
      'aktor-1',
      repo,
      publishAudit,
      publishEmployeeCreated,
    );
    expect(publishEmployeeCreated).toHaveBeenCalledWith({ employeeId: created.id, adSoyad: 'Mehmet Demir', durum: 'active' });
  });

  it("event payload'ında maasTl/maas_tl KESİNLİKLE yok", async () => {
    await createEmployee(
      { ad: 'Mehmet', soyad: 'Demir', email: 'mehmet@acme.test', iseBaslamaTarihi: '2026-02-01', maasTl: 60000 },
      'aktor-1',
      repo,
      publishAudit,
      publishEmployeeCreated,
    );
    const publishedEvent = publishEmployeeCreated.mock.calls[0][0];
    expect(publishedEvent).not.toHaveProperty('maasTl');
    expect(publishedEvent).not.toHaveProperty('maas_tl');
  });

  it('maasTl 0 veya negatifse ValidationError fırlatır, hiçbir event yayınlanmaz', async () => {
    await expect(
      createEmployee({ ad: 'X', soyad: 'Y', email: 'x@test.com', iseBaslamaTarihi: '2026-01-01', maasTl: 0 }, 'aktor-1', repo, publishAudit, publishEmployeeCreated),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(publishEmployeeCreated).not.toHaveBeenCalled();
  });
});
