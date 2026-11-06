import type { WorkPackageCompletedEvent } from '@pms/shared';
import type { ReportRepository } from '../../infrastructure/database/report.repository';

/**
 * B3 (Day 11, "tamamlanma endpoint'i" desteği): iş paketi tamamlandığında SADECE kendi progress
 * satırı %100'e çekilmiyor — projenin GENEL tamamlanma yüzdesi de (tüm progress satırlarının
 * yüzdesi üzerinden) yeniden hesaplanıp planner snapshot'a yazılıyor. Day 10'da
 * `upsertPlannerSnapshot` bu alanı hep 0'a sabitliyordu ve hiçbir yerde güncellenmiyordu — B2
 * desteğiyle bulunan gerçek bir hata (bkz. CHANGELOG.md Day 11). Yüzde, tamamlanma_yuzdesi>=100
 * olan satır sayısının TOPLAM satır sayısına oranı (her satır bir personel×iş paketi atamasını
 * temsil eder, bkz. record-assignment-workload.usecase.ts).
 */
export async function recordWorkPackageProgress(event: WorkPackageCompletedEvent, reportRepo: ReportRepository): Promise<void> {
  await reportRepo.upsertProgress({
    project_id: event.projectId,
    work_package_id: event.workPackageId,
    employee_id: event.employeeId,
    tamamlanma_yuzdesi: 100,
  });

  const allProgress = await reportRepo.listProgressByProject(event.projectId);
  const tamamlanan = allProgress.filter((r) => r.tamamlanma_yuzdesi >= 100).length;
  const yuzde = allProgress.length === 0 ? 0 : Math.round((tamamlanan / allProgress.length) * 10000) / 100;
  await reportRepo.updatePlannerCompletion(event.projectId, yuzde);
}
