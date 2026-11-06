import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProjectRow {
  id: string;
  proje_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  sure_hafta: number;
  product_group_id: string;
  product_id: string;
  durum: 'yeni' | 'devam_ediyor' | 'tamamlandi' | 'musteri_talepli_guncelleme';
  ekip_lideri_id: string;
  tahmini_maliyet_tl: number | null;
  satis_fiyati_tl: number | null;
  danismanlik_maliyeti_tl: number;
  paketleme_gonderim_maliyeti_tl: number;
  idari_maliyet_orani: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRow {
  proje_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  sure_hafta: number;
  product_group_id: string;
  product_id: string;
  ekip_lideri_id: string;
  tahmini_maliyet_tl?: number;
  satis_fiyati_tl?: number;
  danismanlik_maliyeti_tl?: number;
  paketleme_gonderim_maliyeti_tl?: number;
  idari_maliyet_orani?: number;
  created_by: string;
}

export interface ProjectRepository {
  findAll(filters: { durum?: string; ekipLideriId?: string }): Promise<ProjectRow[]>;
  findById(id: string): Promise<ProjectRow | null>;
  create(data: CreateProjectRow): Promise<ProjectRow>;
  update(id: string, data: Partial<CreateProjectRow>): Promise<ProjectRow>;
}

export class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters: { durum?: string; ekipLideriId?: string }): Promise<ProjectRow[]> {
    let query = this.db.from('project_projects').select('*').order('created_at', { ascending: false });
    if (filters.durum) query = query.eq('durum', filters.durum);
    if (filters.ekipLideriId) query = query.eq('ekip_lideri_id', filters.ekipLideriId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ProjectRow[];
  }

  async findById(id: string): Promise<ProjectRow | null> {
    const { data, error } = await this.db.from('project_projects').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as ProjectRow | null;
  }

  async create(data: CreateProjectRow): Promise<ProjectRow> {
    const { data: row, error } = await this.db.from('project_projects').insert(data).select('*').single();
    if (error) throw error;
    return row as ProjectRow;
  }

  async update(id: string, data: Partial<CreateProjectRow>): Promise<ProjectRow> {
    const { data: row, error } = await this.db
      .from('project_projects')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as ProjectRow;
  }
}
