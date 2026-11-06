import { describe, it, expect, beforeEach } from 'vitest';
import { buildCompletionSummary } from '../build-completion-summary.usecase';
import type { ReportRepository, ProjectProgressRow, ProjectPlannerSnapshotRow } from '../../../infrastructure/database/report.repository';

/** reporting-consumers.usecase.test.ts'teki InMemoryReportRepository ile AYNI kalıp. */
class InMemoryReportRepository implements ReportRepository {
  public plannerSnapshots = new Map<string, ProjectPlannerSnapshotRow>();
  public progressRows: ProjectProgressRow[] = [];
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

  seedProgress(row: Partial<ProjectProgressRow> & Pick<ProjectProgressRow, 'project_id' | 'tamamlanma_yuzdesi'>): void {
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

  async upsertProgress(row: {
    project_id: string;
    work_package_id: string | null;
    employee_id: string | null;
    tamamlanma_yuzdesi: number;
  }): Promise<ProjectProgressRow> {
    this.seedProgress(row);
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

const PROJECT_ID = 'proje-1';
const WP_A = 'is-paketi-a';
const WP_B = 'is-paketi-b';
const EMP_A = 'personel-a';
const EMP_B = 'personel-b';

describe('buildCompletionSummary (B3, Day 11 — B2 destekli)', () => {
  let repo: InMemoryReportRepository;

  beforeEach(() => {
    repo = new InMemoryReportRepository();
  });

  it('scope=project: planner snapshot yoksa NotFoundError fırlatır', async () => {
    await expect(buildCompletionSummary(PROJECT_ID, 'project', repo)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('scope=project: snapshot\'taki tamamlanma yüzdesini + iş sayılarını döner', async () => {
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'Test Projesi', planlanan_baslangic: '2026-01-01', planlanan_sure_hafta: 10 });
    await repo.updatePlannerCompletion(PROJECT_ID, 50);
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_A, employee_id: EMP_A, tamamlanma_yuzdesi: 100 });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_B, employee_id: EMP_B, tamamlanma_yuzdesi: 0 });

    const result = await buildCompletionSummary(PROJECT_ID, 'project', repo);
    expect(result).toEqual({
      scope: 'project',
      projectId: PROJECT_ID,
      projeAdi: 'Test Projesi',
      tamamlanmaYuzdesi: 50,
      tamamlananIsSayisi: 1,
      toplamIsSayisi: 2,
    });
  });

  it('scope=work-package: her iş paketi için ayrı tamamlanma yüzdesi döner', async () => {
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'X', planlanan_baslangic: null, planlanan_sure_hafta: null });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_A, employee_id: EMP_A, tamamlanma_yuzdesi: 100 });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_A, employee_id: EMP_B, tamamlanma_yuzdesi: 0 });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_B, employee_id: EMP_A, tamamlanma_yuzdesi: 100 });

    const result = (await buildCompletionSummary(PROJECT_ID, 'work-package', repo)) as { key: string; tamamlanmaYuzdesi: number }[];
    expect(result).toHaveLength(2);
    const wpA = result.find((r) => r.key === WP_A);
    const wpB = result.find((r) => r.key === WP_B);
    expect(wpA?.tamamlanmaYuzdesi).toBe(50);
    expect(wpB?.tamamlanmaYuzdesi).toBe(100);
  });

  it('scope=employee: her personel için ayrı tamamlanma yüzdesi döner', async () => {
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_A, employee_id: EMP_A, tamamlanma_yuzdesi: 100 });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_B, employee_id: EMP_A, tamamlanma_yuzdesi: 0 });

    const result = (await buildCompletionSummary(PROJECT_ID, 'employee', repo)) as { key: string; tamamlanmaYuzdesi: number }[];
    expect(result).toEqual([{ key: EMP_A, tamamlanmaYuzdesi: 50, tamamlananIsSayisi: 1, toplamIsSayisi: 2 }]);
  });

  it('scope=work-package: hiç progress satırı yoksa boş dizi döner', async () => {
    const result = await buildCompletionSummary(PROJECT_ID, 'work-package', repo);
    expect(result).toEqual([]);
  });

  it('BAŞKA bir projenin progress satırları karışmaz', async () => {
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'X', planlanan_baslangic: null, planlanan_sure_hafta: null });
    repo.seedProgress({ project_id: PROJECT_ID, work_package_id: WP_A, employee_id: EMP_A, tamamlanma_yuzdesi: 100 });
    repo.seedProgress({ project_id: 'baska-proje', work_package_id: WP_B, employee_id: EMP_B, tamamlanma_yuzdesi: 0 });

    const result = await buildCompletionSummary(PROJECT_ID, 'project', repo);
    expect((result as { toplamIsSayisi: number }).toplamIsSayisi).toBe(1);
  });
});
