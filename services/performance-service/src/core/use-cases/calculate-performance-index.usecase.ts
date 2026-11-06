import type { PerformanceScoreRepository } from '../../infrastructure/database/score.repository';

/**
 * TL (Day 12): "performance endeks hesaplama finalize (B3 ile)". Şemanın kendi yorumuyla BİREBİR
 * (docs/roadmap.md Bölüm 4.7): "Hesaplanmis endeksler (puan x agirlik toplami)". Ağırlıklar
 * `manage-criteria.usecase.ts`'in zaten uyguladığı kural gereği toplamda 100'ü GEÇEMEZ — bu
 * yüzden `Σ(puan_i × ağırlık_i / 100)` formülü endeksi doğal olarak 0-100 aralığında tutar.
 * Sadece o ana kadar VERİLMİŞ puanlar üzerinden hesaplanır (henüz puanlanmamış kriterler
 * toplama dahil edilmez) — puan/kriter her değiştiğinde SIFIRDAN yeniden hesaplanır (artımlı
 * değil, idempotent) — reporting-service'in `record-work-package-progress.usecase.ts`'teki
 * (Day 11) AYNI deseni.
 */
function weightedIndex(scores: { criterion_id: string; puan: number }[], criteria: { id: string; agirlik_yuzdesi: number }[]): number {
  const weightById = new Map(criteria.map((c) => [c.id, Number(c.agirlik_yuzdesi)]));
  const total = scores.reduce((sum, s) => sum + (Number(s.puan) * (weightById.get(s.criterion_id) ?? 0)) / 100, 0);
  return Math.round(total * 100) / 100;
}

export async function recalculateEmployeeIndex(projectId: string, employeeId: string, repo: PerformanceScoreRepository): Promise<number> {
  const [scores, criteria] = await Promise.all([repo.listScoresByEmployee(projectId, employeeId), repo.listCriteria()]);
  const endeksPuani = weightedIndex(scores, criteria);
  await repo.upsertEmployeeIndex(projectId, employeeId, endeksPuani);
  return endeksPuani;
}

/**
 * Uzman İnisiyatifi: `team_id = ekip_lideri_id` kabul edildi (bkz. score.repository.ts'teki
 * `TeamIndexRow` üzerindeki not — roadmap'te ayrı bir takım-üyelik modeli yok).
 */
export async function recalculateTeamIndex(projectId: string, ekipLideriId: string, repo: PerformanceScoreRepository): Promise<number> {
  const [scores, criteria] = await Promise.all([repo.listTeamLeadScores(projectId, ekipLideriId), repo.listCriteria()]);
  const endeksPuani = weightedIndex(scores, criteria);
  await repo.upsertTeamIndex(projectId, ekipLideriId, endeksPuani);
  return endeksPuani;
}
