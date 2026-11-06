import { describe, it, expect, beforeEach } from 'vitest';
import { checkAssignmentConflict } from '../check-assignment-conflict.usecase';
import type { AssignmentRepository, AssignmentRow, CreateAssignmentRow } from '../../../infrastructure/database/assignment.repository';

/**
 * Gerçek Supabase'e (veya EXCLUDE USING gist kısıtlamasına) hiç bağlanmayan, tamamen bellek
 * içi sahte repository. Day 7'nin `findOverlapping` sorgu mantığını (tarih aralığı kesişimi:
 * baslangic <= digerinin_bitisi VE bitis >= digerinin_baslangici) BİREBİR taklit eder ki test,
 * gerçek Postgres'in `EXCLUDE USING gist` davranışıyla aynı sonucu üretsin.
 */
class InMemoryAssignmentRepository implements AssignmentRepository {
  private rows: AssignmentRow[] = [];
  private nextId = 1;

  seed(row: Partial<AssignmentRow> & Pick<AssignmentRow, 'employee_id' | 'baslangic_tarihi' | 'bitis_tarihi'>): AssignmentRow {
    const full: AssignmentRow = {
      id: `seed-${this.nextId++}`,
      project_id: row.project_id ?? 'proje-1',
      work_package_id: row.work_package_id ?? 'is-paketi-1',
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
      (r) =>
        r.employee_id === employeeId &&
        r.id !== excludeId &&
        r.baslangic_tarihi <= bitis &&
        r.bitis_tarihi >= baslangic,
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

const EMPLOYEE_A = '11111111-1111-1111-1111-111111111111';
const EMPLOYEE_B = '22222222-2222-2222-2222-222222222222';

describe('checkAssignmentConflict', () => {
  let repo: InMemoryAssignmentRepository;

  beforeEach(() => {
    repo = new InMemoryAssignmentRepository();
  });

  it('mevcut atama yokken hasConflict:false döner', async () => {
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' },
      repo,
    );
    expect(result.hasConflict).toBe(false);
    expect(result.conflictingAssignments).toHaveLength(0);
  });

  it('tarih aralığı TAM ÖRTÜŞÜYORSA çakışma bildirir', async () => {
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' },
      repo,
    );
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAssignments).toHaveLength(1);
  });

  it('tarih aralığı KISMEN örtüşüyorsa (uçtan uca değil, ortadan) çakışma bildirir', async () => {
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-05', bitisTarihi: '2026-09-15' },
      repo,
    );
    expect(result.hasConflict).toBe(true);
  });

  it('tarih aralığı ARDIŞIK ama örtüşmüyorsa (bitis == yeni baslangic - 1 gün) çakışma bildirmez', async () => {
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-11', bitisTarihi: '2026-09-20' },
      repo,
    );
    expect(result.hasConflict).toBe(false);
  });

  it('FARKLI bir personelin aynı tarih aralığı çakışma SAYILMAZ', async () => {
    repo.seed({ employee_id: EMPLOYEE_B, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10' },
      repo,
    );
    expect(result.hasConflict).toBe(false);
  });

  it('excludeAssignmentId verilirse o atamayla olan "çakışma" göz ardı edilir (Day 11+ düzenleme senaryosu)', async () => {
    const existing = repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-10' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-10', excludeAssignmentId: existing.id },
      repo,
    );
    expect(result.hasConflict).toBe(false);
  });

  it('bitisTarihi, baslangicTarihi\'nden önceyse ValidationError fırlatır', async () => {
    await expect(
      checkAssignmentConflict({ employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-10', bitisTarihi: '2026-09-01' }, repo),
    ).rejects.toThrow(/baslangicTarihi/);
  });

  it('birden fazla çakışan atama varsa HEPSİNİ döner', async () => {
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-01', bitis_tarihi: '2026-09-05' });
    repo.seed({ employee_id: EMPLOYEE_A, baslangic_tarihi: '2026-09-20', bitis_tarihi: '2026-09-25' });
    const result = await checkAssignmentConflict(
      { employeeId: EMPLOYEE_A, baslangicTarihi: '2026-09-01', bitisTarihi: '2026-09-30' },
      repo,
    );
    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAssignments).toHaveLength(2);
  });
});
