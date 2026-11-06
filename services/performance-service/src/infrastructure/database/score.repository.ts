import type { SupabaseClient } from '@supabase/supabase-js';

/** Day 1'de tanımlanan arayüz; Day 2'de Supabase implementasyonu eklendi. */
export interface CriterionRow {
  id: string;
  ad: string;
  agirlik_yuzdesi: number;
  aktif: boolean;
}

export interface EmployeeScoreInput {
  project_id: string;
  employee_id: string;
  criterion_id: string;
  puan: number;
  veren_id: string;
}

export interface EmployeeScoreRow {
  id: string;
  project_id: string;
  employee_id: string;
  criterion_id: string;
  puan: number;
  veren_id: string;
  verilme_tarihi: string;
}

/**
 * TL (Day 12): "performance endeks hesaplama finalize (B3 ile)". `performance_team_lead_scores`
 * (Day 1'den beri şemada) — sirket_yoneticisi'nin ekip_lideri'ni puanlaması. `updated_by`/
 * `updated_at` DÜZENLEME (override) için (roadmap.md Bölüm 8: `PATCH /team-leads/:leadId/
 * scores/:scoreId`).
 */
export interface TeamLeadScoreInput {
  project_id: string;
  ekip_lideri_id: string;
  criterion_id: string;
  puan: number;
  veren_yonetici_id: string;
}

export interface TeamLeadScoreRow {
  id: string;
  project_id: string;
  ekip_lideri_id: string;
  criterion_id: string;
  puan: number;
  veren_yonetici_id: string;
  updated_by: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface EmployeeIndexRow {
  employee_id: string;
  project_id: string;
  endeks_puani: number;
  guncelleme: string;
}

/**
 * Uzman İnisiyatifi (TL, Day 12): roadmap.md'nin şemasında `performance_team_indices.team_id`
 * için ayrı bir "takım/üyelik" tablosu YOK — `project_projects.ekip_lideri_id` projede TEK bir
 * kişi (FK değil, düz UUID, bkz. roadmap.md satır 88) ve `weekly_allocations.team_id` (Day 6)
 * tamamen AYRI, üyeliksiz bir kapasite-planlama etiketi (personele bağlanmıyor). Bu ikisi
 * arasında güvenilir bir eşleme YOK. Bu yüzden burada `team_id = ekip_lideri_id` kabul edildi —
 * yani "takım endeksi", o projenin ekip liderinin aldığı puanların endeksidir (basit ve
 * roadmap'in "puan x ağırlık toplamı" tanımıyla tutarlı; TeamPerformancePage Day 14'te bunu
 * tüketecek).
 */
export interface TeamIndexRow {
  team_id: string;
  project_id: string;
  endeks_puani: number;
  guncelleme: string;
}

export interface PerformanceScoreRepository {
  listCriteria(): Promise<CriterionRow[]>;
  createCriterion(data: { ad: string; agirlik_yuzdesi: number }): Promise<CriterionRow>;
  totalActiveWeight(): Promise<number>;
  submitEmployeeScore(data: EmployeeScoreInput): Promise<EmployeeScoreRow>;
  /**
   * F2 (Day 10): "Performance tamamlama" — EmployeePerformancePage'in ihtiyaç duyduğu okuma
   * ucu. Day 3'ten beri sadece YAZMA (submitEmployeeScore) vardı, hiç okuma yolu yoktu.
   */
  listScoresByEmployee(projectId: string, employeeId: string): Promise<EmployeeScoreRow[]>;

  submitTeamLeadScore(data: TeamLeadScoreInput): Promise<TeamLeadScoreRow>;
  overrideTeamLeadScore(scoreId: string, puan: number, updatedBy: string): Promise<TeamLeadScoreRow | null>;
  findTeamLeadScoreById(scoreId: string): Promise<TeamLeadScoreRow | null>;
  listTeamLeadScores(projectId: string, ekipLideriId: string): Promise<TeamLeadScoreRow[]>;

  upsertEmployeeIndex(projectId: string, employeeId: string, endeksPuani: number): Promise<EmployeeIndexRow>;
  upsertTeamIndex(projectId: string, teamId: string, endeksPuani: number): Promise<TeamIndexRow>;
  listEmployeeIndicesByProject(projectId: string): Promise<EmployeeIndexRow[]>;
  listTeamIndicesByProject(projectId: string): Promise<TeamIndexRow[]>;
  /** `GET /employees/:id/performance-index` ("kendi endeksi") — TÜM projelerdeki satırlar. */
  listEmployeeIndicesByEmployee(employeeId: string): Promise<EmployeeIndexRow[]>;
}

export class SupabasePerformanceScoreRepository implements PerformanceScoreRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listCriteria(): Promise<CriterionRow[]> {
    const { data, error } = await this.db
      .from('performance_criteria')
      .select('*')
      .eq('aktif', true)
      .order('ad');
    if (error) throw error;
    return (data ?? []) as CriterionRow[];
  }

  async createCriterion(data: { ad: string; agirlik_yuzdesi: number }): Promise<CriterionRow> {
    const { data: row, error } = await this.db
      .from('performance_criteria')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as CriterionRow;
  }

  async totalActiveWeight(): Promise<number> {
    const rows = await this.listCriteria();
    return rows.reduce((sum, r) => sum + Number(r.agirlik_yuzdesi), 0);
  }

  async submitEmployeeScore(data: EmployeeScoreInput): Promise<EmployeeScoreRow> {
    const { data: row, error } = await this.db
      .from('performance_employee_scores')
      .upsert(data, { onConflict: 'project_id,employee_id,criterion_id' })
      .select('*')
      .single();
    if (error) throw error;
    return row as EmployeeScoreRow;
  }

  async listScoresByEmployee(projectId: string, employeeId: string): Promise<EmployeeScoreRow[]> {
    const { data, error } = await this.db
      .from('performance_employee_scores')
      .select('*')
      .eq('project_id', projectId)
      .eq('employee_id', employeeId);
    if (error) throw error;
    return (data ?? []) as EmployeeScoreRow[];
  }

  async submitTeamLeadScore(data: TeamLeadScoreInput): Promise<TeamLeadScoreRow> {
    const { data: row, error } = await this.db
      .from('performance_team_lead_scores')
      .upsert(data, { onConflict: 'project_id,ekip_lideri_id,criterion_id' })
      .select('*')
      .single();
    if (error) throw error;
    return row as TeamLeadScoreRow;
  }

  async overrideTeamLeadScore(scoreId: string, puan: number, updatedBy: string): Promise<TeamLeadScoreRow | null> {
    const { data, error } = await this.db
      .from('performance_team_lead_scores')
      .update({ puan, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq('id', scoreId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return data as TeamLeadScoreRow | null;
  }

  async findTeamLeadScoreById(scoreId: string): Promise<TeamLeadScoreRow | null> {
    const { data, error } = await this.db.from('performance_team_lead_scores').select('*').eq('id', scoreId).maybeSingle();
    if (error) throw error;
    return data as TeamLeadScoreRow | null;
  }

  async listTeamLeadScores(projectId: string, ekipLideriId: string): Promise<TeamLeadScoreRow[]> {
    const { data, error } = await this.db
      .from('performance_team_lead_scores')
      .select('*')
      .eq('project_id', projectId)
      .eq('ekip_lideri_id', ekipLideriId);
    if (error) throw error;
    return (data ?? []) as TeamLeadScoreRow[];
  }

  async upsertEmployeeIndex(projectId: string, employeeId: string, endeksPuani: number): Promise<EmployeeIndexRow> {
    const { data, error } = await this.db
      .from('performance_employee_indices')
      .upsert(
        { project_id: projectId, employee_id: employeeId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() },
        { onConflict: 'employee_id,project_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as EmployeeIndexRow;
  }

  async upsertTeamIndex(projectId: string, teamId: string, endeksPuani: number): Promise<TeamIndexRow> {
    const { data, error } = await this.db
      .from('performance_team_indices')
      .upsert(
        { project_id: projectId, team_id: teamId, endeks_puani: endeksPuani, guncelleme: new Date().toISOString() },
        { onConflict: 'team_id,project_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as TeamIndexRow;
  }

  async listEmployeeIndicesByProject(projectId: string): Promise<EmployeeIndexRow[]> {
    const { data, error } = await this.db.from('performance_employee_indices').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as EmployeeIndexRow[];
  }

  async listTeamIndicesByProject(projectId: string): Promise<TeamIndexRow[]> {
    const { data, error } = await this.db.from('performance_team_indices').select('*').eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as TeamIndexRow[];
  }

  async listEmployeeIndicesByEmployee(employeeId: string): Promise<EmployeeIndexRow[]> {
    const { data, error } = await this.db.from('performance_employee_indices').select('*').eq('employee_id', employeeId);
    if (error) throw error;
    return (data ?? []) as EmployeeIndexRow[];
  }
}
