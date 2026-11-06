import type { SupabaseClient } from '@supabase/supabase-js';

/** Day 1'de tanımlanan arayüz; Day 2'de Supabase implementasyonu eklendi. */
export interface EmployeeRow {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  ise_baslama_tarihi: string;
  maas_tl: number;
  durum: 'active' | 'inactive';
  olusturan_id: string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeRow {
  ad: string;
  soyad: string;
  email: string;
  ise_baslama_tarihi: string;
  maas_tl: number;
  olusturan_id: string;
}

/**
 * Day 15 eklendi: roadmap.md satır 1471'de `PATCH /employees/:id (ik_yoneticisi)` Day 1'den beri
 * planlıydı ama hiç yazılmamıştı (bkz. docs/testing/event-integration-audit.md — bu yüzden
 * `employee.updated` event'inin tetiklenecek hiçbir yolu yoktu). `durum` KASITLI OLARAK burada
 * YOK — o alan sadece `PATCH /employees/:id/deactivate` (deactivate-employee.usecase.ts) ile
 * değişir, Kural #9 gereği ("silme YOK, sadece inactive") tek yönlü bir geçiş.
 */
export interface UpdateEmployeeRow {
  ad?: string;
  soyad?: string;
  email?: string;
  maas_tl?: number;
}

export interface EmployeeRepository {
  findAll(filters: { durum?: string }): Promise<EmployeeRow[]>;
  findById(id: string): Promise<EmployeeRow | null>;
  create(data: CreateEmployeeRow): Promise<EmployeeRow>;
  update(id: string, data: UpdateEmployeeRow): Promise<EmployeeRow>;
  deactivate(id: string): Promise<void>;
}

export class SupabaseEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: SupabaseClient) {}

  async findAll(filters: { durum?: string }): Promise<EmployeeRow[]> {
    let query = this.db.from('personnel_employees').select('*').order('ad');
    if (filters.durum) query = query.eq('durum', filters.durum);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EmployeeRow[];
  }

  async findById(id: string): Promise<EmployeeRow | null> {
    const { data, error } = await this.db
      .from('personnel_employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as EmployeeRow | null;
  }

  async create(data: CreateEmployeeRow): Promise<EmployeeRow> {
    const { data: row, error } = await this.db
      .from('personnel_employees')
      .insert(data)
      .select('*')
      .single();
    if (error) throw error;
    return row as EmployeeRow;
  }

  async update(id: string, data: UpdateEmployeeRow): Promise<EmployeeRow> {
    const { data: row, error } = await this.db
      .from('personnel_employees')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return row as EmployeeRow;
  }

  async deactivate(id: string): Promise<void> {
    const { error } = await this.db
      .from('personnel_employees')
      .update({ durum: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
}
