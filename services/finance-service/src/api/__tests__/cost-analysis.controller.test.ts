import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerCostAnalysisRoutes } from '../cost-analysis.controller';
import type {
  CostRepository,
  ProjectCostRow,
  PersonnelWeeklyCostRow,
  UpsertWeeklyCostInput,
  InitializeProjectCostInput,
} from '../../infrastructure/database/cost.repository';

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
  public row: ProjectCostRow | null = null;
  public weeklyRows: PersonnelWeeklyCostRow[] = [];

  async findByProject(projectId: string): Promise<ProjectCostRow | null> {
    return this.row && this.row.project_id === projectId ? { ...this.row } : null;
  }
  async initializeForProject(projectId: string, init: InitializeProjectCostInput = {}): Promise<ProjectCostRow> {
    this.row = { ...emptyCostRow(projectId), satis_fiyati_tl: init.satisFiyatiTl ?? null };
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

describe('finance-service cost-analysis controller (B2, Day 10)', () => {
  let app: FastifyInstance;
  let repo: InMemoryCostRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryCostRepository();
    registerCostAnalysisRoutes(app, { costRepo: repo });
    await app.ready();
  });

  it('GET /finance/projects/:id/costs — kayıt varsa 200 döner', async () => {
    await repo.initializeForProject(PROJECT_ID, { satisFiyatiTl: 100000 });
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/costs` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.satis_fiyati_tl).toBe(100000);
  });

  it('GET /finance/projects/:id/costs — kayıt yoksa 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/costs` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /finance/projects/:id/personnel-weekly-cost — haftalık kayıtları listeler', async () => {
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 5000,
      haftalik_maliyet_usd: 150,
      ayni_hafta_proje_sayisi: 1,
    });
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/personnel-weekly-cost` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(1);
  });

  it('GET /finance/projects/:id/team-cost-summary — 200 (B2, Day 10 — YENİ)', async () => {
    await repo.upsertWeeklyCost({
      project_id: PROJECT_ID,
      employee_id: '11111111-1111-1111-1111-111111111111',
      hafta_no: 1,
      hafta_baslangic_tarihi: '2026-09-01',
      haftalik_maliyet_tl: 5000,
      haftalik_maliyet_usd: 150,
      ayni_hafta_proje_sayisi: 1,
    });
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/team-cost-summary` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data[0]).toMatchObject({ haftaNo: 1, toplamMaliyetTl: 5000, calisanSayisi: 1 });
  });

  it('GET /finance/projects/:id/profit-margin — 200 (B2, Day 10 — YENİ)', async () => {
    await repo.initializeForProject(PROJECT_ID, { satisFiyatiTl: 100000 });
    repo.row = { ...repo.row!, toplam_gerceklesen_maliyet_tl: 60000, kar_marji_yuzde: 40 };
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/profit-margin` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toMatchObject({ satisFiyatiTl: 100000, karMarjiYuzde: 40 });
  });

  it('GET /finance/projects/:id/profit-margin — kayıt yoksa 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/finance/projects/${PROJECT_ID}/profit-margin` });
    expect(res.statusCode).toBe(404);
  });

  it('geçersiz proje id formatı 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/finance/projects/gecersiz-id/costs` });
    expect(res.statusCode).toBe(422);
  });
});
