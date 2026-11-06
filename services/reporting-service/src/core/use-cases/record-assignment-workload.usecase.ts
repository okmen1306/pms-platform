import type { AssignmentCreatedEvent } from '@pms/shared';
import type { ReportRepository } from '../../infrastructure/database/report.repository';
import { calculateSpannedWeeks } from './calculate-spanned-weeks';

/**
 * B3 (Day 10): "CQRS şeması + ilk consumer'lar". İki tabloyu birden besler:
 * 1) `reporting_project_progress` — bu atama için %0 tamamlanma satırı açılır (work_package_
 *    completed geldiğinde %100'e güncellenecek, bkz. record-work-package-progress.usecase.ts).
 * 2) `reporting_workload_snapshot` — atamanın kapsadığı HER hafta için bir satır (bkz.
 *    calculate-spanned-weeks.ts'teki basitleştirme notu).
 *
 * Projenin başlangıç tarihi `reporting_project_planner_snapshot`tan okunur (Kırılmaz Kural:
 * project-service'in KENDİ tablosuna dokunulmaz — bu, event'ten önceden inşa edilmiş kendi
 * önbelleğimiz). Snapshot henüz yoksa (yarış durumu, `project.created` henüz işlenmemiş) hafta
 * hesabı ATLANIR ama progress satırı yine de açılır (finance-service'in AYNI durumda tüm
 * hesaplamayı atlamasından FARKLI olarak — burada sadece "hangi haftalar" bilgisi eksik kalır,
 * "bu iş var" bilgisi kaybolmaz).
 */
export async function recordAssignmentWorkload(event: AssignmentCreatedEvent, reportRepo: ReportRepository): Promise<void> {
  await reportRepo.upsertProgress({
    project_id: event.projectId,
    work_package_id: event.workPackageId,
    employee_id: event.employeeId,
    tamamlanma_yuzdesi: 0,
    baslangic_tarihi: event.start,
    bitis_tarihi: event.end,
  });

  const snapshot = await reportRepo.findPlannerSnapshot(event.projectId);
  if (!snapshot?.planlanan_baslangic) return;

  const weeks = calculateSpannedWeeks(snapshot.planlanan_baslangic, event.start, event.end);
  await reportRepo.insertWorkloadSnapshot(
    weeks.map((haftaNo) => ({
      employee_id: event.employeeId,
      hafta_no: haftaNo,
      project_id: event.projectId,
      work_package_id: event.workPackageId,
    })),
  );
}
