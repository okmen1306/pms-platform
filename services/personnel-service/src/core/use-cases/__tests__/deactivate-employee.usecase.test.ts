import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { AuditPublisherFn } from '@pms/shared';
import { deactivateEmployee } from '../deactivate-employee.usecase';
import type { EmployeeUpdatedPublisherFn } from '../update-employee.usecase';
import { InMemoryEmployeeRepository } from './in-memory-employee.repository';

/**
 * Day 15: deactivate ÖNCEDEN sadece audit.event yayınlıyordu — cache'lenmiş `durum` hiçbir zaman
 * güncellenmiyordu (bkz. update-employee.usecase.ts başlık notu — "sonsuza kadar active görünür
 * kalırdı"). Bu testler `employee.updated (durum: 'inactive')`'ın artık HER ZAMAN yayınlandığını
 * doğruluyor.
 */
describe('deactivateEmployee (Day 15 — cache durum senkronizasyonu)', () => {
  let repo: InMemoryEmployeeRepository;
  let publishAudit: Mock<AuditPublisherFn>;
  let publishEmployeeUpdated: Mock<EmployeeUpdatedPublisherFn>;

  beforeEach(async () => {
    repo = new InMemoryEmployeeRepository();
    publishAudit = vi.fn<AuditPublisherFn>().mockResolvedValue(undefined);
    publishEmployeeUpdated = vi.fn<EmployeeUpdatedPublisherFn>().mockResolvedValue(undefined);
    await repo.create({ ad: 'Zeynep', soyad: 'Aydın', email: 'zeynep@acme.test', ise_baslama_tarihi: '2026-01-01', maas_tl: 55000, olusturan_id: 'aktor-1' });
  });

  it('pasife alınır + employee.updated {durum:"inactive"} yayınlanır (cache bayatlamasın diye)', async () => {
    await deactivateEmployee('personel-1', 'aktor-1', repo, publishAudit, publishEmployeeUpdated, async () => false);
    expect(repo.rows[0].durum).toBe('inactive');
    expect(publishEmployeeUpdated).toHaveBeenCalledWith({ employeeId: 'personel-1', adSoyad: 'Zeynep Aydın', durum: 'inactive' });
  });

  it('personel bulunamazsa NotFoundError fırlatır, hiçbir event yayınlanmaz', async () => {
    await expect(deactivateEmployee('yok-boyle-bir-id', 'aktor-1', repo, publishAudit, publishEmployeeUpdated, async () => false)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(publishEmployeeUpdated).not.toHaveBeenCalled();
  });

  // Day 20 (G-15): atama kontrolü artık gerçek (project-service REST) — yalnızca audit önem derecesini belirler.
  it('atanmış personel yine pasife alınır (Kural #9 sadece SİLMEYİ yasaklar) ama audit severity "warning"', async () => {
    await deactivateEmployee('personel-1', 'aktor-1', repo, publishAudit, publishEmployeeUpdated, async () => true);
    expect(repo.rows[0].durum).toBe('inactive');
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }));
  });

  it('atanmamış personelde audit severity "info"', async () => {
    await deactivateEmployee('personel-1', 'aktor-1', repo, publishAudit, publishEmployeeUpdated, async () => false);
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }));
  });

  it('project-service ULAŞILAMAZSA pasife alma engellenmez; muhafazakâr olarak severity "warning"', async () => {
    const down = async () => { throw new Error('ECONNREFUSED'); };
    await deactivateEmployee('personel-1', 'aktor-1', repo, publishAudit, publishEmployeeUpdated, down);
    expect(repo.rows[0].durum).toBe('inactive');
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }));
    expect(publishEmployeeUpdated).toHaveBeenCalled();
  });
});
