import type { ReportRepository } from '../../infrastructure/database/report.repository';
import type { ProjectServiceClient } from '../../infrastructure/external/project-service.client';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

export interface WorkDetailEntry {
  workPackageId: string;
  workPackageName: string | null;
  haftalar: { employeeId: string; employeeName: string | null; haftaNo: number }[];
}

/**
 * B3 (Day 12) + B2 (Day 13, "reporting tamamlamaya destek"): "work-detail.controller.ts" —
 * roadmap dosya ağacındaki plana göre `build-workload-matrix.usecase.ts`.
 * `reporting_workload_snapshot` (Day 10) sadece `work_package_id`/`employee_id` UUID'lerini
 * tutar — B1'in Day 12'de eklediği `ProjectServiceClient` iş paketi adlarını, B2'nin bugün
 * eklediği `PersonnelServiceClient` de personel adlarını çözer. İkisi de ANLIK erişilemezse
 * (bkz. ilgili istemcilerdeki not) ilgili alan `null` ile devam eder — rapor tamamen
 * BAŞARISIZ olmaz, sadece isimsiz kalır.
 */
export async function buildWorkloadMatrix(
  projectId: string,
  reportRepo: ReportRepository,
  projectServiceClient: ProjectServiceClient,
  personnelServiceClient: PersonnelServiceClient,
): Promise<WorkDetailEntry[]> {
  const [rows, nameByWorkPackageId, nameByEmployeeId] = await Promise.all([
    reportRepo.listWorkloadByProject(projectId),
    projectServiceClient.resolveWorkPackageNames(projectId),
    personnelServiceClient.resolveEmployeeNames(),
  ]);

  const grouped = new Map<string, WorkDetailEntry>();
  for (const row of rows) {
    let entry = grouped.get(row.work_package_id);
    if (!entry) {
      entry = { workPackageId: row.work_package_id, workPackageName: nameByWorkPackageId.get(row.work_package_id) ?? null, haftalar: [] };
      grouped.set(row.work_package_id, entry);
    }
    entry.haftalar.push({
      employeeId: row.employee_id,
      employeeName: nameByEmployeeId.get(row.employee_id) ?? null,
      haftaNo: row.hafta_no,
    });
  }

  return Array.from(grouped.values());
}
