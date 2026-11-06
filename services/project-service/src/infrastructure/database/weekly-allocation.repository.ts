import type { SupabaseClient } from '@supabase/supabase-js';

export interface WeeklyAllocationRow {
  id: string;
  project_id: string;
  team_id: string;
  hafta_no: number;
  planlanan_sure_hafta: number;
}

export interface WeeklyAllocationRepository {
  listByProject(projectId: string): Promise<WeeklyAllocationRow[]>;
  totalForTeam(projectId: string, teamId: string): Promise<number>;
  upsert(projectId: string, teamId: string, haftaNo: number, planlananSureHafta: number): Promise<WeeklyAllocationRow>;
}

export class SupabaseWeeklyAllocationRepository implements WeeklyAllocationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByProject(projectId: string): Promise<WeeklyAllocationRow[]> {
    const { data, error } = await this.db
      .from('project_team_weekly_allocation')
      .select('*')
      .eq('project_id', projectId)
      .order('hafta_no');
    if (error) throw error;
    return (data ?? []) as WeeklyAllocationRow[];
  }

  async totalForTeam(projectId: string, teamId: string): Promise<number> {
    const { data, error } = await this.db
      .from('project_team_weekly_allocation')
      .select('planlanan_sure_hafta')
      .eq('project_id', projectId)
      .eq('team_id', teamId);
    if (error) throw error;
    return (data ?? []).reduce((sum, r) => sum + Number(r.planlanan_sure_hafta), 0);
  }

  async upsert(
    projectId: string,
    teamId: string,
    haftaNo: number,
    planlananSureHafta: number,
  ): Promise<WeeklyAllocationRow> {
    const { data, error } = await this.db
      .from('project_team_weekly_allocation')
      .upsert(
        { project_id: projectId, team_id: teamId, hafta_no: haftaNo, planlanan_sure_hafta: planlananSureHafta },
        { onConflict: 'project_id,team_id,hafta_no' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return data as WeeklyAllocationRow;
  }
}
