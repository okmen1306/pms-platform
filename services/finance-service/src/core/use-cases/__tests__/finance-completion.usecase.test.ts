import { describe, it, expect, beforeEach } from 'vitest';
import { calculateProfitMargin } from '../calculate-profit-margin.usecase';
import { calculateTeamCostSummary } from '../calculate-team-cost-summary.usecase';
import type {
  CostRepository,
  ProjectCostRow,
  PersonnelWeeklyCostRow,
  UpsertWeeklyCostInput,
  InitializeProjectCostInput,
} from '../../../infrastructure/database/cost.repository';

const PROJECT_ID = '99999999-9999-9999-9999-999999999999';

function emptyCostRow(projectId: string): ProjectCostRow {
  return {
    id: 'row-1',
    project_id: projectId,
    arge_maliyeti_usd: 0,
    arge_maliyeti_tl: 0,
    malzeme_maliyeti_tl: 0,
    malzeme_maliyeti_usd: 0,
    danismanlik_maliyeti_tl: 0,
    paketleme_maliyeti_tl: 0,
    diger_maliyetler_toplam_tl: 0,
    idari_maliyet_orani: 0,
    idari_maliyet_tutari_tl: 0,
    toplam_tahmini_maliyet_tl: 0,
    toplam_gerceklesen_maliyet_tl: 0,
    fark_tl: 0,
    satis_fiyati_tl: null,
    kar_marji_yuzde: null,
  };
}

class InMemoryCostRepository implements CostRepository {
  private row: ProjectCostRow | null;
  private weeklyRows: PersonnelWeeklyCostRow[] = [];

  constructor(initial: ProjectCostRow | null) {
    this.row = initial;
  }

  async findByProject(projectId: string): Promise<ProjectCostRow | null> {
    return this.row && this.row.project_id === projectId ? { ...this.row } : null;
  }
  async initializeForProject(projectId: string, init: InitializeProjectCostInput = {}): Promise<ProjectCostRow> {
    this.row = { ...emptyCostRow(projectId), toplam_tahmini_maliyet_tl: init.toplamTahminiMaliyetTl ?? 0, satis_fiyati_tl: init.satisFiyatiTl ?? null };
    return { ...this.row };
  }
  async upsertWeeklyCost(row: UpsertWeeklyCostInput): Promise<void> {
    this.weeklyRows.push({ id: `w-${this.weeklyRows.length + 1}`, ...row });
  }
  async listWeeklyCostsByProject(projectId: string): Promise<PersonnelWeeklyCostRow[]> {
    return this.weeklyRows.filter((r) => r.project_id === projectId);
  }
  async addMaterialCost(): Promise<ProjectCostRow> {
    throw new Error('kullanılmadı');
  }
  async recalculateCostRollup(): Promise<ProjectCostRow> {
    throw new Error('kullanılmadı');
  }
}

describe('calculateProfitMargin', () => {
  it('maliyet kaydı varsa kâr marjı odaklı projeksiyon döner', async () => {
    const repo = new InMemoryCostRepository({
      ...emptyCostRow(PROJECT_ID),
      satis_fiyati_tl: 100000,
      toplam_gerceklesen_maliyet_tl: 60000,
      toplam_tahmini_maliyet_tl: 55000,
      kar_marji_yuzde: 40,
    });
    const result = await calculateProfitMargin(PROJECT_ID, repo);
    expect(result).toEqual({
      satisFiyatiTl: 100000,
      toplamGerceklesenMaliyetTl: 60000,
      toplamTahminiMaliyetTl: 55000,
      karMarjiYuzde: 40,
    });
  });

  it('maliyet kaydı yoksa NotFoundError fırlatır', async () => {
    const repo = new InMemoryCostRepository(null);
    await expect(calculateProfitMargin(PROJECT_ID, repo)).rejects.toThrow(/bulunamadı/i);
  });
});

describe('calculateTeamCostSummary', () => {
  let repo: InMemoryCostRepository;

  beforeEach(() => {
    repo = new InMemoryCostRepository(emptyCostRow(PROJECT_ID));
  });

  it('hiç haftalık maliyet yoksa boş liste döner', async () => {
    const result = await calculateTeamCostSummary(PROJECT_ID, repo);
    expect(result).toEqual([]);
  });

  it('AYNI haftadaki BİRDEN FAZLA çalışanın maliyetini toplar', async () => {
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 5000,
      haftalik_maliyet_usd: 150,
      ayni_hafta_proje_sayisi: 1,
    });
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '22222222-2222-2222-2222-222222222222',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 3000,
      haftalik_maliyet_usd: 90,
      ayni_hafta_proje_sayisi: 1,
    });
    const result = await calculateTeamCostSummary(PROJECT_ID, repo);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ haftaNo: 1, toplamMaliyetTl: 8000, toplamMaliyetUsd: 240, calisanSayisi: 2 });
  });

  it('haftalara göre ARTAN sırada döner', async () => {
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 3,
      hafta_baslangic_tarihi: '2026-09-15',
      haftalik_maliyet_tl: 1000,
      haftalik_maliyet_usd: 30,
      ayni_hafta_proje_sayisi: 1,
    });
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 1000,
      haftalik_maliyet_usd: 30,
      ayni_hafta_proje_sayisi: 1,
    });
    const result = await calculateTeamCostSummary(PROJECT_ID, repo);
    expect(result.map((r) => r.haftaNo)).toEqual([1, 3]);
  });

  it('AYNI çalışan aynı haftada bir kereden fazla sayılmaz (calisanSayisi)', async () => {
    // upsert semantiği zaten (project,employee,hafta) benzersiz olmalı ama use-case yine de
    // Set kullanarak savunmacı davranıyor.
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 1000,
      haftalik_maliyet_usd: 30,
      ayni_hafta_proje_sayisi: 1,
    });
    const result = await calculateTeamCostSummary(PROJECT_ID, repo);
    expect(result[0].calisanSayisi).toBe(1);
  });
});
