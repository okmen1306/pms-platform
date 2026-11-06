import type { SupabaseClient } from '@supabase/supabase-js';

export interface AssignmentRow {
  id: string;
  project_id: string;
  work_package_id: string;
  sub_work_package_id: string | null;
  employee_id: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  tamamlandi_mi: boolean;
  tamamlanma_tarihi: string | null;
  created_at: string;
}

export interface CreateAssignmentRow {
  project_id: string;
  work_package_id: string;
  sub_work_package_id?: string | null;
  employee_id: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
}

/** Postgres exclusion_violation SQLSTATE (bkz. 003_project_tables.sql EXCLUDE USING gist). */
export const POSTGRES_EXCLUSION_VIOLATION = '23P01';

export interface AssignmentRepository {
  create(data: CreateAssignmentRow): Promise<AssignmentRow>;
  findById(id: string): Promise<AssignmentRow | null>;
  findByProject(projectId: string, filters?: { employeeId?: string }): Promise<AssignmentRow[]>;
  /** Day 20: personelin TÜM projelerdeki atamaları (opsiyonel tarih aralığıyla kesişenler). */
  findByEmployee(employeeId: string, range?: { from?: string; to?: string }): Promise<AssignmentRow[]>;
  /** Bir personelin, verilen tarih aralığıyla ÇAKIŞAN diğer atamalarını bulur (409 mesajı için). */
  findOverlapping(employeeId: string, baslangic: string, bitis: string, excludeId?: string): Promise<AssignmentRow[]>;
  markComplete(id: string, tamamlanmaTarihi: string): Promise<AssignmentRow>;
}

export class SupabaseAssignmentRepository implements AssignmentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(data: CreateAssignmentRow): Promise<AssignmentRow> {
    const { data: row, error } = await this.db
      .from('project_personnel_assignments')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error; // 23P01 ise use-case bunu yakalayıp ConflictAssignmentError'a çevirir
    return row as AssignmentRow;
  }

  async findById(id: string): Promise<AssignmentRow | null> {
    const { data, error } = await this.db
      .from('project_personnel_assignments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as AssignmentRow | null;
  }

  async findByProject(projectId: string, filters: { employeeId?: string } = {}): Promise<AssignmentRow[]> {
    let query = this.db
      .from('project_personnel_assignments')
      .select('*')
      .eq('project_id', projectId)
      .order('baslangic_tarihi');
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AssignmentRow[];
  }

  async findByEmployee(employeeId: string, range: { from?: string; to?: string } = {}): Promise<AssignmentRow[]> {
    let query = this.db
      .from('project_personnel_assignments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('baslangic_tarihi');
    // Aralıkla KESİŞEN atamalar: atama.bitis >= from  VE  atama.baslangic <= to
    if (range.from) query = query.gte('bitis_tarihi', range.from);
    if (range.to) query = query.lte('baslangic_tarihi', range.to);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AssignmentRow[];
  }

  async findOverlapping(
    employeeId: string,
    baslangic: string,
    bitis: string,
    excludeId?: string,
  ): Promise<AssignmentRow[]> {
    let query = this.db
      .from('project_personnel_assignments')
      .select('*')
      .eq('employee_id', employeeId)
      .lte('baslangic_tarihi', bitis)
      .gte('bitis_tarihi', baslangic);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as AssignmentRow[];
  }

  async markComplete(id: string, tamamlanmaTarihi: string): Promise<AssignmentRow> {
    const { data, error } = await this.db
      .from('project_personnel_assignments')
      .update({ tamamlandi_mi: true, tamamlanma_tarihi: tamamlanmaTarihi })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as AssignmentRow;
  }
}
