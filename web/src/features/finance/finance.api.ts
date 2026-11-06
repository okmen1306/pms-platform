import { apiFetch } from '../../shared/api';

/**
 * Day 20 (Entegrasyon Haftası): önceden finance-service'e DOĞRUDAN (VITE_FINANCE_SERVICE_URL) ve
 * kimliksiz bağlanıyordu. Artık gateway'in `/finance/*` proxy'sinden geçer — bu, `finance.cost_analysis`
 * İZNİNİ (Kural #8) gateway'de zorlar: izni olmayan kullanıcı 403 FORBIDDEN_PAGE_ACCESS alır.
 * Fonksiyon imzaları DEĞİŞMEDİ. Gateway `/finance`'i upstream'e `/finance` önekiyle iletir
 * (bkz. api-gateway/src/routes/finance.routes.ts rewritePrefix) — yani buradaki yol servisin kendi
 * rotasıyla (`/finance/projects/:id/costs`) birebir aynıdır.
 */
export interface ProjectCost {
  id: string;
  project_id: string;
  // F2 (Day 8): kalem bazlı döküm — B2'nin (`material.purchased` consumer) eklediği
  // malzeme_maliyeti_* dahil, finance_project_costs'un TÜM bileşenleri (bkz. finance-service
  // cost.repository.ts ProjectCostRow). Önceden sadece toplamlar modellenmişti; bugünden
  // itibaren "toplam neden bu kadar?" sorusunun cevabı sayfada GÖRÜNÜR.
  arge_maliyeti_tl: number;
  arge_maliyeti_usd: number;
  malzeme_maliyeti_tl: number;
  malzeme_maliyeti_usd: number;
  danismanlik_maliyeti_tl: number;
  paketleme_maliyeti_tl: number;
  diger_maliyetler_toplam_tl: number;
  idari_maliyet_tutari_tl: number;
  toplam_tahmini_maliyet_tl: number;
  toplam_gerceklesen_maliyet_tl: number;
  fark_tl: number;
  satis_fiyati_tl: number | null;
  kar_marji_yuzde: number | null;
}

export async function fetchProjectCost(projectId: string): Promise<ProjectCost> {
  return apiFetch<ProjectCost>(`/finance/projects/${projectId}/costs`, { fallbackError: 'Maliyet bilgisi alınamadı' });
}

export interface PersonnelWeeklyCost {
  id: string;
  project_id: string;
  employee_id: string;
  hafta_no: number;
  hafta_baslangic_tarihi: string;
  haftalik_maliyet_tl: number;
  haftalik_maliyet_usd: number;
  ayni_hafta_proje_sayisi: number;
}

/** F2 (Day 7): AR-GE maliyeti haftalık dökümü — bkz. calculate-arge-cost.usecase.ts. */
export async function fetchPersonnelWeeklyCost(projectId: string): Promise<PersonnelWeeklyCost[]> {
  return apiFetch<PersonnelWeeklyCost[]>(`/finance/projects/${projectId}/personnel-weekly-cost`, {
    fallbackError: 'AR-GE maliyeti alınamadı',
  });
}
