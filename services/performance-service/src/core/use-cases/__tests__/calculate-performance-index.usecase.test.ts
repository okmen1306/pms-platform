import { describe, it, expect, beforeEach } from 'vitest';
import { recalculateEmployeeIndex, recalculateTeamIndex } from '../calculate-performance-index.usecase';
import type {
  PerformanceScoreRepository,
  CriterionRow,
  EmployeeScoreInput,
  EmployeeScoreRow,
  TeamLeadScoreInput,
  TeamLeadScoreRow,
  EmployeeIndexRow,
  TeamIndexRow,
} from '../../../infrastructure/database/score.repository';

const PROJECT_ID = 'proje-1';
const EMPLOYEE_ID = 'personel-1';
const LEAD_ID = 'lider-1';
const CRIT_KALITE = 'kalite';
const CRIT_ZAMAN = 'zamanlama';

/** performance.controller.test.ts'teki bellek içi sahte repo ile AYNI kalıp, sadeleştirilmiş. */
class FakeRepo implements PerformanceScoreRepository {
  scores: EmployeeScoreRow[] = [];
  teamLeadScores: TeamLeadScoreRow[] = [];
  employeeIndices: EmployeeIndexRow[] = [];
  teamIndices: TeamIndexRow[] = [];
  criteria: CriterionRow[] = [
    { id: CRIT_KALITE, ad: 'Kalite', agirlik_yuzdesi: 60, aktif: true },
    { id: CRIT_ZAMAN, ad: 'Zamanlama', agirlik_yuzdesi: 40, aktif: true },
  ];

  async listCriteria(): Promise<CriterionRow[]> {
    return this.criteria;
  }
  async createCriterion(): Promise<CriterionRow> {
    throw new Error('kullanılmadı');
  }
  async totalActiveWeight(): Promise<number> {
    return this.criteria.reduce((s, c) => s + c.agirlik_yuzdesi, 0);
  }
  async submitEmployeeScore(data: EmployeeScoreInput): Promise<EmployeeScoreRow> {
    const row: EmployeeScoreRow = { id: `s-${this.scores.length + 1}`, verilme_tarihi: new Date().toISOString(), ...data };
    this.scores.push(row);
    return row;
  }
  async listScoresByEmployee(projectId: string, employeeId: string): Promise<EmployeeScoreRow[]> {
    return this.scores.filter((s) => s.project_id === projectId && s.employee_id === employeeId);
  }
  async submitTeamLeadScore(data: TeamLeadScoreInput): Promise<TeamLeadScoreRow> {
    const row: TeamLeadScoreRow = { id: `tl-${this.teamLeadScores.length + 1}`, updated_by: null, updated_at: null, created_at: new Date().toISOString(), ...data };
    this.teamLeadScores.push(row);
    return row;
  }
  async overrideTeamLeadScore(): Promise<TeamLeadScoreRow | null> {
    throw new Error('kullanılmadı');
  }
  async findTeamLeadScoreById(): Promise<TeamLeadScoreRow | null> {
    throw new Error('kullanılmadı');
  }
  async listTeamLeadScores(projectId: string, ekipLideriId: string): Promise<TeamLeadScoreRow[]> {
    return this.teamLeadScores.filter((s) => s.project_id === projectId && s.ekip_lideri_id === ekipLideriId);
  }
  async upsertEmployeeIndex(projectId: string, employeeId: string, endeksPuani: number): Promise<EmployeeIndexRow> {
    const row: EmployeeIndexRow = { project_id: projectId, employee_id: employeeId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() };
    this.employeeIndices = this.employeeIndices.filter((r) => !(r.project_id === projectId && r.employee_id === employeeId));
    this.employeeIndices.push(row);
    return row;
  }
  async upsertTeamIndex(projectId: string, teamId: string, endeksPuani: number): Promise<TeamIndexRow> {
    const row: TeamIndexRow = { project_id: projectId, team_id: teamId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() };
    this.teamIndices = this.teamIndices.filter((r) => !(r.project_id === projectId && r.team_id === teamId));
    this.teamIndices.push(row);
    return row;
  }
  async listEmployeeIndicesByProject(projectId: string): Promise<EmployeeIndexRow[]> {
    return this.employeeIndices.filter((r) => r.project_id === projectId);
  }
  async listTeamIndicesByProject(projectId: string): Promise<TeamIndexRow[]> {
    return this.teamIndices.filter((r) => r.project_id === projectId);
  }
  async listEmployeeIndicesByEmployee(employeeId: string): Promise<EmployeeIndexRow[]> {
    return this.employeeIndices.filter((r) => r.employee_id === employeeId);
  }
}

describe('recalculateEmployeeIndex (TL, Day 12 — Σ(puan × ağırlık/100))', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = new FakeRepo();
  });

  it('tek kriter puanlanmışsa, endeks o kriterin ağırlıklı puanına eşittir', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 90, veren_id: LEAD_ID });
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(54); // 90 * 60/100
  });

  it('iki kriter de puanlanmışsa, ağırlıklı toplamı döner', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 90, veren_id: LEAD_ID });
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_ZAMAN, puan: 70, veren_id: LEAD_ID });
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(82); // 90*0.6 + 70*0.4 = 54 + 28 = 82
  });

  it('hiç puan yoksa endeks 0 olur', async () => {
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(0);
  });

  it('her iki kriterde de tam puan (100) alınırsa endeks 100 olur (ağırlıklar 100 topluyorsa)', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 100, veren_id: LEAD_ID });
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_ZAMAN, puan: 100, veren_id: LEAD_ID });
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(100);
  });

  it('puan yeniden gönderilirse (upsert) endeks ÇİFT SAYILMAZ, yeniden hesaplanır', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 50, veren_id: LEAD_ID });
    await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    // Aynı kriter için puan güncellensin (gerçek submitEmployeeScore upsert yapar, burada
    // basitçe listeyi güncelleyerek simüle ediyoruz).
    repo.scores[0].puan = 80;
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(48); // 80 * 0.6, 50'nin kalıntısı YOK
  });

  it('BAŞKA bir projenin puanları karışmaz', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 100, veren_id: LEAD_ID });
    await repo.submitEmployeeScore({ project_id: 'baska-proje', employee_id: EMPLOYEE_ID, criterion_id: CRIT_KALITE, puan: 0, veren_id: LEAD_ID });
    const index = await recalculateEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, repo);
    expect(index).toBe(60);
  });
});

describe('recalculateTeamIndex (TL, Day 12 — team_id = ekip_lideri_id, Uzman İnisiyatifi)', () => {
  let repo: FakeRepo;

  beforeEach(() => {
    repo = new FakeRepo();
  });

  it('ekip liderinin aldığı puanlardan takım endeksini hesaplar', async () => {
    await repo.submitTeamLeadScore({ project_id: PROJECT_ID, ekip_lideri_id: LEAD_ID, criterion_id: CRIT_KALITE, puan: 80, veren_yonetici_id: 'yonetici-1' });
    const index = await recalculateTeamIndex(PROJECT_ID, LEAD_ID, repo);
    expect(index).toBe(48); // 80 * 0.6
    expect((await repo.listTeamIndicesByProject(PROJECT_ID))[0].team_id).toBe(LEAD_ID);
  });
});
