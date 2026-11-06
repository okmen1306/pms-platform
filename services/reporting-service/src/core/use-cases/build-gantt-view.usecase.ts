import type { ReportRepository } from '../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

export interface WorkflowStatusEntry {
  workPackageId: string | null;
  workPackageName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  baslangicTarihi: string | null;
  bitisTarihi: string | null;
  tamamlanmaYuzdesi: number;
  durum: 'tamamlandi' | 'devam_ediyor';
}

/**
 * B3 (Day 12) + B1+B2 (Day 13, "reporting tamamlamaya destek"): "workflow-report.controller.ts"
 * — roadmap dosya ağacındaki plana göre `build-gantt-view.usecase.ts`.
 * `reporting_project_progress` (Day 10'dan beri) her satırda zaten `baslangic_tarihi`/
 * `bitis_tarihi` TUTUYOR (bkz. record-assignment-workload.usecase.ts) — bu yüzden Gantt
 * görünümü için YENİ bir OLAY/tablo kaynağına gerek YOK, sadece mevcut satırları tarih sırasına
 * göre şekillendirir. Day 12'de work-detail için yazılan `ProjectServiceClient`
 * (B1) ve bugün eklenen `PersonnelServiceClient` (B2) BURADA da aynen tekrar kullanılıyor —
 * Day 12'nin F1 notundaki "iş paketi/personel ADLARI henüz çözümlenmediği için ham ID
 * gösterir" sınırlaması bugün work-detail'le AYNI çözümle kapatılıyor. work_package_id/
 * employee_id null olabileceği için (bkz. schema) haritalarda bulunamayan/null anahtarlar
 * sessizce `null` isimle geçilir.
 */
export async function buildGanttView(
  projectId: string,
  reportRepo: ReportRepository,
  projectServiceClient: ProjectServiceClient,
  personnelServiceClient: PersonnelServiceClient,
): Promise<WorkflowStatusEntry[]> {
  const [rows, nameByWorkPackageId, nameByEmployeeId] = await Promise.all([
    reportRepo.listProgressByProject(projectId),
    projectServiceClient.resolveWorkPackageNames(projectId),
    personnelServiceClient.resolveEmployeeNames(),
  ]);

  return rows
    .map((r) => ({
      workPackageId: r.work_package_id,
      workPackageName: r.work_package_id ? nameByWorkPackageId.get(r.work_package_id) ?? null : null,
      employeeId: r.employee_id,
      employeeName: r.employee_id ? nameByEmployeeId.get(r.employee_id) ?? null : null,
      baslangicTarihi: r.baslangic_tarihi,
      bitisTarihi: r.bitis_tarihi,
      tamamlanmaYuzdesi: r.tamamlanma_yuzdesi,
      durum: (r.tamamlanma_yuzdesi >= 100 ? 'tamamlandi' : 'devam_ediyor') as WorkflowStatusEntry['durum'],
    }))
    .sort((a, b) => (a.baslangicTarihi ?? '').localeCompare(b.baslangicTarihi ?? ''));
}
