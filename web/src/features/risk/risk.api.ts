import { apiFetch } from '../../shared/api';

/**
 * Day 20 (Entegrasyon Haftası): risk-service'e doğrudan/kimliksiz bağlantı kaldırıldı — her çağrı
 * gateway'in `/risk/*` proxy'sinden geçer. Fonksiyon imzaları DEĞİŞMEDİ; hatalar `ApiError`.
 */

export interface Risk {
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

export async function fetchRisks(projectId: string): Promise<Risk[]> {
  return apiFetch<Risk[]>(`/risk/projects/${projectId}/risks`, { fallbackError: 'Riskler alınamadı' });
}

export async function createRisk(
  projectId: string,
  riskAdi: string,
  olasilik: number,
  etki: number,
  aciklama?: string,
  azaltmaStratejisi?: string,
): Promise<Risk> {
  return apiFetch<Risk>(`/risk/projects/${projectId}/risks`, {
    method: 'POST',
    body: { riskAdi, olasilik, etki, aciklama, azaltmaStratejisi },
    fallbackError: 'Risk kaydedilemedi',
  });
}

export async function updateRiskStatus(riskId: string, durum: Risk['durum']): Promise<Risk> {
  return apiFetch<Risk>(`/risk/risks/${riskId}`, { method: 'PATCH', body: { durum }, fallbackError: 'Risk güncellenemedi' });
}

/**
 * F2 (Day 11): "RiskRegisterPage tamamlama". Backend'in `PATCH /risks/:id`'si (Day 1-3'ten beri)
 * riskAdi/aciklama/olasilik/etki/azaltmaStratejisi/durum'un HEPSİNİ kısmi güncelleyebiliyordu
 * (bkz. update-risk.usecase.ts + risk.controller.ts'teki UpdateRiskBodySchema) ama Day 10'un
 * frontend'i SADECE `durum`'u güncelleyen `updateRiskStatus`'u kullanıyordu — açıklama/azaltma
 * stratejisi alanları ne oluştururken ne düzenlerken hiç gösterilmiyordu. Bu, o eksik tam-alan
 * güncellemesini ekler (updateRiskStatus, hızlı durum-değiştirme dropdown'u için AYNEN kalıyor).
 */
export async function updateRisk(
  riskId: string,
  input: { riskAdi?: string; aciklama?: string; olasilik?: number; etki?: number; azaltmaStratejisi?: string },
): Promise<Risk> {
  return apiFetch<Risk>(`/risk/risks/${riskId}`, { method: 'PATCH', body: input, fallbackError: 'Risk güncellenemedi' });
}

export async function deleteRisk(riskId: string): Promise<void> {
  await apiFetch<unknown>(`/risk/risks/${riskId}`, { method: 'DELETE', fallbackError: 'Risk silinemedi' });
}
