import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerPerformanceRoutes } from '../performance.controller';
import type {
  PerformanceScoreRepository,
  CriterionRow,
  EmployeeScoreInput,
  EmployeeScoreRow,
  TeamLeadScoreInput,
  TeamLeadScoreRow,
  EmployeeIndexRow,
  TeamIndexRow,
} from '../../infrastructure/database/score.repository';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const EMPLOYEE_ID = '22222222-2222-2222-2222-222222222222';
const CRITERION_ID = '33333333-3333-3333-3333-333333333333';
const LEAD_ID = '44444444-4444-4444-4444-444444444444';

class InMemoryPerformanceScoreRepository implements PerformanceScoreRepository {
  public scores: EmployeeScoreRow[] = [];
  public teamLeadScores: TeamLeadScoreRow[] = [];
  public employeeIndices: EmployeeIndexRow[] = [];
  public teamIndices: TeamIndexRow[] = [];

  async listCriteria(): Promise<CriterionRow[]> {
    return [{ id: CRITERION_ID, ad: 'Zamanında Teslim', agirlik_yuzdesi: 100, aktif: true }];
  }
  async createCriterion(data: { ad: string; agirlik_yuzdesi: number }): Promise<CriterionRow> {
    return { id: 'yeni', aktif: true, ...data };
  }
  async totalActiveWeight(): Promise<number> {
    return 100;
  }
  async submitEmployeeScore(data: EmployeeScoreInput): Promise<EmployeeScoreRow> {
    const row: EmployeeScoreRow = { id: `score-${this.scores.length + 1}`, verilme_tarihi: new Date().toISOString(), ...data };
    this.scores.push(row);
    return row;
  }
  async listScoresByEmployee(projectId: string, employeeId: string): Promise<EmployeeScoreRow[]> {
    return this.scores.filter((s) => s.project_id === projectId && s.employee_id === employeeId);
  }

  async submitTeamLeadScore(data: TeamLeadScoreInput): Promise<TeamLeadScoreRow> {
    const row: TeamLeadScoreRow = {
      id: randomUUID(),
      updated_by: null,
      updated_at: null,
      created_at: new Date().toISOString(),
      ...data,
    };
    this.teamLeadScores.push(row);
    return row;
  }
  async overrideTeamLeadScore(scoreId: string, puan: number, updatedBy: string): Promise<TeamLeadScoreRow | null> {
    const row = this.teamLeadScores.find((s) => s.id === scoreId);
    if (!row) return null;
    row.puan = puan;
    row.updated_by = updatedBy;
    row.updated_at = new Date().toISOString();
    return row;
  }
  async findTeamLeadScoreById(scoreId: string): Promise<TeamLeadScoreRow | null> {
    return this.teamLeadScores.find((s) => s.id === scoreId) ?? null;
  }
  async listTeamLeadScores(projectId: string, ekipLideriId: string): Promise<TeamLeadScoreRow[]> {
    return this.teamLeadScores.filter((s) => s.project_id === projectId && s.ekip_lideri_id === ekipLideriId);
  }

  async upsertEmployeeIndex(projectId: string, employeeId: string, endeksPuani: number): Promise<EmployeeIndexRow> {
    const existing = this.employeeIndices.find((r) => r.project_id === projectId && r.employee_id === employeeId);
    if (existing) {
      existing.endeks_puani = endeksPuani;
      return existing;
    }
    const row: EmployeeIndexRow = { project_id: projectId, employee_id: employeeId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() };
    this.employeeIndices.push(row);
    return row;
  }
  async upsertTeamIndex(projectId: string, teamId: string, endeksPuani: number): Promise<TeamIndexRow> {
    const existing = this.teamIndices.find((r) => r.project_id === projectId && r.team_id === teamId);
    if (existing) {
      existing.endeks_puani = endeksPuani;
      return existing;
    }
    const row: TeamIndexRow = { project_id: projectId, team_id: teamId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() };
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

describe('GET /projects/:projectId/employees/:employeeId/scores (F2, Day 10)', () => {
  let app: FastifyInstance;
  let repo: InMemoryPerformanceScoreRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryPerformanceScoreRepository();
    registerPerformanceRoutes(app, { scoreRepo: repo, publishAudit: async () => {} });
    await app.ready();
  });

  it('hiç puan yoksa boş liste döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/employees/${EMPLOYEE_ID}/scores` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it('mevcut puanları listeler', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, criterion_id: CRITERION_ID, puan: 85, veren_id: 'lider-1' });
    const res = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/employees/${EMPLOYEE_ID}/scores` });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].puan).toBe(85);
  });

  it('BAŞKA bir çalışanın puanını GETİRMEZ', async () => {
    await repo.submitEmployeeScore({ project_id: PROJECT_ID, employee_id: 'baska-calisan', criterion_id: CRITERION_ID, puan: 50, veren_id: 'lider-1' });
    const res = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/employees/${EMPLOYEE_ID}/scores` });
    expect(res.json().data).toEqual([]);
  });

  it('geçersiz id formatı 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/projects/gecersiz/employees/${EMPLOYEE_ID}/scores` });
    expect(res.statusCode).toBe(422);
  });
});

describe('POST /projects/:projectId/employees/:employeeId/scores — endeks yan etkisi (TL, Day 12)', () => {
  let app: FastifyInstance;
  let repo: InMemoryPerformanceScoreRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryPerformanceScoreRepository();
    registerPerformanceRoutes(app, { scoreRepo: repo, publishAudit: async () => {} });
    await app.ready();
  });

  it('puan girişi sonrası personel endeksi OTOMATİK hesaplanır (tek kriter, %100 ağırlık)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${PROJECT_ID}/employees/${EMPLOYEE_ID}/scores`,
      payload: { criterionId: CRITERION_ID, puan: 80 },
    });
    expect(res.statusCode).toBe(200);
    const indices = await repo.listEmployeeIndicesByProject(PROJECT_ID);
    expect(indices).toEqual([{ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, endeks_puani: 80, guncelleme: expect.any(String) }]);
  });
});

describe('team-leads/:leadId/scores (TL, Day 12 — performans endeksi finalize)', () => {
  let app: FastifyInstance;
  let repo: InMemoryPerformanceScoreRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryPerformanceScoreRepository();
    registerPerformanceRoutes(app, { scoreRepo: repo, publishAudit: async () => {} });
    await app.ready();
  });

  it('POST /projects/:id/team-leads/:leadId/scores — puan girişi + endeks hesaplanır', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${PROJECT_ID}/team-leads/${LEAD_ID}/scores`,
      payload: { criterionId: CRITERION_ID, puan: 70 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.ekip_lideri_id).toBe(LEAD_ID);
    const indices = await repo.listTeamIndicesByProject(PROJECT_ID);
    expect(indices[0].endeks_puani).toBe(70);
  });

  it('POST — puan 0-100 dışındaysa 422 döner', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/projects/${PROJECT_ID}/team-leads/${LEAD_ID}/scores`,
      payload: { criterionId: CRITERION_ID, puan: 150 },
    });
    expect(res.statusCode).toBe(422);
  });

  it('PATCH /team-leads/:leadId/scores/:scoreId — mevcut puanı override eder + endeksi yeniden hesaplar', async () => {
    await app.inject({ method: 'POST', url: `/projects/${PROJECT_ID}/team-leads/${LEAD_ID}/scores`, payload: { criterionId: CRITERION_ID, puan: 70 } });
    const scoreId = repo.teamLeadScores[0].id;

    const res = await app.inject({ method: 'PATCH', url: `/team-leads/${LEAD_ID}/scores/${scoreId}`, payload: { puan: 95 } });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.puan).toBe(95);
    expect(res.json().data.updated_by).toBeTruthy();
    expect((await repo.listTeamIndicesByProject(PROJECT_ID))[0].endeks_puani).toBe(95);
  });

  it('PATCH — olmayan bir puan id\'si 404 döner', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/team-leads/${LEAD_ID}/scores/${'99999999-9999-9999-9999-999999999999'}`, payload: { puan: 50 } });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET performance-index (TL, Day 12)', () => {
  let app: FastifyInstance;
  let repo: InMemoryPerformanceScoreRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryPerformanceScoreRepository();
    registerPerformanceRoutes(app, { scoreRepo: repo, publishAudit: async () => {} });
    await app.ready();
  });

  it('GET /projects/:id/performance-index?scope=employee — varsayılan olarak personel endekslerini döner', async () => {
    await repo.upsertEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, 88);
    const res = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/performance-index` });
    expect(res.json().data).toEqual([{ project_id: PROJECT_ID, employee_id: EMPLOYEE_ID, endeks_puani: 88, guncelleme: expect.any(String) }]);
  });

  it('GET /projects/:id/performance-index?scope=team — takım (ekip lideri) endekslerini döner', async () => {
    await repo.upsertTeamIndex(PROJECT_ID, LEAD_ID, 77);
    const res = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/performance-index?scope=team` });
    expect(res.json().data).toEqual([{ project_id: PROJECT_ID, team_id: LEAD_ID, endeks_puani: 77, guncelleme: expect.any(String) }]);
  });

  it('GET /employees/:id/performance-index — o çalışanın TÜM projelerdeki endekslerini döner', async () => {
    await repo.upsertEmployeeIndex(PROJECT_ID, EMPLOYEE_ID, 60);
    await repo.upsertEmployeeIndex('baska-proje', EMPLOYEE_ID, 90);
    const res = await app.inject({ method: 'GET', url: `/employees/${EMPLOYEE_ID}/performance-index` });
    expect(res.json().data).toHaveLength(2);
  });
});
