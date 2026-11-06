import { apiFetch } from '../../shared/api';

/**
 * Day 18 (Entegrasyon Haftası): personnel.api.ts ile AYNI dönüşüm — Day 4'ten beri
 * procurement-service'e doğrudan (3004) bağlanıyordu; artık gateway'in `/procurement/*`
 * proxy'sinden (bkz. api-gateway/src/routes/procurement.routes.ts) geçiyor. Dışa açık imzalar
 * DEĞİŞMEDİ.
 */
export interface Material {
  id: string;
  project_id: string;
  malzeme_turu: string;
  malzeme_adi: string;
  teknik_ozellik: string | null;
  adet: number;
  birim_fiyat: number;
  alim_tarihi: string;
  alim_dolar_kuru: number;
  toplam_tl: number;
  toplam_usd: number;
}

export interface CreateMaterialInput {
  projectId: string;
  malzemeTuru: string;
  malzemeAdi: string;
  teknikOzellik?: string;
  adet: number;
  birimFiyat: number;
  alimTarihi: string;
}

export async function fetchMaterials(projectId: string): Promise<Material[]> {
  const query = new URLSearchParams({ projectId }).toString();
  return apiFetch<Material[]>(`/procurement/materials?${query}`, { fallbackError: 'Malzeme listesi alınamadı' });
}

export async function createMaterial(input: CreateMaterialInput): Promise<Material> {
  return apiFetch<Material>('/procurement/materials', { method: 'POST', body: input, fallbackError: 'Malzeme kaydedilemedi' });
}

export interface StockMovement {
  id: string;
  material_id: string;
  hareket_tipi: 'giris' | 'cikis';
  miktar: number;
  aciklama: string | null;
  created_at: string;
}

/** Day 5: B2'nin bugün eklediği GET /materials/:id/stock-movements endpoint'ine bağlantı. */
export async function fetchStockMovements(materialId: string): Promise<{ items: StockMovement[]; currentStock: number }> {
  return apiFetch<{ items: StockMovement[]; currentStock: number }>(`/procurement/materials/${materialId}/stock-movements`, {
    fallbackError: 'Stok hareketleri alınamadı',
  });
}

export async function createStockMovement(
  materialId: string,
  hareketTipi: 'giris' | 'cikis',
  miktar: number,
  aciklama?: string,
): Promise<StockMovement> {
  return apiFetch<StockMovement>(`/procurement/materials/${materialId}/stock-movements`, {
    method: 'POST',
    body: { hareketTipi, miktar, aciklama },
    fallbackError: 'Stok hareketi kaydedilemedi',
  });
}
