import { describe, it, expect, beforeEach } from 'vitest';
import { createMilestone } from '../create-milestone.usecase';
import type { MilestoneRepository, MilestoneRow, CreateMilestoneRow } from '../../../infrastructure/database/milestone.repository';
import type { ProjectRepository, ProjectRow, CreateProjectRow } from '../../../infrastructure/database/project.repository';
import type { AuditPublisherFn } from '@pms/shared';

const PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const ACTOR_ID = '11111111-1111-1111-1111-111111111111';

class InMemoryMilestoneRepository implements MilestoneRepository {
  public rows: MilestoneRow[] = [];

  async create(row: CreateMilestoneRow): Promise<MilestoneRow> {
    const full: MilestoneRow = {
      id: `milestone-${this.rows.length + 1}`,
      aciklama: null,
      created_at: new Date().toISOString(),
      ...row,
    };
    this.rows.push(full);
    return full;
  }

  async findByProject(projectId: string): Promise<MilestoneRow[]> {
    return this.rows.filter((r) => r.project_id === projectId).sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
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

describe('createMilestone', () => {
  let milestoneRepo: InMemoryMilestoneRepository;
  let publishedAudits: Parameters<AuditPublisherFn>[0][];
  let publishAudit: AuditPublisherFn;

  beforeEach(() => {
    milestoneRepo = new InMemoryMilestoneRepository();
    publishedAudits = [];
    publishAudit = async (event) => {
      publishedAudits.push(event);
    };
  });

  it('proje varsa kilometre taşını oluşturur', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    const result = await createMilestone(
      PROJECT_ID,
      { tarih: '2026-03-01', baslik: 'Prototip Teslimi', emailGonderilsin: true, hedefGruplar: ['role:ekip_lideri'] },
      ACTOR_ID,
      milestoneRepo,
      projectRepo,
      publishAudit,
    );
    expect(result.baslik).toBe('Prototip Teslimi');
    expect(result.project_id).toBe(PROJECT_ID);
    expect(result.hedef_gruplar).toEqual(['role:ekip_lideri']);
  });

  it('proje YOKSA NotFoundError fırlatır', async () => {
    const projectRepo = new FakeProjectRepository(null);
    await expect(
      createMilestone(
        PROJECT_ID,
        { tarih: '2026-03-01', baslik: 'Prototip Teslimi', emailGonderilsin: true, hedefGruplar: [] },
        ACTOR_ID,
        milestoneRepo,
        projectRepo,
        publishAudit,
      ),
    ).rejects.toThrow(/bulunamadı/i);
  });

  it('audit.event yayınlar (proje adını ve başlığı içeren okunabilir bir özet ile)', async () => {
    const projectRepo = new FakeProjectRepository(makeProject({ proje_adi: 'Elektronik Kart Tasarımı' }));
    await createMilestone(
      PROJECT_ID,
      { tarih: '2026-03-01', baslik: 'Tasarım Onayı', emailGonderilsin: true, hedefGruplar: [] },
      ACTOR_ID,
      milestoneRepo,
      projectRepo,
      publishAudit,
    );
    expect(publishedAudits).toHaveLength(1);
    expect(publishedAudits[0].entityType).toBe('project_milestones');
    expect(publishedAudits[0].ozet).toContain('Elektronik Kart Tasarımı');
    expect(publishedAudits[0].ozet).toContain('Tasarım Onayı');
  });

  it('aciklama verilmezse null olarak kaydedilir', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    const result = await createMilestone(
      PROJECT_ID,
      { tarih: '2026-03-01', baslik: 'Prototip Teslimi', emailGonderilsin: true, hedefGruplar: [] },
      ACTOR_ID,
      milestoneRepo,
      projectRepo,
      publishAudit,
    );
    expect(result.aciklama).toBeNull();
  });

  it('findByProject tarihe göre artan sırada döner', async () => {
    const projectRepo = new FakeProjectRepository(makeProject());
    await createMilestone(
      PROJECT_ID,
      { tarih: '2026-05-01', baslik: 'İkinci', emailGonderilsin: true, hedefGruplar: [] },
      ACTOR_ID,
      milestoneRepo,
      projectRepo,
      publishAudit,
    );
    await createMilestone(
      PROJECT_ID,
      { tarih: '2026-02-01', baslik: 'Birinci', emailGonderilsin: true, hedefGruplar: [] },
      ACTOR_ID,
      milestoneRepo,
      projectRepo,
      publishAudit,
    );
    const list = await milestoneRepo.findByProject(PROJECT_ID);
    expect(list.map((m) => m.baslik)).toEqual(['Birinci', 'İkinci']);
  });
});
