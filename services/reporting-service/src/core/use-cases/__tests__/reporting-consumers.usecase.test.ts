import { describe, it, expect, beforeEach } from 'vitest';
import { recordProjectPlannerSnapshot } from '../record-project-planner-snapshot.usecase';
import { recordAssignmentWorkload } from '../record-assignment-workload.usecase';
import { recordWorkPackageProgress } from '../record-work-package-progress.usecase';
import type { ReportRepository, ProjectProgressRow, ProjectPlannerSnapshotRow } from '../../../infrastructure/database/report.repository';
import type { ProjectCreatedEvent, AssignmentCreatedEvent, WorkPackageCompletedEvent } from '@pms/shared';

const PROJECT_ID = '11111111-1111-1111-1111-111111111111';
const EMPLOYEE_ID = '22222222-2222-2222-2222-222222222222';
const WORK_PACKAGE_ID = '33333333-3333-3333-3333-333333333333';

class InMemoryReportRepository implements ReportRepository {
  public plannerSnapshots = new Map<string, ProjectPlannerSnapshotRow>();
  public progressRows: ProjectProgressRow[] = [];
  public workloadRows: { employee_id: string; hafta_no: number; project_id: string; work_package_id: string }[] = [];

  async upsertPlannerSnapshot(row: {
    project_id: string;
    proje_adi: string;
    planlanan_baslangic: string | null;
    planlanan_sure_hafta: number | null;
  }): Promise<ProjectPlannerSnapshotRow> {
    const full: ProjectPlannerSnapshotRow = {
      ...row,
      fiili_baslangic: null,
      fiili_sure_hafta: null,
      tamamlanma_yuzdesi: 0,
      guncelleme: new Date().toISOString(),
    };
    this.plannerSnapshots.set(row.project_id, full);
    return full;
  }

  async findPlannerSnapshot(projectId: string): Promise<ProjectPlannerSnapshotRow | null> {
    return this.plannerSnapshots.get(projectId) ?? null;
  }

  async upsertProgress(row: {
    project_id: string;
    work_package_id: string | null;
    employee_id: string | null;
    tamamlanma_yuzdesi: number;
    baslangic_tarihi?: string | null;
    bitis_tarihi?: string | null;
  }): Promise<ProjectProgressRow> {
    const existingIndex = this.progressRows.findIndex(
      (r) => r.project_id === row.project_id && r.work_package_id === row.work_package_id && r.employee_id === row.employee_id,
    );
    const existing = existingIndex >= 0 ? this.progressRows[existingIndex] : null;
    const merged: ProjectProgressRow = {
      id: existing?.id ?? `progress-${this.progressRows.length + 1}`,
      project_id: row.project_id,
      work_package_id: row.work_package_id,
      employee_id: row.employee_id,
      tamamlanma_yuzdesi: row.tamamlanma_yuzdesi,
      baslangic_tarihi: row.baslangic_tarihi !== undefined ? row.baslangic_tarihi : existing?.baslangic_tarihi ?? null,
      bitis_tarihi: row.bitis_tarihi !== undefined ? row.bitis_tarihi : existing?.bitis_tarihi ?? null,
      guncelleme_zamani: new Date().toISOString(),
    };
    if (existingIndex >= 0) this.progressRows[existingIndex] = merged;
    else this.progressRows.push(merged);
    return merged;
  }

  async insertWorkloadSnapshot(rows: { employee_id: string; hafta_no: number; project_id: string; work_package_id: string }[]): Promise<void> {
    this.workloadRows.push(...rows);
  }

  async listWorkloadByProject(projectId: string) {
    return this.workloadRows
      .filter((r) => r.project_id === projectId)
      .map((r, i) => ({ id: `workload-${i}`, guncelleme: new Date().toISOString(), ...r }));
  }

  async listProgressByProject(projectId: string): Promise<ProjectProgressRow[]> {
    return this.progressRows.filter((r) => r.project_id === projectId);
  }

  async updatePlannerCompletion(projectId: string, tamamlanmaYuzdesi: number): Promise<void> {
    const existing = this.plannerSnapshots.get(projectId);
    if (!existing) return; // yarış durumu — insertWorkloadSnapshot'taki AYNI tolerans
    this.plannerSnapshots.set(projectId, { ...existing, tamamlanma_yuzdesi: tamamlanmaYuzdesi, guncelleme: new Date().toISOString() });
  }
}

describe('recordProjectPlannerSnapshot', () => {
  it('proje adı verilmişse aynen kaydedilir', async () => {
    const repo = new InMemoryReportRepository();
    const event: ProjectCreatedEvent = {
      projectId: PROJECT_ID,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      teamLeadId: 'lider-1',
      sureHafta: 20,
      projeAdi: 'Elektronik Kart Tasarımı',
    };
    await recordProjectPlannerSnapshot(event, repo);
    const snapshot = await repo.findPlannerSnapshot(PROJECT_ID);
    expect(snapshot?.proje_adi).toBe('Elektronik Kart Tasarımı');
    expect(snapshot?.planlanan_sure_hafta).toBe(20);
  });

  it('proje adı verilmemişse (geriye dönük uyumluluk) fallback kullanılır', async () => {
    const repo = new InMemoryReportRepository();
    const event: ProjectCreatedEvent = {
      projectId: PROJECT_ID,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      teamLeadId: 'lider-1',
      sureHafta: 20,
    };
    await recordProjectPlannerSnapshot(event, repo);
    const snapshot = await repo.findPlannerSnapshot(PROJECT_ID);
    expect(snapshot?.proje_adi).toBe('Bilinmeyen Proje');
  });
});

describe('recordAssignmentWorkload', () => {
  let repo: InMemoryReportRepository;

  beforeEach(() => {
    repo = new InMemoryReportRepository();
  });

  function makeAssignmentEvent(overrides: Partial<AssignmentCreatedEvent> = {}): AssignmentCreatedEvent {
    return {
      assignmentId: 'assignment-1',
      projectId: PROJECT_ID,
      employeeId: EMPLOYEE_ID,
      workPackageId: WORK_PACKAGE_ID,
      start: '2026-01-08',
      end: '2026-01-15',
      ...overrides,
    };
  }

  it('%0 tamamlanma ile bir progress satırı açar', async () => {
    await recordAssignmentWorkload(makeAssignmentEvent(), repo);
    expect(repo.progressRows).toHaveLength(1);
    expect(repo.progressRows[0].tamamlanma_yuzdesi).toBe(0);
  });

  it('planner snapshot VARSA kapsanan haftalar için workload satırı ekler', async () => {
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'X', planlanan_baslangic: '2026-01-01', planlanan_sure_hafta: 10 });
    await recordAssignmentWorkload(makeAssignmentEvent(), repo);
    // 2026-01-08 -> hafta 2, 2026-01-15 -> hafta 3
    expect(repo.workloadRows.map((r) => r.hafta_no)).toEqual([2, 3]);
  });

  it('planner snapshot YOKSA (yarış durumu) workload satırı eklenmez AMA progress satırı hâlâ açılır', async () => {
    await recordAssignmentWorkload(makeAssignmentEvent(), repo);
    expect(repo.workloadRows).toHaveLength(0);
    expect(repo.progressRows).toHaveLength(1);
  });
});

describe('recordWorkPackageProgress', () => {
  it('mevcut bir progress satırını %100\'e günceller (tarih alanlarını EZMEZ)', async () => {
    const repo = new InMemoryReportRepository();
    await repo.upsertProgress({
      project_id: PROJECT_ID,
      work_package_id: WORK_PACKAGE_ID,
      employee_id: EMPLOYEE_ID,
      tamamlanma_yuzdesi: 0,
      baslangic_tarihi: '2026-01-08',
      bitis_tarihi: '2026-01-15',
    });

    const event: WorkPackageCompletedEvent = {
      projectId: PROJECT_ID,
      workPackageId: WORK_PACKAGE_ID,
      subWorkPackageId: null,
      employeeId: EMPLOYEE_ID,
      onTime: true,
    };
    await recordWorkPackageProgress(event, repo);

    expect(repo.progressRows).toHaveLength(1);
    expect(repo.progressRows[0].tamamlanma_yuzdesi).toBe(100);
    expect(repo.progressRows[0].baslangic_tarihi).toBe('2026-01-08'); // korunmuş
  });

  it('hiç progress satırı yoksa (assignment.created kaçırılmış olabilir) yeni bir satır açar', async () => {
    const repo = new InMemoryReportRepository();
    const event: WorkPackageCompletedEvent = {
      projectId: PROJECT_ID,
      workPackageId: WORK_PACKAGE_ID,
      subWorkPackageId: null,
      employeeId: EMPLOYEE_ID,
      onTime: false,
    };
    await recordWorkPackageProgress(event, repo);
    expect(repo.progressRows).toHaveLength(1);
    expect(repo.progressRows[0].tamamlanma_yuzdesi).toBe(100);
  });

  const EMPLOYEE_2 = '44444444-4444-4444-4444-444444444444';
  const WORK_PACKAGE_2 = '55555555-5555-5555-5555-555555555555';

  it('B2 destek: iş paketi tamamlanınca planner snapshot\'ın genel tamamlanma yüzdesi yeniden hesaplanır', async () => {
    const repo = new InMemoryReportRepository();
    await repo.upsertPlannerSnapshot({ project_id: PROJECT_ID, proje_adi: 'X', planlanan_baslangic: '2026-01-01', planlanan_sure_hafta: 10 });
    // 2 atama (2 progress satırı), ikisi de %0'da başlar.
    await repo.upsertProgress({ project_id: PROJECT_ID, work_package_id: WORK_PACKAGE_ID, employee_id: EMPLOYEE_ID, tamamlanma_yuzdesi: 0 });
    await repo.upsertProgress({ project_id: PROJECT_ID, work_package_id: WORK_PACKAGE_2, employee_id: EMPLOYEE_2, tamamlanma_yuzdesi: 0 });

    await recordWorkPackageProgress(
      { projectId: PROJECT_ID, workPackageId: WORK_PACKAGE_ID, subWorkPackageId: null, employeeId: EMPLOYEE_ID, onTime: true },
      repo,
    );

    const snapshot = await repo.findPlannerSnapshot(PROJECT_ID);
    expect(snapshot?.tamamlanma_yuzdesi).toBe(50); // 1/2 tamamlandı

    await recordWorkPackageProgress(
      { projectId: PROJECT_ID, workPackageId: WORK_PACKAGE_2, subWorkPackageId: null, employeeId: EMPLOYEE_2, onTime: true },
      repo,
    );
    expect((await repo.findPlannerSnapshot(PROJECT_ID))?.tamamlanma_yuzdesi).toBe(100);
  });

  it('B2 destek: planner snapshot henüz yoksa (yarış durumu) sessizce atlanır, hata fırlatmaz', async () => {
    const repo = new InMemoryReportRepository();
    await repo.upsertProgress({ project_id: PROJECT_ID, work_package_id: WORK_PACKAGE_ID, employee_id: EMPLOYEE_ID, tamamlanma_yuzdesi: 0 });
    await expect(
      recordWorkPackageProgress(
        { projectId: PROJECT_ID, workPackageId: WORK_PACKAGE_ID, subWorkPackageId: null, employeeId: EMPLOYEE_ID, onTime: true },
        repo,
      ),
    ).resolves.not.toThrow();
    expect(await repo.findPlannerSnapshot(PROJECT_ID)).toBeNull();
  });
});
