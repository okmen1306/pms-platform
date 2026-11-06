import type { SupabaseClient } from '@supabase/supabase-js';

export interface WorkDraftCellRow {
  id: string;
  project_id: string;
  work_package_id: string;
  hafta_no: number;
  boyali: boolean;
  created_by: string;
  created_at: string;
}

export interface UpsertWorkDraftCellRow {
  project_id: string;
  work_package_id: string;
  hafta_no: number;
  boyali: boolean;
  created_by: string;
}

export interface WorkDraftRepository {
  upsertCell(row: UpsertWorkDraftCellRow): Promise<WorkDraftCellRow>;
  findByProject(projectId: string): Promise<WorkDraftCellRow[]>;
}

export class SupabaseWorkDraftRepository implements WorkDraftRepository {
  constructor(private readonly db: SupabaseClient) {}

  async upsertCell(row: UpsertWorkDraftCellRow): Promise<WorkDraftCellRow> {
    const { data, error } = await this.db
      .from('project_work_drafts')
      .upsert(row, { onConflict: 'project_id,work_package_id,hafta_no' })
      .select('*')
      .single();
    if (error) throw error;
    return data as WorkDraftCellRow;
  }

  async findByProject(projectId: string): Promise<WorkDraftCellRow[]> {
    const { data, error } = await this.db
      .from('project_work_drafts')
      .select('*')
      .eq('project_id', projectId)
      .order('hafta_no', { ascending: true });
    if (error) throw error;
    return (data ?? []) as WorkDraftCellRow[];
  }
}
