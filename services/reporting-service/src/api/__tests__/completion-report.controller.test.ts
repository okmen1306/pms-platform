import Fastify, { type FastifyInstance } from 'fastify';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerCompletionReportRoutes } from '../completion-report.controller';
import type { ReportRepository, ProjectProgressRow, ProjectPlannerSnapshotRow } from '../../infrastructure/database/report.repository';

/**
 * B2 (Day 11): "B3'e reporting-service desteği" — B3, `completion-report.controller.ts` +
 * `build-completion-summary.usecase.ts`'i yazarken (bkz. build-completion-summary.usecase.test.ts)
 * B2 bu HTTP katmanı test dosyasını yazdı (finance-service'in cost-analysis.controller.test.ts'te
 * (Day 10) kurduğu AYNI kalıp — Fastify `app.inject` + bellek içi sahte repo).
 */
class InMemoryReportRepository implements ReportRepository {
  plannerSnapshots = new Map<string, ProjectPlannerSnapshotRow>();
  progressRows: ProjectProgressRow[] = [];
  private nextId = 1;

  async upsertPlannerSnapshot(row: {
    project_id: string;
    proje_adi: string;
    planlanan_baslangic: string | null;
    planlanan_sure_hafta: number | null;
  }): Promise<ProjectPlannerSnapshotRow> {
    const full: ProjectPlannerSnapshotRow = { ...row, fiili_baslangic: null, fiili_sure_hafta: null, tamamlanma_yuzdesi: 0, guncelleme: new Date().toISOString() };
    this.plannerSnapshots.set(row.project_id, full);
    return full;
  }

  async findPlannerSnapshot(projectId: string): Promise<ProjectPlannerSnapshotRow | null> {
    return this.plannerSnapshots.get(projectId) ?? null;
  }

  seed(row: Partial<ProjectProgressRow> & Pick<ProjectProgressRow, 'project_id' | 'tamamlanma_yuzdesi'>): void {
    this.progressRows.push({
      id: `progress-${this.nextId++}`,
      project_id: row.project_id,
      work_package_id: row.work_package_id ?? null,
      employee_id: row.employee_id ?? null,
      tamamlanma_yuzdesi: row.tamamlanma_yuzdesi,
      baslangic_tarihi: row.baslangic_tarihi ?? null,
      bitis_tarihi: row.bitis_tarihi ?? null,
      guncelleme_zamani: new Date().toISOString(),
    });
  }

  async upsertProgress(row: { project_id: string; work_package_id: string | null; employee_id: string | null; tamamlanma_yuzdesi: number }): Promise<ProjectProgressRow> {
    this.seed(row);
    return this.progressRows[this.progressRows.length - 1];
  }

  async insertWorkloadSnapshot(): Promise<void> {}

  async listWorkloadByProject() {
    return [];
  }

  async listProgressByProject(projectId: string): Promise<ProjectProgressRow[]> {
    return this.progressRows.filter((r) => r.project_id === projectId);
  }

  async updatePlannerCompletion(projectId: string, tamamlanmaYuzdesi: number): Promise<void> {
    const existing = this.plannerSnapshots.get(projectId);
    if (!existing) return;
    this.plannerSnapshots.set(projectId, { ...existing, tamamlanma_yuzdesi: tamamlanmaYuzdesi });
  }
}

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';

describe('reporting-service completion-report controller (B2 destek, Day 11)', () => {
  let app: FastifyInstance;
  let repo: InMemoryReportRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryReportRepository();
    registerCompletionReportRoutes(app, { reportRepo: repo });
    await app.ready();
  });

  it('GET /reports/completion-status?projectId= — projectId eksikse 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/reports/completion-status' });
    expect(res.statusCode).toBe(422);
  });

  it('GET /reports/completion-status?projectId=gecersiz — UUID değilse 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: '/reports/completion-status?projectId=gecersiz' });
    expect(res.statusCode).toBe(422);
  });

  it('GET /reports/completion-status?projectId=&scope=project — snapshot yoksa 404 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/reports/completion-status?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(404);
  });

  it('GET /reports/completion-status?projectId= — scope verilmezse varsayılan olarak project kullanılır', async () => {
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'Test', planlanan_baslangic: null, planlanan_sure_hafta: null });
    const res = await app.inject({ method: 'GET', url: `/reports/completion-status?projectId=${PROJECT_ID}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.scope).toBe('project');
  });

  it('GET /reports/completion-status?scope=work-package — iş paketi kırılımını döner', async () => {
    repo.seed({ project_id: PROJECT_ID, work_package_id: 'wp-1', employee_id: 'emp-1', tamamlanma_yuzdesi: 100 });
    repo.seed({ project_id: PROJECT_ID, work_package_id: 'wp-2', employee_id: 'emp-1', tamamlanma_yuzdesi: 0 });
    const res = await app.inject({ method: 'GET', url: `/reports/completion-status?projectId=${PROJECT_ID}&scope=work-package` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toHaveLength(2);
  });

  it('GET /reports/completion-status?scope=gecersiz — bilinmeyen scope 422 döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/reports/completion-status?projectId=${PROJECT_ID}&scope=gecersiz` });
    expect(res.statusCode).toBe(422);
  });
});
