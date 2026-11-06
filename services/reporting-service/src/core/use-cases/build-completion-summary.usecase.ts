import { NotFoundError } from '@pms/shared';
import type { ReportRepository, ProjectProgressRow } from '../../infrastructure/database/report.repository';

export type CompletionScope = 'project' | 'work-package' | 'employee';

export interface ProjectCompletionSummary {
  scope: 'project';
  projectId: string;
  projeAdi: string;
  tamamlanmaYuzdesi: number;
  tamamlananIsSayisi: number;
  toplamIsSayisi: number;
}

export interface GroupedCompletionEntry {
  /** scope='work-package' ise work_package_id, scope='employee' ise employee_id. */
  key: string;
  tamamlanmaYuzdesi: number;
  tamamlananIsSayisi: number;
  toplamIsSayisi: number;
}

/**
 * B3 (Day 11, B2 destekli): `GET /reports/completion-status?projectId=&scope=`
 * (roadmap.md Bölüm 8 — reporting-service uç nokta listesi ile BİREBİR).
 * scope='project': planner snapshot'taki (record-work-package-progress.usecase.ts'in bugün
 * güncel tuttuğu) genel yüzde. scope='work-package'|'employee': ham progress satırlarından
 * o anda gruplanarak hesaplanır (ayrı bir snapshot tablosu YOK — roadmap Bölüm 4.10'da sadece
 * 3 tablo var, work-package/employee kırılımı için ayrı bir CQRS tablosu planlı değil).
 */
export async function buildCompletionSummary(
  projectId: string,
  scope: CompletionScope,
  reportRepo: ReportRepository,
): Promise<ProjectCompletionSummary | GroupedCompletionEntry[]> {
  const progressRows = await reportRepo.listProgressByProject(projectId);

  if (scope === 'project') {
    const snapshot = await reportRepo.findPlannerSnapshot(projectId);
    if (!snapshot) throw new NotFoundError('Proje rapor snapshot\'ı', projectId);
    const toplam = progressRows.length;
    const tamamlanan = progressRows.filter((r) => r.tamamlanma_yuzdesi >= 100).length;
    return {
      scope: 'project',
      projectId,
      projeAdi: snapshot.proje_adi,
      tamamlanmaYuzdesi: snapshot.tamamlanma_yuzdesi ?? 0,
      tamamlananIsSayisi: tamamlanan,
      toplamIsSayisi: toplam,
    };
  }

  const groupField: keyof ProjectProgressRow = scope === 'work-package' ? 'work_package_id' : 'employee_id';
  const groups = new Map<string, ProjectProgressRow[]>();
  for (const row of progressRows) {
    const key = row[groupField];
    if (!key) continue; // NOT: bazı progress satırlarında employee_id/work_package_id null olabilir (bkz. schema) — bunlar gruplamaya dahil edilmez.
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return Array.from(groups.entries()).map(([key, rows]) => {
    const toplam = rows.length;
    const tamamlanan = rows.filter((r) => r.tamamlanma_yuzdesi >= 100).length;
    return {
      key,
      tamamlanmaYuzdesi: toplam === 0 ? 0 : Math.round((tamamlanan / toplam) * 10000) / 100,
      tamamlananIsSayisi: tamamlanan,
      toplamIsSayisi: toplam,
    };
  });
}
