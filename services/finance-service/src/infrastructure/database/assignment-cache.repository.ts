import type { SupabaseClient } from '@supabase/supabase-js';

export interface CachedAssignmentRow {
  assignment_id: string;
  project_id: string;
  employee_id: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
}

export interface ProjectMetaRow {
  project_id: string;
  baslangic_tarihi: string;
  sure_hafta: number;
}

export interface AssignmentCacheRepository {
  upsertAssignment(row: CachedAssignmentRow): Promise<void>;
  /** Bir personelin TÜM projelerdeki (event-carried) atamaları — bölme kuralı hesabı için. */
  findByEmployee(employeeId: string): Promise<CachedAssignmentRow[]>;
  upsertProjectMeta(row: ProjectMetaRow): Promise<void>;
  findProjectMeta(projectId: string): Promise<ProjectMetaRow | null>;
}

export class SupabaseAssignmentCacheRepository implements AssignmentCacheRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertAssignment(row: CachedAssignmentRow): Promise<void> {
    const { error } = await this.db
      .from('finance_assignment_read_cache')
      .upsert(row, { onConflict: 'assignment_id' });
    if (error) throw error;
  }

  async findByEmployee(employeeId: string): Promise<CachedAssignmentRow[]> {
    const { data, error } = await this.db
      .from('finance_assignment_read_cache')
      .select('*')
      .eq('employee_id', employeeId);
    if (error) throw error;
    return (data ?? []) as CachedAssignmentRow[];
  }

  async upsertProjectMeta(row: ProjectMetaRow): Promise<void> {
    const { error } = await this.db
      .from('finance_project_meta_cache')
      .upsert(row, { onConflict: 'project_id' });
    if (error) throw error;
  }

  async findProjectMeta(projectId: string): Promise<ProjectMetaRow | null> {
    const { data, error } = await this.db
      .from('finance_project_meta_cache')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw error;
    return data as ProjectMetaRow | null;
  }
}
