import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateProject } from '../update-project.usecase';
import type { ProjectRepository, ProjectRow, CreateProjectRow } from '../../../infrastructure/database/project.repository';
import type { WeeklyAllocationRepository, WeeklyAllocationRow } from '../../../infrastructure/database/weekly-allocation.repository';
import type { IntegrationServiceClient } from '../../../infrastructure/external/integration-service.client';

const PROJECT_ID = 'proje-1';
const ACTOR = 'aktor-1';

function baseProject(): ProjectRow {
  return {
    id: PROJECT_ID, proje_adi: 'Alfa', baslangic_tarihi: '2026-10-05', bitis_tarihi: '2026-12-25', sure_hafta: 12,
    product_group_id: 'g', product_id: 'p', durum: 'yeni', ekip_lideri_id: 'lider-1', tahmini_maliyet_tl: null,
    satis_fiyati_tl: null, danismanlik_maliyeti_tl: 0, paketleme_gonderim_maliyeti_tl: 0, idari_maliyet_orani: 0,
    created_by: ACTOR, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  };
}

class FakeProjectRepo implements ProjectRepository {
  project: ProjectRow | null = baseProject();
  lastPatch: Partial<CreateProjectRow> | null = null;
  async findAll() { return this.project ? [this.project] : []; }
  async findById(id: string) { return this.project && this.project.id === id ? this.project : null; }
  async create(): Promise<ProjectRow> { throw new Error('kullanılmadı'); }
  async update(_id: string, data: Partial<CreateProjectRow>): Promise<ProjectRow> {
    this.lastPatch = data;
    this.project = { ...this.project!, ...data } as ProjectRow;
    return this.project;
  }
}

class FakeAllocationRepo implements WeeklyAllocationRepository {
  rows: WeeklyAllocationRow[] = [];
  async listByProject() { return this.rows; }
  async totalForTeam() { return 0; }
  async upsert(): Promise<WeeklyAllocationRow> { throw new Error('kullanılmadı'); }
}

describe('updateProject (Day 20 — PATCH /projects/:id)', () => {
  let projectRepo: FakeProjectRepo;
  let allocationRepo: FakeAllocationRepo;
  let integration: IntegrationServiceClient;
  let getBusinessDays: ReturnType<typeof vi.fn>;
  const publishAudit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    projectRepo = new FakeProjectRepo();
    allocationRepo = new FakeAllocationRepo();
    getBusinessDays = vi.fn().mockResolvedValue({ totalBusinessDays: 40 });
    integration = { getBusinessDays } as unknown as IntegrationServiceClient;
    publishAudit.mockClear();
  });

  const run = (input: Parameters<typeof updateProject>[1]) =>
    updateProject(PROJECT_ID, input, ACTOR, projectRepo, allocationRepo, integration, publishAudit);

  it('tarih değişmeyen güncelleme integration-service\'e gitmez, sure_hafta aynı kalır, audit yazılır', async () => {
    const updated = await run({ projeAdi: 'Alfa v2', idariMaliyetOrani: 0.15 });
    expect(getBusinessDays).not.toHaveBeenCalled();
    expect(updated.sure_hafta).toBe(12);
    expect(projectRepo.lastPatch).toEqual({ proje_adi: 'Alfa v2', idari_maliyet_orani: 0.15 });
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'UPDATE', entityId: PROJECT_ID }));
  });

  it('Kural #3: tarih değişince süre iş gününden yeniden hesaplanır (40 iş günü → 8 hafta)', async () => {
    const updated = await run({ bitisTarihi: '2026-11-27' });
    expect(getBusinessDays).toHaveBeenCalledWith('2026-10-05', '2026-11-27');
    expect(updated.sure_hafta).toBe(8);
    expect(projectRepo.lastPatch).toMatchObject({ bitis_tarihi: '2026-11-27', baslangic_tarihi: '2026-10-05', sure_hafta: 8 });
  });

  it('Kural #7: yeni süre bir ekibin mevcut planlama toplamının altına düşüyorsa 409 WEEKLY_CAPACITY_EXCEEDED, kayıt DEĞİŞMEZ', async () => {
    allocationRepo.rows = [
      { id: '1', project_id: PROJECT_ID, team_id: 'ekip-a', hafta_no: 1, planlanan_sure_hafta: 5 },
      { id: '2', project_id: PROJECT_ID, team_id: 'ekip-a', hafta_no: 2, planlanan_sure_hafta: 4 },
    ];
    await expect(run({ bitisTarihi: '2026-11-27' })).rejects.toMatchObject({ code: 'WEEKLY_CAPACITY_EXCEEDED', statusCode: 409 });
    expect(projectRepo.lastPatch).toBeNull();
    expect(publishAudit).not.toHaveBeenCalled();
  });

  it('planlama toplamı yeni süreye SIĞIYORSA (9 ≤ 9) güncelleme geçer; toplam ekip bazında hesaplanır', async () => {
    getBusinessDays.mockResolvedValue({ totalBusinessDays: 45 });
    allocationRepo.rows = [
      { id: '1', project_id: PROJECT_ID, team_id: 'ekip-a', hafta_no: 1, planlanan_sure_hafta: 5 },
      { id: '2', project_id: PROJECT_ID, team_id: 'ekip-a', hafta_no: 2, planlanan_sure_hafta: 4 },
      { id: '3', project_id: PROJECT_ID, team_id: 'ekip-b', hafta_no: 1, planlanan_sure_hafta: 5 },
    ];
    const updated = await run({ bitisTarihi: '2026-12-04' });
    expect(updated.sure_hafta).toBe(9);
  });

  it('bitiş başlangıçtan önceyse 422; yalnızca bitisTarihi gelirse mevcut başlangıçla karşılaştırılır', async () => {
    await expect(run({ bitisTarihi: '2026-09-01' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(run({ baslangicTarihi: '2027-01-01' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('boş gövde 422; olmayan proje 404', async () => {
    await expect(run({})).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    projectRepo.project = null;
    await expect(run({ projeAdi: 'X' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
