import { describe, it, expect, beforeEach, vi } from 'vitest';
import { allocateTeamWeekly } from '../allocate-team-weekly.usecase';
import type { WeeklyAllocationRepository, WeeklyAllocationRow } from '../../../infrastructure/database/weekly-allocation.repository';
import type { ProjectRepository, ProjectRow } from '../../../infrastructure/database/project.repository';

/**
 * B1 (Day 11): "project testleri (kapasite)". Kural #7 (docs/roadmap.md): "Ekiplere planlanan
 * haftalık süre toplamı, projenin bitiş hafta sayısını aşamaz." Day 6'da yazılan bu use-case'in
 * (`allocate-team-weekly.usecase.ts`) bugüne kadar HİÇ testi yoktu — sadece HTTP katmanı
 * (`weekly-allocation.controller.ts`) dolaylı olarak dokunuyordu, hiçbir controller testi de yok.
 */
class InMemoryWeeklyAllocationRepository implements WeeklyAllocationRepository {
  rows: WeeklyAllocationRow[] = [];
  private nextId = 1;

  async listByProject(projectId: string): Promise<WeeklyAllocationRow[]> {
    return this.rows.filter((r) => r.project_id === projectId);
  }

  async totalForTeam(projectId: string, teamId: string): Promise<number> {
    return this.rows
      .filter((r) => r.project_id === projectId && r.team_id === teamId)
      .reduce((sum, r) => sum + r.planlanan_sure_hafta, 0);
  }

  async upsert(projectId: string, teamId: string, haftaNo: number, planlananSureHafta: number): Promise<WeeklyAllocationRow> {
    const existing = this.rows.find((r) => r.project_id === projectId && r.team_id === teamId && r.hafta_no === haftaNo);
    if (existing) {
      existing.planlanan_sure_hafta = planlananSureHafta;
      return existing;
    }
    const row: WeeklyAllocationRow = { id: `plan-${this.nextId++}`, project_id: projectId, team_id: teamId, hafta_no: haftaNo, planlanan_sure_hafta: planlananSureHafta };
    this.rows.push(row);
    return row;
  }
}

class FakeProjectRepository implements ProjectRepository {
  project: ProjectRow | null = null;

  async findAll(): Promise<ProjectRow[]> {
    return this.project ? [this.project] : [];
  }
  async findById(id: string): Promise<ProjectRow | null> {
    return this.project && this.project.id === id ? this.project : null;
  }
  async create(): Promise<ProjectRow> {
    throw new Error('kullanılmadı');
  }
  async update(): Promise<ProjectRow> {
    throw new Error('kullanılmadı');
  }
}

const PROJECT_ID = 'proje-1';
const TEAM_A = 'ekip-a';
const TEAM_B = 'ekip-b';
const ACTOR = 'aktor-1';

function projectWithDuration(sureHafta: number): ProjectRow {
  return {
    id: PROJECT_ID,
    proje_adi: 'Test Projesi',
    baslangic_tarihi: '2026-09-01',
    bitis_tarihi: '2026-12-01',
    sure_hafta: sureHafta,
    product_group_id: 'grup-1',
    product_id: 'urun-1',
    durum: 'devam_ediyor',
    ekip_lideri_id: 'lider-1',
    tahmini_maliyet_tl: null,
    satis_fiyati_tl: null,
    danismanlik_maliyeti_tl: 0,
    paketleme_gonderim_maliyeti_tl: 0,
    idari_maliyet_orani: 0,
    created_by: ACTOR,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('allocateTeamWeekly (B1, Day 11 — kapasite testleri)', () => {
  let allocationRepo: InMemoryWeeklyAllocationRepository;
  let projectRepo: FakeProjectRepository;
  let publishAudit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    allocationRepo = new InMemoryWeeklyAllocationRepository();
    projectRepo = new FakeProjectRepository();
    publishAudit = vi.fn().mockResolvedValue(undefined);
  });

  it('proje bulunamazsa NotFoundError fırlatır', async () => {
    await expect(allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 2, ACTOR, allocationRepo, projectRepo, publishAudit)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('toplam, projenin bitiş hafta sayısını AŞMIYORSA planlama kabul edilir', async () => {
    projectRepo.project = projectWithDuration(10);
    const result = await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 5, ACTOR, allocationRepo, projectRepo, publishAudit);
    expect(result.planlanan_sure_hafta).toBe(5);
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'UPDATE', severity: 'info' }));
  });

  it('toplam, projenin bitiş hafta sayısını AŞIYORSA WeeklyCapacityExceededError fırlatır', async () => {
    projectRepo.project = projectWithDuration(10);
    await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 6, ACTOR, allocationRepo, projectRepo, publishAudit);
    await expect(allocateTeamWeekly(PROJECT_ID, TEAM_A, 2, 5, ACTOR, allocationRepo, projectRepo, publishAudit)).rejects.toMatchObject({ code: 'WEEKLY_CAPACITY_EXCEEDED' });
  });

  it('AYNI haftaya yeniden yazıldığında eski değer ÇİFT SAYILMAZ (upsert varsayımı)', async () => {
    projectRepo.project = projectWithDuration(10);
    await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 8, ACTOR, allocationRepo, projectRepo, publishAudit);
    // Aynı haftayı (1. hafta) 3'e güncelle — toplam 8 DEĞİL, 3 olmalı; bu yüzden 10'u aşmaz.
    const result = await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 3, ACTOR, allocationRepo, projectRepo, publishAudit);
    expect(result.planlanan_sure_hafta).toBe(3);
    const total = await allocationRepo.totalForTeam(PROJECT_ID, TEAM_A);
    expect(total).toBe(3);
  });

  it('FARKLI ekiplerin planlaması birbirinin kapasitesini ETKİLEMEZ', async () => {
    projectRepo.project = projectWithDuration(10);
    await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 9, ACTOR, allocationRepo, projectRepo, publishAudit);
    // B ekibi için AYRI bir kapasite havuzu — A'nın 9 haftası B'yi etkilemez.
    const result = await allocateTeamWeekly(PROJECT_ID, TEAM_B, 1, 9, ACTOR, allocationRepo, projectRepo, publishAudit);
    expect(result.planlanan_sure_hafta).toBe(9);
  });

  it('tam sınırda (toplam == sure_hafta) planlama KABUL edilir (aşma değil eşitlik)', async () => {
    projectRepo.project = projectWithDuration(10);
    const result = await allocateTeamWeekly(PROJECT_ID, TEAM_A, 1, 10, ACTOR, allocationRepo, projectRepo, publishAudit);
    expect(result.planlanan_sure_hafta).toBe(10);
  });
});
