import type { SupabaseClient } from '@supabase/supabase-js';

export interface MilestoneRow {
  id: string;
  project_id: string;
  tarih: string;
  baslik: string;
  aciklama: string | null;
  email_gonderilsin: boolean;
  hedef_gruplar: string[];
  created_by: string;
  created_at: string;
}

export interface CreateMilestoneRow {
  project_id: string;
  tarih: string;
  baslik: string;
  aciklama?: string | null;
  email_gonderilsin: boolean;
  hedef_gruplar: string[];
  created_by: string;
}

export interface MilestoneRepository {
  create(row: CreateMilestoneRow): Promise<MilestoneRow>;
  findByProject(projectId: string): Promise<MilestoneRow[]>;
}

export class SupabaseMilestoneRepository implements MilestoneRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(row: CreateMilestoneRow): Promise<MilestoneRow> {
    const { data, error } = await this.db.from('project_milestones').insert(row).select('*').single();
    if (error) throw error;
    return data as MilestoneRow;
  }

  async findByProject(projectId: string): Promise<MilestoneRow[]> {
    // Kural (docs/roadmap.md Bölüm 4.4, "Zaman Çizelgesi"): tarih sırasına göre gösterilir —
    // en yakın kilometre taşı ilk sırada olacak şekilde.
    const { data, error } = await this.db
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('tarih', { ascending: true });
    if (error) throw error;
    return (data ?? []) as MilestoneRow[];
  }
}
