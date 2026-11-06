import { describe, it, expect, beforeEach } from 'vitest';
import type { CostRepository, ProjectCostRow, PersonnelWeeklyCostRow, UpsertWeeklyCostInput, InitializeProjectCostInput } from '../cost.repository';

const PROJECT_ID = '99999999-9999-9999-9999-999999999999';

/**
 * `SupabaseCostRepository.recalculateCostRollup`'ın (bkz. cost.repository.ts) formülünü
 * BİREBİR taklit eden bellek içi sahte repo. Gerçek Supabase istemcisini mock'lamak yerine
 * (zincirlenmiş `.from().select().eq()...` çağrıları test edilebilirliği zorlaştırır) sözleşme
 * (interface) seviyesinde test — record-material-cost.usecase.test.ts'teki ile AYNI desen.
 */
class InMemoryCostRepository implements CostRepository {
  private row: ProjectCostRow;
  private weeklyRows: PersonnelWeeklyCostRow[] = [];

  constructor(projectId: string) {
    this.row = {
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

  async findByProject(projectId: string): Promise<ProjectCostRow | null> {
    return this.row.project_id === projectId ? { ...this.row } : null;
  }
  async initializeForProject(projectId: string, init: InitializeProjectCostInput = {}): Promise<ProjectCostRow> {
    this.row = {
      ...this.row,
      project_id: projectId,
      toplam_tahmini_maliyet_tl: init.toplamTahminiMaliyetTl ?? 0,
      satis_fiyati_tl: init.satisFiyatiTl ?? null,
      danismanlik_maliyeti_tl: init.danismanlikMaliyetiTl ?? 0,
      paketleme_maliyeti_tl: init.paketlemeMaliyetiTl ?? 0,
      idari_maliyet_orani: init.idariMaliyetOrani ?? 0,
    };
    return { ...this.row };
  }
  async upsertWeeklyCost(row: UpsertWeeklyCostInput): Promise<void> {
    this.weeklyRows.push({ id: `w-${this.weeklyRows.length + 1}`, ...row });
  }
  async listWeeklyCostsByProject(projectId: string): Promise<PersonnelWeeklyCostRow[]> {
    return this.weeklyRows.filter((r) => r.project_id === projectId);
  }
  async addMaterialCost(projectId: string, deltaTl: number, deltaUsd: number): Promise<ProjectCostRow> {
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

describe('CostRepository — idari maliyet + kâr marjı (B2, Day 9)', () => {
  let repo: InMemoryCostRepository;

  beforeEach(() => {
    repo = new InMemoryCostRepository(PROJECT_ID);
  });

  it('idari_maliyet_orani sıfırsa idari_maliyet_tutari_tl de sıfır olur', async () => {
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 10000 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    expect(result.idari_maliyet_tutari_tl).toBe(0);
    expect(result.toplam_gerceklesen_maliyet_tl).toBe(10000);
  });

  it('idari_maliyet_orani, TÜM doğrudan maliyet bileşenlerinin toplamına uygulanır', async () => {
    await repo.initializeForProject(PROJECT_ID, {
      danismanlikMaliyetiTl: 10000,
      paketlemeMaliyetiTl: 5000,
      idariMaliyetOrani: 0.1, // %10
    });
    await repo.addMaterialCost(PROJECT_ID, 5000, 0);
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    // doğrudan: 10000 + 5000 + 5000 = 20000; idari: 20000 * 0.1 = 2000; toplam: 22000
    expect(result.idari_maliyet_tutari_tl).toBe(2000);
    expect(result.toplam_gerceklesen_maliyet_tl).toBe(22000);
  });

  it('idari maliyet, KENDİSİ üzerinden tekrar hesaplanmaz (dairesel değil)', async () => {
    // Eğer yanlışlıkla dairesel olsaydı idari tutar kendi üzerine de %10 eklerdi (2200 gibi).
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 20000, idariMaliyetOrani: 0.1 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    expect(result.idari_maliyet_tutari_tl).toBe(2000);
  });

  it('satış fiyatı YOKSA kâr marjı null kalır', async () => {
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 10000 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    expect(result.kar_marji_yuzde).toBeNull();
  });

  it('kâr marjı = (satış fiyatı - gerçekleşen maliyet) / satış fiyatı × 100', async () => {
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 60000, satisFiyatiTl: 100000 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    // (100000 - 60000) / 100000 * 100 = %40
    expect(result.kar_marji_yuzde).toBe(40);
  });

  it('gerçekleşen maliyet satış fiyatını AŞARSA kâr marjı NEGATİF olur (zarar)', async () => {
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 120000, satisFiyatiTl: 100000 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    expect(result.kar_marji_yuzde).toBe(-20);
  });

  it('kâr marjı iki ondalık haneye yuvarlanır', async () => {
    await repo.initializeForProject(PROJECT_ID, { danismanlikMaliyetiTl: 33333, satisFiyatiTl: 100000 });
    const result = await repo.recalculateCostRollup(PROJECT_ID);
    expect(result.kar_marji_yuzde).toBe(66.67);
  });

  it('AR-GE (haftalık) + malzeme + idari maliyet birlikte doğru toplanır (uçtan uca)', async () => {
    await repo.initializeForProject(PROJECT_ID, {
      danismanlikMaliyetiTl: 10000,
      paketlemeMaliyetiTl: 2000,
      idariMaliyetOrani: 0.05,
      satisFiyatiTl: 50000,
    });
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 6000,
      haftalik_maliyet_usd: 180,
      ayni_hafta_proje_sayisi: 1,
    });
    const result = await repo.addMaterialCost(PROJECT_ID, 3000, 90);
    // doğrudan: 6000(arge) + 3000(malzeme) + 10000(danışmanlık) + 2000(paketleme) = 21000
    // idari: 21000 * 0.05 = 1050; toplam: 22050
    expect(result.toplam_gerceklesen_maliyet_tl).toBe(22050);
    expect(result.idari_maliyet_tutari_tl).toBe(1050);
    // kâr marjı: (50000 - 22050) / 50000 * 100 = %55.9
    expect(result.kar_marji_yuzde).toBe(55.9);
  });
});
