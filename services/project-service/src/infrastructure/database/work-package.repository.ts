import type { SupabaseClient } from '@supabase/supabase-js';

export interface MasterWorkPackageRow {
  id: number;
  sira_no: number;
  ad: string;
  ust_id: number | null;
}

export interface WorkPackageRow {
  id: string;
  project_id: string;
  master_work_package_id: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  kalite_puani: number | null;
}

export interface SubWorkPackageRow {
  id: string;
  work_package_id: string;
  ad: string;
  baslangic_hafta: number;
  bitis_hafta: number;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
  created_by: string;
}

export interface WorkPackageRepository {
  listMasterPackages(): Promise<MasterWorkPackageRow[]>;
  listByProject(projectId: string): Promise<WorkPackageRow[]>;
  findWorkPackageById(id: string): Promise<WorkPackageRow | null>;
  createWorkPackage(data: {
    project_id: string;
    master_work_package_id: number;
    baslangic_tarihi?: string | null;
    bitis_tarihi?: string | null;
  }): Promise<WorkPackageRow>;
  createSubWorkPackage(data: {
    work_package_id: string;
    ad: string;
    baslangic_hafta: number;
    bitis_hafta: number;
    created_by: string;
  }): Promise<SubWorkPackageRow>;
  updateSubWorkPackage(id: string, data: Partial<{ ad: string; baslangic_hafta: number; bitis_hafta: number }>): Promise<SubWorkPackageRow>;
  deleteSubWorkPackage(id: string): Promise<void>;
  listSubWorkPackages(workPackageId: string): Promise<SubWorkPackageRow[]>;
}

export class SupabaseWorkPackageRepository implements WorkPackageRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listMasterPackages(): Promise<MasterWorkPackageRow[]> {
    const { data, error } = await this.db
      .from('project_master_work_packages')
      .select('*')
      .order('sira_no');
    if (error) throw error;
    return (data ?? []) as MasterWorkPackageRow[];
  }

  /** Madde: iş paketleri üst kırılımlarla sistemde mevcut olacak; ekip lideri tüm iş paketlerini
   * seçmek zorunda değil (bkz. project_work_packages, sadece SEÇİLENLER burada satır olarak yer alır). */
  async listByProject(projectId: string): Promise<WorkPackageRow[]> {
    const { data, error } = await this.db
      .from('project_work_packages')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    return (data ?? []) as WorkPackageRow[];
  }

  async findWorkPackageById(id: string): Promise<WorkPackageRow | null> {
    const { data, error } = await this.db
      .from('project_work_packages')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as WorkPackageRow | null;
  }

  async createWorkPackage(data: {
    project_id: string;
    master_work_package_id: number;
    baslangic_tarihi?: string | null;
    bitis_tarihi?: string | null;
  }): Promise<WorkPackageRow> {
    const { data: row, error } = await this.db
      .from('project_work_packages')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as WorkPackageRow;
  }

  async createSubWorkPackage(data: {
    work_package_id: string;
    ad: string;
    baslangic_hafta: number;
    bitis_hafta: number;
    created_by: string;
  }): Promise<SubWorkPackageRow> {
    const { data: row, error } = await this.db
      .from('project_sub_work_packages')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as SubWorkPackageRow;
  }

  async updateSubWorkPackage(
    id: string,
    data: Partial<{ ad: string; baslangic_hafta: number; bitis_hafta: number }>,
  ): Promise<SubWorkPackageRow> {
    const { data: row, error } = await this.db
      .from('project_sub_work_packages')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as SubWorkPackageRow;
  }

  async deleteSubWorkPackage(id: string): Promise<void> {
    const { error } = await this.db.from('project_sub_work_packages').delete().eq('id', id);
    if (error) throw error;
  }

  async listSubWorkPackages(workPackageId: string): Promise<SubWorkPackageRow[]> {
    const { data, error } = await this.db
      .from('project_sub_work_packages')
      .select('*')
      .eq('work_package_id', workPackageId)
      .order('baslangic_hafta');
    if (error) throw error;
    return (data ?? []) as SubWorkPackageRow[];
  }
}
