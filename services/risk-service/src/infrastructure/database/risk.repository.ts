import type { SupabaseClient } from '@supabase/supabase-js';

export interface RiskRow {
  id: string;
  project_id: string;
  work_package_id: string | null;
  sub_work_package_id: string | null;
  risk_adi: string;
  aciklama: string | null;
  olasilik: number;
  etki: number;
  oncelik_puani: number;
  azaltma_stratejisi: string | null;
  durum: 'acik' | 'izleniyor' | 'kapandi';
  olusturan_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRiskInput {
  project_id: string;
  work_package_id?: string | null;
  sub_work_package_id?: string | null;
  risk_adi: string;
  aciklama?: string | null;
  olasilik: number;
  etki: number;
  azaltma_stratejisi?: string | null;
  olusturan_id: string;
}

export interface UpdateRiskInput {
  risk_adi?: string;
  aciklama?: string | null;
  olasilik?: number;
  etki?: number;
  azaltma_stratejisi?: string | null;
  durum?: 'acik' | 'izleniyor' | 'kapandi';
}

export interface RiskRepository {
  listByProject(projectId: string): Promise<RiskRow[]>;
  findById(id: string): Promise<RiskRow | null>;
  create(data: CreateRiskInput): Promise<RiskRow>;
  update(id: string, data: UpdateRiskInput): Promise<RiskRow>;
  delete(id: string): Promise<void>;
}

export class SupabaseRiskRepository implements RiskRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByProject(projectId: string): Promise<RiskRow[]> {
    const { data, error } = await this.db
      .from('risk_items')
      .select('*')
      .eq('project_id', projectId)
      .order('oncelik_puani', { ascending: false });
    if (error) throw error;
    return (data ?? []) as RiskRow[];
  }

  async findById(id: string): Promise<RiskRow | null> {
    const { data, error } = await this.db.from('risk_items').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as RiskRow | null;
  }

  async create(data: CreateRiskInput): Promise<RiskRow> {
    const { data: row, error } = await this.db.from('risk_items').insert(data).select('*').single();
    if (error) throw error;
    return row as RiskRow;
  }

  async update(id: string, data: UpdateRiskInput): Promise<RiskRow> {
    const { data: row, error } = await this.db
      .from('risk_items')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as RiskRow;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('risk_items').delete().eq('id', id);
    if (error) throw error;
  }
}
