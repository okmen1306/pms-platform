import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyBaseLogger } from 'fastify';
import { recordMaterialCost } from '../record-material-cost.usecase';
import type { CostRepository, ProjectCostRow, PersonnelWeeklyCostRow, UpsertWeeklyCostInput } from '../../../infrastructure/database/cost.repository';

const PROJECT_ID = '55555555-5555-5555-5555-555555555555';

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

/**
 * `SupabaseCostRepository`'nin (bkz. cost.repository.ts) "oku-hesapla-yaz" davranışını
 * BİREBİR taklit eden bellek içi sahte repo — addMaterialCost'un recalculateCostRollup'ı
 * gerçekten tetiklediğini (ve arge maliyetiyle DOĞRU toplandığını) doğrulayabilmek için.
 */
class InMemoryCostRepository implements CostRepository {
  private row: ProjectCostRow;
  private weeklyRows: PersonnelWeeklyCostRow[] = [];

  constructor(initial: ProjectCostRow) {
    this.row = initial;
  }

  async findByProject(projectId: string): Promise<ProjectCostRow | null> {
    return this.row.project_id === projectId ? { ...this.row } : null;
  }
  async initializeForProject(projectId: string): Promise<ProjectCostRow> {
    this.row = emptyCostRow(projectId);
    return { ...this.row };
  }
  async upsertWeeklyCost(row: UpsertWeeklyCostInput): Promise<void> {
    this.weeklyRows.push({ id: `w-${this.weeklyRows.length + 1}`, ...row });
  }
  async listWeeklyCostsByProject(projectId: string): Promise<PersonnelWeeklyCostRow[]> {
    return this.weeklyRows.filter((r) => r.project_id === projectId);
  }
  async addMaterialCost(projectId: string, deltaTl: number, deltaUsd: number): Promise<ProjectCostRow> {
    const current = await this.findByProject(projectId);
    if (!current) throw new Error(`finance_project_costs bulunamadı: ${projectId}`);
    this.row = {
      ...this.row,
      malzeme_maliyeti_tl: Number(this.row.malzeme_maliyeti_tl) + deltaTl,
      malzeme_maliyeti_usd: Number(this.row.malzeme_maliyeti_usd) + deltaUsd,
    };
    return this.recalculateCostRollup(projectId);
  }
  async recalculateCostRollup(projectId: string): Promise<ProjectCostRow> {
    const weeklyRows = await this.listWeeklyCostsByProject(projectId);
    const argeMaliyetiTl = weeklyRows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_tl), 0);
    const argeMaliyetiUsd = weeklyRows.reduce((sum, r) => sum + Number(r.haftalik_maliyet_usd), 0);
    const dogrudanMaliyetlerTl =
      argeMaliyetiTl +
      Number(this.row.malzeme_maliyeti_tl) +
      Number(this.row.danismanlik_maliyeti_tl) +
      Number(this.row.paketleme_maliyeti_tl) +
      Number(this.row.diger_maliyetler_toplam_tl);
    const idariMaliyetTutariTl = dogrudanMaliyetlerTl * Number(this.row.idari_maliyet_orani);
    const toplamGerceklesen = dogrudanMaliyetlerTl + idariMaliyetTutariTl;
    const satisFiyatiTl = this.row.satis_fiyati_tl !== null ? Number(this.row.satis_fiyati_tl) : null;
    const karMarjiYuzde =
      satisFiyatiTl !== null && satisFiyatiTl > 0
        ? Math.round(((satisFiyatiTl - toplamGerceklesen) / satisFiyatiTl) * 100 * 100) / 100
        : null;
    this.row = {
      ...this.row,
      arge_maliyeti_tl: argeMaliyetiTl,
      arge_maliyeti_usd: argeMaliyetiUsd,
      idari_maliyet_tutari_tl: idariMaliyetTutariTl,
      toplam_gerceklesen_maliyet_tl: toplamGerceklesen,
      kar_marji_yuzde: karMarjiYuzde,
    };
    return { ...this.row };
  }
}

const fakeLogger = { info: () => {} } as unknown as FastifyBaseLogger;

describe('recordMaterialCost', () => {
  let repo: InMemoryCostRepository;

  beforeEach(() => {
    repo = new InMemoryCostRepository(emptyCostRow(PROJECT_ID));
  });

  it('malzeme maliyetini sıfırdan ekler', async () => {
    const updated = await recordMaterialCost(
      { materialId: '66666666-6666-6666-6666-666666666666', projectId: PROJECT_ID, totalTl: 15000, totalUsd: 450, purchaseDate: '2026-09-01' },
      repo,
      fakeLogger,
    );
    expect(updated.malzeme_maliyeti_tl).toBe(15000);
    expect(updated.malzeme_maliyeti_usd).toBe(450);
    expect(updated.toplam_gerceklesen_maliyet_tl).toBe(15000);
  });

  it('İKİNCİ bir satın alma EZMEZ, ÜSTÜNE EKLER (biriktirme)', async () => {
    await recordMaterialCost(
      { materialId: '66666666-6666-6666-6666-666666666666', projectId: PROJECT_ID, totalTl: 15000, totalUsd: 450, purchaseDate: '2026-09-01' },
      repo,
      fakeLogger,
    );
    const updated = await recordMaterialCost(
      { materialId: '77777777-7777-7777-7777-777777777777', projectId: PROJECT_ID, totalTl: 5000, totalUsd: 150, purchaseDate: '2026-09-05' },
      repo,
      fakeLogger,
    );
    expect(updated.malzeme_maliyeti_tl).toBe(20000);
    expect(updated.malzeme_maliyeti_usd).toBe(600);
  });

  it('toplam_gerceklesen_maliyet_tl, malzeme + AR-GE toplamını doğru yansıtır', async () => {
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '88888888-8888-8888-8888-888888888888',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 8000,
      haftalik_maliyet_usd: 240,
      ayni_hafta_proje_sayisi: 1,
    });
    const updated = await recordMaterialCost(
      { materialId: '66666666-6666-6666-6666-666666666666', projectId: PROJECT_ID, totalTl: 15000, totalUsd: 450, purchaseDate: '2026-09-01' },
      repo,
      fakeLogger,
    );
    expect(updated.arge_maliyeti_tl).toBe(8000);
    expect(updated.malzeme_maliyeti_tl).toBe(15000);
    expect(updated.toplam_gerceklesen_maliyet_tl).toBe(23000);
  });

  it('proje finance_project_costs\'ta yoksa hata fırlatır (mesaj DLX\'e düşer, sessizce kaybolmaz)', async () => {
    const emptyRepo = new InMemoryCostRepository(emptyCostRow('baska-proje-id'));
    await expect(
      recordMaterialCost(
        { materialId: '66666666-6666-6666-6666-666666666666', projectId: PROJECT_ID, totalTl: 1000, totalUsd: 30, purchaseDate: '2026-09-01' },
        emptyRepo,
        fakeLogger,
      ),
    ).rejects.toThrow();
  });
});
