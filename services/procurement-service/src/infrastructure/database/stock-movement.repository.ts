import type { SupabaseClient } from '@supabase/supabase-js';

export interface StockMovementRow {
  id: string;
  material_id: string;
  hareket_tipi: 'giris' | 'cikis';
  miktar: number;
  aciklama: string | null;
  created_at: string;
}

export interface StockMovementRepository {
  listByMaterial(materialId: string): Promise<StockMovementRow[]>;
  create(materialId: string, hareketTipi: 'giris' | 'cikis', miktar: number, aciklama?: string): Promise<StockMovementRow>;
  /** Malzeme için net stok: tüm girişler - tüm çıkışlar. */
  currentStock(materialId: string): Promise<number>;
}

export class SupabaseStockMovementRepository implements StockMovementRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listByMaterial(materialId: string): Promise<StockMovementRow[]> {
    const { data, error } = await this.db
      .from('procurement_stock_movements')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as StockMovementRow[];
  }

  async create(
    materialId: string,
    hareketTipi: 'giris' | 'cikis',
    miktar: number,
    aciklama?: string,
  ): Promise<StockMovementRow> {
    const { data, error } = await this.db
      .from('procurement_stock_movements')
      .insert({ material_id: materialId, hareket_tipi: hareketTipi, miktar, aciklama: aciklama ?? null })
      .select('*')
      .single();
    if (error) throw error;
    return data as StockMovementRow;
  }

  async currentStock(materialId: string): Promise<number> {
    const movements = await this.listByMaterial(materialId);
    return movements.reduce((total, m) => total + (m.hareket_tipi === 'giris' ? m.miktar : -m.miktar), 0);
  }
}
