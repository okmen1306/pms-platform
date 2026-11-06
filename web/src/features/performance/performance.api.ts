import { apiFetch } from '../../shared/api';

/**
 * Day 20 (Entegrasyon Haftası): performance-service'e doğrudan/kimliksiz bağlantı kaldırıldı —
 * her çağrı gateway'in `/performance/*` proxy'sinden (Authorization + x-actor-id) geçer.
 * Fonksiyon imzaları DEĞİŞMEDİ; hatalar `ApiError` (status + code + details).
 */
export interface Criterion {
  id: string;
  ad: string;
  agirlik_yuzdesi: number;
  aktif: boolean;
}

export async function fetchCriteria(): Promise<Criterion[]> {
  return apiFetch<Criterion[]>('/performance/criteria', { fallbackError: 'Kriterler alınamadı' });
}

export async function submitEmployeeScore(
  projectId: string,
  employeeId: string,
  criterionId: string,
  puan: number,
): Promise<void> {
  await apiFetch<unknown>(`/performance/projects/${projectId}/employees/${employeeId}/scores`, {
    method: 'POST',
    body: { criterionId, puan },
    fallbackError: 'Puan kaydedilemedi',
  });
}

/**
 * F2 (Day 10): "Performance tamamlama" — EmployeePerformancePage için. Backend'e bugün eklendi
 * (bkz. performance.controller.ts Day 10 notu — Day 3'ten beri sadece yazma vardı, hiç okuma
 * yolu yoktu).
 */
export interface EmployeeScore {
  id: string;
  project_id: string;
  employee_id: string;
  criterion_id: string;
  puan: number;
  veren_id: string;
  verilme_tarihi: string;
}

export async function fetchEmployeeScores(projectId: string, employeeId: string): Promise<EmployeeScore[]> {
  return apiFetch<EmployeeScore[]>(`/performance/projects/${projectId}/employees/${employeeId}/scores`, {
    fallbackError: 'Puanlar alınamadı',
  });
}
