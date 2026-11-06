import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectProgressRow {
  id: string;
  project_id: string;
  work_package_id: string | null;
  employee_id: string | null;
  tamamlanma_yuzdesi: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  guncelleme_zamani: string;
}

export interface WorkloadSnapshotRow {
  id: string;
  employee_id: string;
  hafta_no: number;
  project_id: string;
  work_package_id: string;
  guncelleme: string;
}

export interface ProjectPlannerSnapshotRow {
  project_id: string;
  proje_adi: string;
  planlanan_baslangic: string | null;
  planlanan_sure_hafta: number | null;
  fiili_baslangic: string | null;
  fiili_sure_hafta: number | null;
  tamamlanma_yuzdesi: number | null;
  guncelleme: string;
}

/**
 * B3 (Day 10): "CQRS şeması + ilk consumer'lar". Roadmap'in dosya ağacında TEK bir
 * `report.repository.ts` planlanmış (3 farklı repository DEĞİL) — reporting-service'in "okuma
 * modeli" tek bir bütün olarak düşünüldüğü için (bkz. Bölüm 4.10 başlığı: "CQRS okuma modeli").
 */
export interface ReportRepository {
  upsertPlannerSnapshot(row: {
    project_id: string;
    proje_adi: string;
    planlanan_baslangic: string | null;
    planlanan_sure_hafta: number | null;
  }): Promise<ProjectPlannerSnapshotRow>;

  findPlannerSnapshot(projectId: string): Promise<ProjectPlannerSnapshotRow | null>;

  upsertProgress(row: {
    project_id: string;
    work_package_id: string | null;
    employee_id: string | null;
    tamamlanma_yuzdesi: number;
    baslangic_tarihi?: string | null;
    bitis_tarihi?: string | null;
  }): Promise<ProjectProgressRow>;

  insertWorkloadSnapshot(rows: { employee_id: string; hafta_no: number; project_id: string; work_package_id: string }[]): Promise<void>;

  /**
   * B3 (Day 11): "tamamlanma endpoint'i" için eklendi — `completion-report.controller.ts` +
   * `build-completion-summary.usecase.ts` bu iki metotla besleniyor (roadmap.md dosya ağacı,
   * satır ~1090). NOT: `upsertPlannerSnapshot` yalnız `project.created` event'inde çağrıldığı ve
   * `tamamlanma_yuzdesi`'ni HER ZAMAN 0'a sabitlediği için (bkz. yukarısı, satır 72), bu alan
   * proje ömrü boyunca hiç güncellenmiyordu — B2 desteğiyle bulunan gerçek bir hata (bkz.
   * CHANGELOG.md Day 11). `updatePlannerCompletion` bu boşluğu SADECE UPDATE ile kapatır (snapshot
   * henüz yoksa — race condition — sessizce 0 satır etkiler, insertWorkloadSnapshot'taki AYNI
   * tolerans deseni).
   */
  listProgressByProject(projectId: string): Promise<ProjectProgressRow[]>;
  updatePlannerCompletion(projectId: string, tamamlanmaYuzdesi: number): Promise<void>;

  /**
   * B3 (Day 12): "work-detail" endpoint'i için — `insertWorkloadSnapshot` Day 10'dan beri
   * SADECE yazıyordu, hiç okuma yolu yoktu (audit.repository.ts'teki (Day 9→11) AYNI boşluk).
   */
  listWorkloadByProject(projectId: string): Promise<WorkloadSnapshotRow[]>;
}

export class SupabaseReportRepository implements ReportRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertPlannerSnapshot(row: {
    project_id: string;
    proje_adi: string;
    planlanan_baslangic: string | null;
    planlanan_sure_hafta: number | null;
  }): Promise<ProjectPlannerSnapshotRow> {
    const { data, error } = await this.db
      .from('reporting_project_planner_snapshot')
      .upsert({ ...row, tamamlanma_yuzdesi: 0, guncelleme: new Date().toISOString() }, { onConflict: 'project_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProjectPlannerSnapshotRow;
  }

  async findPlannerSnapshot(projectId: string): Promise<ProjectPlannerSnapshotRow | null> {
    const { data, error } = await this.db.from('reporting_project_planner_snapshot').select('*').eq('project_id', projectId).maybeSingle();
    if (error) throw error;
    return data as ProjectPlannerSnapshotRow | null;
  }

  async upsertProgress(row: {
    project_id: string;
    work_package_id: string | null;
    employee_id: string | null;
    tamamlanma_yuzdesi: number;
    baslangic_tarihi?: string | null;
    bitis_tarihi?: string | null;
  }): Promise<ProjectProgressRow> {
    const { data, error } = await this.db
      .from('reporting_project_progress')
      .upsert({ ...row, guncelleme_zamani: new Date().toISOString() }, { onConflict: 'project_id,work_package_id,employee_id' })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProjectProgressRow;
  }

  async insertWorkloadSnapshot(rows: { employee_id: string; hafta_no: number; project_id: string; work_package_id: string }[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.db.from('reporting_workload_snapshot').insert(rows);
    if (error) throw error;
  }

  async listProgressByProject(projectId: string): Promise<ProjectProgressRow[]> {
    const { data, error } = await this.db.from('reporting_project_progress').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as ProjectProgressRow[];
  }

  async updatePlannerCompletion(projectId: string, tamamlanmaYuzdesi: number): Promise<void> {
    const { error } = await this.db
      .from('reporting_project_planner_snapshot')
      .update({ tamamlanma_yuzdesi: tamamlanmaYuzdesi, guncelleme: new Date().toISOString() })
      .eq('project_id', projectId);
    if (error) throw error;
  }

  async listWorkloadByProject(projectId: string): Promise<WorkloadSnapshotRow[]> {
    const { data, error } = await this.db.from('reporting_workload_snapshot').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as WorkloadSnapshotRow[];
  }
}
