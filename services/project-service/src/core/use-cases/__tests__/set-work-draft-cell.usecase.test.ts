import { describe, it, expect, beforeEach } from 'vitest';
import { setWorkDraftCell } from '../set-work-draft-cell.usecase';
import type { WorkDraftRepository, WorkDraftCellRow, UpsertWorkDraftCellRow } from '../../../infrastructure/database/work-draft.repository';
import type { ProjectRepository, ProjectRow } from '../../../infrastructure/database/project.repository';
import type { AuditPublisherFn } from '@pms/shared';

const PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const WORK_PACKAGE_ID = '44444444-4444-4444-4444-444444444444';
const ACTOR_ID = '11111111-1111-1111-1111-111111111111';

class InMemoryWorkDraftRepository implements WorkDraftRepository {
  public rows: WorkDraftCellRow[] = [];

  async upsertCell(row: UpsertWorkDraftCellRow): Promise<WorkDraftCellRow> {
    const existingIndex = this.rows.findIndex(
      (r) => r.project_id === row.project_id && r.work_package_id === row.work_package_id && r.hafta_no === row.hafta_no,
    );
    const full: WorkDraftCellRow = {
      id: existingIndex >= 0 ? this.rows[existingIndex].id : `cell-${this.rows.length + 1}`,
      created_at: existingIndex >= 0 ? this.rows[existingIndex].created_at : new Date().toISOString(),
      ...row,
    };
    if (existingIndex >= 0) this.rows[existingIndex] = full;
    else this.rows.push(full);
    return full;
  }

  async findByProject(projectId: string): Promise<WorkDraftCellRow[]> {
    return this.rows.filter((r) => r.project_id === projectId).sort((a, b) => a.hafta_no - b.hafta_no);
  }
}

class FakeProjectRepository implements ProjectRepository {
  constructor(private readonly project: ProjectRow | null) {}
  async findAll(): Promise<ProjectRow[]> {
    return this.project ? [this.project] : [];
  }
  async findById(id: string): Promise<ProjectRow | null> {
    return this.project && this.project.id === id ? this.project : null;
  }
  async create(): Promise<ProjectRow> {
    throw new Error('kullanılmadı');
  }
  async update(): Promise<ProjectRow> {
    throw new Error('kullanılmadı');
  }
}

function makeProject(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: PROJECT_ID,
    proje_adi: 'Mekanik Aksam Tasarımı',
    baslangic_tarihi: '2026-01-01',
    bitis_tarihi: '2026-06-01',
    sure_hafta: 20,
    product_group_id: 'grup-1',
    product_id: 'urun-1',
    durum: 'devam_ediyor',
    ekip_lideri_id: 'lider-1',
    tahmini_maliyet_tl: null,
    satis_fiyati_tl: null,
    danismanlik_maliyeti_tl: 0,
    paketleme_gonderim_maliyeti_tl: 0,
    idari_maliyet_orani: 0,
    created_by: 'lider-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('setWorkDraftCell', () => {
  let workDraftRepo: InMemoryWorkDraftRepository;
  let publishedAudits: Parameters<AuditPublisherFn>[0][];
  let publishAudit: AuditPublisherFn;

  beforeEach(() => {
    workDraftRepo = new InMemoryWorkDraftRepository();
    publishedAudits = [];
    publishAudit = async (event) => {
      publishedAudits.push(event);
    };
  });

  it('proje varsa hücreyi boyar', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    const result = await setWorkDraftCell(
      PROJECT_ID,
      { workPackageId: WORK_PACKAGE_ID, haftaNo: 3, boyali: true },
      ACTOR_ID,
      workDraftRepo,
      projectRepo,
      publishAudit,
    );
    expect(result.boyali).toBe(true);
    expect(result.hafta_no).toBe(3);
  });

  it('proje YOKSA NotFoundError fırlatır', async () => {
    const projectRepo = new FakeProjectRepository(null);
    await expect(
      setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 3, boyali: true }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit),
    ).rejects.toThrow(/bulunamadı/i);
  });

  it('AYNI hücreye tekrar POST atmak (boyali:false ile) boyayı KALDIRIR — yeni satır AÇMAZ', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    await setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 3, boyali: true }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit);
    await setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 3, boyali: false }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit);

    const all = await workDraftRepo.findByProject(PROJECT_ID);
    expect(all).toHaveLength(1);
    expect(all[0].boyali).toBe(false);
  });

  it('audit.event yayınlar', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    await setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 5, boyali: true }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit);
    expect(publishedAudits).toHaveLength(1);
    expect(publishedAudits[0].entityType).toBe('project_work_drafts');
    expect(publishedAudits[0].ozet).toContain('boyandı');
  });

  it('farklı hafta numaraları AYRI hücreler olarak kaydedilir', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    await setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 1, boyali: true }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit);
    await setWorkDraftCell(PROJECT_ID, { workPackageId: WORK_PACKAGE_ID, haftaNo: 2, boyali: true }, ACTOR_ID, workDraftRepo, projectRepo, publishAudit);
    const all = await workDraftRepo.findByProject(PROJECT_ID);
    expect(all).toHaveLength(2);
  });
});
