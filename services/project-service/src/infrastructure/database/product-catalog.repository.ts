import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProductGroupRow {
  id: string;
  ad: string;
}

export interface ProductRow {
  id: string;
  ad: string;
  product_group_id: string;
}

/** Madde 1 (docs/roadmap.md): ürün grupları ve ürünler sisteme girilir, ürünler gruplarla ilişkilendirilir. */
export interface ProductCatalogRepository {
  listGroups(): Promise<ProductGroupRow[]>;
  createGroup(ad: string): Promise<ProductGroupRow>;
  listProducts(groupId?: string): Promise<ProductRow[]>;
  createProduct(ad: string, groupId: string): Promise<ProductRow>;
}

export class SupabaseProductCatalogRepository implements ProductCatalogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listGroups(): Promise<ProductGroupRow[]> {
    const { data, error } = await this.db.from('project_product_groups').select('*').order('ad');
    if (error) throw error;
    return (data ?? []) as ProductGroupRow[];
  }

  async createGroup(ad: string): Promise<ProductGroupRow> {
    const { data, error } = await this.db
      .from('project_product_groups')
      .insert({ ad })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProductGroupRow;
  }

  async listProducts(groupId?: string): Promise<ProductRow[]> {
    let query = this.db.from('project_products').select('*').order('ad');
    if (groupId) query = query.eq('product_group_id', groupId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ProductRow[];
  }

  async createProduct(ad: string, groupId: string): Promise<ProductRow> {
    const { data, error } = await this.db
      .from('project_products')
      .insert({ ad, product_group_id: groupId })
      .select('*')
      .single();
    if (error) throw error;
    return data as ProductRow;
  }
}
