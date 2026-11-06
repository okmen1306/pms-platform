import type { SupabaseClient } from '@supabase/supabase-js';

export interface MaterialRow {
  id: string;
  project_id: string;
  malzeme_turu: string;
  malzeme_adi: string;
  teknik_ozellik: string | null;
  adet: number;
  birim_fiyat: number;
  alim_tarihi: string;
  alim_dolar_kuru: number;
  kur_manuel_override: boolean;
  toplam_tl: number;
  toplam_usd: number;
  olusturan_id: string;
  created_at: string;
}

export interface CreateMaterialRow {
  project_id: string;
  malzeme_turu: string;
  malzeme_adi: string;
  teknik_ozellik?: string | null;
  adet: number;
  birim_fiyat: number;
  alim_tarihi: string;
  alim_dolar_kuru: number;
  kur_manuel_override?: boolean;
  olusturan_id: string;
}

export interface MaterialRepository {
  listByProject(projectId: string): Promise<MaterialRow[]>;
  create(data: CreateMaterialRow): Promise<MaterialRow>;
  updateRate(id: string, newRate: number): Promise<MaterialRow>;
}

export class SupabaseMaterialRepository implements MaterialRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByProject(projectId: string): Promise<MaterialRow[]> {
    const { data, error } = await this.db
      .from('procurement_materials')
      .select('*')
      .eq('project_id', projectId)
      .order('alim_tarihi', { ascending: false });
    if (error) throw error;
    return (data ?? []) as MaterialRow[];
  }

  async create(data: CreateMaterialRow): Promise<MaterialRow> {
    const { data: row, error } = await this.db
      .from('procurement_materials')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as MaterialRow;
  }

  async updateRate(id: string, newRate: number): Promise<MaterialRow> {
    const { data: row, error } = await this.db
      .from('procurement_materials')
      .update({ alim_dolar_kuru: newRate, kur_manuel_override: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as MaterialRow;
  }
}
