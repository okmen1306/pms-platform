import Fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { registerErrorHandler } from '@pms/shared';
import { registerAssignmentRoutes } from '../assignment.controller';
import type { AssignmentRepository, AssignmentRow, CreateAssignmentRow } from '../../infrastructure/database/assignment.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';
import type { WorkPackageRepository } from '../../infrastructure/database/work-package.repository';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';
import type { RabbitMqClient } from '@pms/shared';

/** check-assignment-conflict.usecase.test.ts'teki ile aynı, findOverlapping mantığını taklit eden sahte repo. */
class InMemoryAssignmentRepository implements AssignmentRepository {
  private rows: AssignmentRow[] = [];

  seed(row: Partial<AssignmentRow> & Pick<AssignmentRow, 'employee_id' | 'baslangic_tarihi' | 'bitis_tarihi'>): AssignmentRow {
    const full: AssignmentRow = {
      // Gerçek UUID (v4) — çünkü excludeAssignmentId testi bunu zod'un .uuid() query şemasından geçirir.
      id: randomUUID(),
      project_id: row.project_id ?? '33333333-3333-3333-3333-333333333333',
      work_package_id: row.work_package_id ?? '44444444-4444-4444-4444-444444444444',
      sub_work_package_id: row.sub_work_package_id ?? null,
      employee_id: row.employee_id,
      baslangic_tarihi: row.baslangic_tarihi,
      bitis_tarihi: row.bitis_tarihi,
      tamamlandi_mi: row.tamamlandi_mi ?? false,
      tamamlanma_tarihi: row.tamamlanma_tarihi ?? null,
      created_at: row.created_at ?? new Date().toISOString(),
    };
    this.rows.push(full);
    return full;
  }

  async create(data: CreateAssignmentRow): Promise<AssignmentRow> {
    return this.seed(data);
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
  async findOverlapping(employeeId: string, baslangic: string, bitis: string, excludeId?: string): Promise<AssignmentRow[]> {
    return this.rows.filter(
      (r) => r.employee_id === employeeId && r.id !== excludeId && r.baslangic_tarihi <= bitis && r.bitis_tarihi >= baslangic,
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

const PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const OTHER_PROJECT_ID = '44444444-4444-4444-4444-444444444444';
/** Day 20: yalnızca `findById` kullanılıyor (takvimde proje adı için). */
const fakeProjectRepo = {
  findById: async (id: string) => ({ id, proje_adi: id === PROJECT_ID ? 'Alfa Projesi' : 'Beta Projesi' }),
} as unknown as ProjectRepository;
const EMPLOYEE_A = '11111111-1111-1111-1111-111111111111';

describe('GET /projects/:id/assignments/conflict-check', () => {
  let app: FastifyInstance;
  let repo: InMemoryAssignmentRepository;

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryAssignmentRepository();
    registerAssignmentRoutes(app, {
      assignmentRepo: repo,
      // Bu route ne workPackageRepo'ya ne personnelClient'a ne rabbit'e dokunur (sadece
      // POST /assignments dokunur) — bu yüzden burada sadece TypeScript'i tatmin eden asgari
      // sahteler yeterli.
      workPackageRepo: {} as unknown as WorkPackageRepository,
      projectRepo: fakeProjectRepo,
      personnelClient: {} as unknown as PersonnelServiceClient,
      rabbit: {} as unknown as RabbitMqClient,
      publishAudit: async () => {},
    });
    await app.ready();
  });

  it('çakışma yoksa 200 + hasConflict:false döner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/assignments/conflict-check?employeeId=${EMPLOYEE_A}&baslangicTarihi=2026-09-01&bitisTarihi=2026-09-10`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.hasConflict).toBe(false);
    expect(body.data.conflictingAssignments).toEqual([]);
  });

  it('çakışma varsa 200 + hasConflict:true + çakışan atama listesi döner', async () => {
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/assignments/conflict-check?employeeId=${EMPLOYEE_A}&baslangicTarihi=2026-09-05&bitisTarihi=2026-09-15`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.hasConflict).toBe(true);
    expect(body.data.conflictingAssignments).toHaveLength(1);
  });

  it('employeeId eksikse 422 VALIDATION_ERROR döner (standart hata zarfı, bkz. error-handler.helper.ts)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/assignments/conflict-check?baslangicTarihi=2026-09-01&bitisTarihi=2026-09-10`,
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('geçersiz proje id formatı 422 döner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/gecersiz-id/assignments/conflict-check?employeeId=${EMPLOYEE_A}&baslangicTarihi=2026-09-01&bitisTarihi=2026-09-10`,
    });
    expect(res.statusCode).toBe(422);
  });

  it('bitisTarihi baslangicTarihi\'nden önceyse 422 döner', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/assignments/conflict-check?employeeId=${EMPLOYEE_A}&baslangicTarihi=2026-09-10&bitisTarihi=2026-09-01`,
    });
    expect(res.statusCode).toBe(422);
  });

  it('excludeAssignmentId ile kendi atamasıyla çakışma göz ardı edilir', async () => {
    const existing = repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/assignments/conflict-check?employeeId=${EMPLOYEE_A}&baslangicTarihi=2026-09-01&bitisTarihi=2026-09-10&excludeAssignmentId=${existing.id}`,
    });
    expect(res.json().data.hasConflict).toBe(false);
  });
});

describe('Day 20: GET /employees/:id/calendar ve GET /projects/:id/assignments?employeeId=', () => {
  let app: FastifyInstance;
  let repo: InMemoryAssignmentRepository;
  const EMPLOYEE_B = '22222222-2222-2222-2222-222222222222';
  const WP = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    app = Fastify();
    registerErrorHandler(app);
    repo = new InMemoryAssignmentRepository();
    registerAssignmentRoutes(app, {
      assignmentRepo: repo,
      workPackageRepo: {} as unknown as WorkPackageRepository,
      projectRepo: fakeProjectRepo,
      personnelClient: {} as unknown as PersonnelServiceClient,
      rabbit: {} as unknown as RabbitMqClient,
      publishAudit: async () => {},
    });
    await app.ready();
    await repo.seed({ project_id: PROJECT_ID, work_package_id: WP, employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-10-05', bitis_tarihi: '2026-10-16' });
    await repo.seed({ project_id: OTHER_PROJECT_ID, work_package_id: WP, employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-11-02', bitis_tarihi: '2026-11-13' });
    await repo.seed({ project_id: PROJECT_ID, work_package_id: WP, employee_id: EMPLOYEE_B, baslangic_tarihi: '2026-10-05', bitis_tarihi: '2026-10-16' });
  });

  it('takvim: personelin TÜM projelerdeki atamaları, proje adıyla birlikte döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/employees/${EMPLOYEE_A}/calendar` });
    expect(res.statusCode).toBe(200);
    const items = res.json().data;
    expect(items).toHaveLength(2);
    expect(items.map((i: { proje_adi: string }) => i.proje_adi)).toEqual(['Alfa Projesi', 'Beta Projesi']);
    expect(items.every((i: { employee_id: string }) => i.employee_id === EMPLOYEE_A)).toBe(true);
  });

  it('takvim: from/to aralığıyla KESİŞEN atamalar döner', async () => {
    const res = await app.inject({ method: 'GET', url: `/employees/${EMPLOYEE_A}/calendar?from=2026-10-10&to=2026-10-31` });
    expect(res.json().data).toHaveLength(1);
    expect(res.json().data[0].project_id).toBe(PROJECT_ID);
  });

  it('takvim: ataması olmayan personel için boş liste (404 değil)', async () => {
    const res = await app.inject({ method: 'GET', url: `/employees/99999999-9999-9999-9999-999999999999/calendar` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
  });

  it('takvim: geçersiz id ve geçersiz tarih 422', async () => {
    expect((await app.inject({ method: 'GET', url: '/employees/abc/calendar' })).statusCode).toBe(422);
    expect((await app.inject({ method: 'GET', url: `/employees/${EMPLOYEE_A}/calendar?from=yarin` })).statusCode).toBe(422);
  });

  it('atama listesi: ?employeeId= yalnızca o personelin atamalarını döner; filtresiz hepsi', async () => {
    const all = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/assignments` });
    expect(all.json().data).toHaveLength(2);
    const filtered = await app.inject({ method: 'GET', url: `/projects/${PROJECT_ID}/assignments?employeeId=${EMPLOYEE_B}` });
    expect(filtered.json().data).toHaveLength(1);
    expect(filtered.json().data[0].employee_id).toBe(EMPLOYEE_B);
  });
});
