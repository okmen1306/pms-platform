import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@pms/shared';
import { assignPersonnel } from '../assign-personnel.usecase';
import type { AssignmentRepository, AssignmentRow, CreateAssignmentRow } from '../../../infrastructure/database/assignment.repository';
import { POSTGRES_EXCLUSION_VIOLATION } from '../../../infrastructure/database/assignment.repository';
import type {
  WorkPackageRepository,
  WorkPackageRow,
  SubWorkPackageRow,
  MasterWorkPackageRow,
} from '../../../infrastructure/database/work-package.repository';
import type { PersonnelServiceClient } from '../../../infrastructure/external/personnel-service.client';

/**
 * B1 (Day 11): "project testleri (çakışma)". Gerçek Postgres'in `EXCLUDE USING gist`
 * davranışını (23P01) TAKLİT eder — `create()` çağrısı, örtüşen bir kayıt varsa
 * assign-personnel.usecase.ts'in yakaladığı AYNI SQLSTATE koduyla hata fırlatır. Bu,
 * check-assignment-conflict.usecase.test.ts'teki dry-run testinden FARKLI olarak, INSERT +
 * catch akışının KENDİSİNİ (POST /projects/:id/assignments'ın gerçek yolu) doğrular —
 * o akış bugüne kadar hiç test edilmemişti.
 */
class InMemoryAssignmentRepository implements AssignmentRepository {
  rows: AssignmentRow[] = [];
  private nextId = 1;

  private overlaps(employeeId: string, start: string, end: string): boolean {
    return this.rows.some((r) => r.employee_id === employeeId && r.baslangic_tarihi <= end && r.bitis_tarihi >= start);
  }

  async create(data: CreateAssignmentRow): Promise<AssignmentRow> {
    if (this.overlaps(data.employee_id, data.baslangic_tarihi, data.bitis_tarihi)) {
      const pgError = new Error('exclusion_violation') as Error & { code: string };
      pgError.code = POSTGRES_EXCLUSION_VIOLATION;
      throw pgError;
    }
    const row: AssignmentRow = {
      id: `atama-${this.nextId++}`,
      project_id: data.project_id,
      work_package_id: data.work_package_id,
      sub_work_package_id: data.sub_work_package_id ?? null,
      employee_id: data.employee_id,
      baslangic_tarihi: data.baslangic_tarihi,
      bitis_tarihi: data.bitis_tarihi,
      tamamlandi_mi: false,
      tamamlanma_tarihi: null,
      created_at: new Date().toISOString(),
    };
    this.rows.push(row);
    return row;
  }

  async findById(id: string): Promise<AssignmentRow | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async findByProject(projectId: string, filters: { employeeId?: string } = {}): Promise<AssignmentRow[]> {
    return this.rows.filter(
      (r) => r.project_id === projectId && (!filters.employeeId || r.employee_id === filters.employeeId),
    );
  }
  async findByEmployee(employeeId: string, range: { from?: string; to?: string } = {}): Promise<AssignmentRow[]> {
    return this.rows.filter(
      (r) =>
        r.employee_id === employeeId &&
        (!range.from || r.bitis_tarihi >= range.from) &&
        (!range.to || r.baslangic_tarihi <= range.to),
    );
  }

  async findOverlapping(employeeId: string, start: string, end: string, excludeId?: string): Promise<AssignmentRow[]> {
    return this.rows.filter(
      (r) => r.employee_id === employeeId && r.id !== excludeId && r.baslangic_tarihi <= end && r.bitis_tarihi >= start,
    );
  }

  async markComplete(id: string, tamamlanmaTarihi: string): Promise<AssignmentRow> {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error('bulunamadı');
    row.tamamlandi_mi = true;
    row.tamamlanma_tarihi = tamamlanmaTarihi;
    return row;
  }
}

class FakeWorkPackageRepository implements WorkPackageRepository {
  workPackages: WorkPackageRow[] = [];
  subPackages: SubWorkPackageRow[] = [];

  async listMasterPackages(): Promise<MasterWorkPackageRow[]> {
    return [];
  }
  async listByProject(): Promise<WorkPackageRow[]> {
    return this.workPackages;
  }
  async findWorkPackageById(id: string): Promise<WorkPackageRow | null> {
    return this.workPackages.find((w) => w.id === id) ?? null;
  }
  async createWorkPackage(): Promise<WorkPackageRow> {
    throw new Error('kullanılmadı');
  }
  async createSubWorkPackage(): Promise<SubWorkPackageRow> {
    throw new Error('kullanılmadı');
  }
  async updateSubWorkPackage(): Promise<SubWorkPackageRow> {
    throw new Error('kullanılmadı');
  }
  async deleteSubWorkPackage(): Promise<void> {
    throw new Error('kullanılmadı');
  }
  async listSubWorkPackages(workPackageId: string): Promise<SubWorkPackageRow[]> {
    return this.subPackages.filter((s) => s.work_package_id === workPackageId);
  }
}

const PROJECT_ID = 'proje-1';
const WORK_PACKAGE_ID = 'is-paketi-1';
const EMPLOYEE_A = '11111111-1111-1111-1111-111111111111';
const ACTOR = 'aktor-1';

function baseWorkPackage(): WorkPackageRow {
  return { id: WORK_PACKAGE_ID, project_id: PROJECT_ID, master_work_package_id: 1, baslangic_tarihi: null, bitis_tarihi: null, kalite_puani: null };
}

describe('assignPersonnel (B1, Day 11 — çakışma/tamamlama testleri)', () => {
  let assignmentRepo: InMemoryAssignmentRepository;
  let workPackageRepo: FakeWorkPackageRepository;
  let personnelClient: PersonnelServiceClient;
  let publishAudit: ReturnType<typeof vi.fn>;
  let publishAssignmentCreated: ReturnType<typeof vi.fn>;
  let publishConflictDetected: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assignmentRepo = new InMemoryAssignmentRepository();
    workPackageRepo = new FakeWorkPackageRepository();
    workPackageRepo.workPackages.push(baseWorkPackage());
    personnelClient = { assertEmployeeActive: vi.fn().mockResolvedValue(undefined) } as unknown as PersonnelServiceClient;
    publishAudit = vi.fn().mockResolvedValue(undefined);
    publishAssignmentCreated = vi.fn().mockResolvedValue(undefined);
    publishConflictDetected = vi.fn().mockResolvedValue(undefined);
  });

  function run(input: { employeeId: string; baslangicTarihi: string; bitisTarihi: string; subWorkPackageId?: string; workPackageId?: string }) {
    return assignPersonnel(
      PROJECT_ID,
      { workPackageId: input.workPackageId ?? WORK_PACKAGE_ID, subWorkPackageId: input.subWorkPackageId, employeeId: input.employeeId, baslangicTarihi: input.baslangicTarihi, bitisTarihi: input.bitisTarihi },
      ACTOR,
      assignmentRepo,
      workPackageRepo,
      personnelClient,
      publishAudit,
      publishAssignmentCreated,
      publishConflictDetected,
    );
  }

  it('çakışma yoksa ataması başarıyla oluşturulur + assignment.created ve audit CREATE yayınlanır', async () => {
    const created = await run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' });
    expect(created.employee_id).toBe(EMPLOYEE_A);
    expect(publishAssignmentCreated).toHaveBeenCalledTimes(1);
    expect(publishConflictDetected).not.toHaveBeenCalled();
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'CREATE', severity: 'info' }));
  });

  it('personelin durumunu ÖNCE personnel-service üzerinden doğrular', async () => {
    await run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' });
    expect(personnelClient.assertEmployeeActive).toHaveBeenCalledWith(EMPLOYEE_A);
  });

  it('personel aktif değilse (ValidationError) atama denenmeden hata fırlatır', async () => {
    personnelClient = { assertEmployeeActive: vi.fn().mockRejectedValue(new ValidationError('Personel aktif değil')) } as unknown as PersonnelServiceClient;
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(assignmentRepo.rows).toHaveLength(0);
  });

  it('personel personnel-service\'te bulunamazsa (NotFoundError) hata fırlatır', async () => {
    personnelClient = { assertEmployeeActive: vi.fn().mockRejectedValue(new NotFoundError('Personel', EMPLOYEE_A)) } as unknown as PersonnelServiceClient;
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('iş paketi bulunamazsa NotFoundError fırlatır', async () => {
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10', workPackageId: 'yok-boyle-bir-id' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('iş paketi BAŞKA bir projeye aitse NotFoundError fırlatır', async () => {
    workPackageRepo.workPackages.push({ ...baseWorkPackage(), id: 'baska-proje-paketi', project_id: 'baska-proje' });
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10', workPackageId: 'baska-proje-paketi' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('alt iş paketi belirtilmiş ama iş paketinde yoksa NotFoundError fırlatır', async () => {
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10', subWorkPackageId: 'yok-boyle-bir-alt-paket' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('bitisTarihi baslangicTarihi\'nden önceyse ValidationError fırlatır', async () => {
    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-10', bitisTarihi: '2026-09-01' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('DB seviyesinde çakışma (23P01) ConflictAssignmentError\'a çevrilir + çakışma event/audit yayınlanır', async () => {
    await run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' });
    publishAssignmentCreated.mockClear();
    publishAudit.mockClear();

    await expect(run({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-05', bitisTarihi: '2026-09-15' })).rejects.toMatchObject({ code: 'ASSIGNMENT_CONFLICT' });

    expect(publishAssignmentCreated).not.toHaveBeenCalled();
    expect(publishConflictDetected).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: EMPLOYEE_A, conflictingAssignmentIds: expect.arrayContaining([expect.any(String)]) }),
    );
    expect(publishAudit).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }));
  });
});
