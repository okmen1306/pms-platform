import type { ProjectCreatedEvent } from '@pms/shared';
import type { ReportRepository } from '../../infrastructure/database/report.repository';

/**
 * B3 (Day 10): "CQRS şeması + ilk consumer'lar". `proje_adi` NOT NULL ama event'te opsiyonel
 * (geriye dönük uyumluluk için, bkz. shared/events/project.events.ts) — fallback ile korunuyor.
 */
export async function recordProjectPlannerSnapshot(event: ProjectCreatedEvent, reportRepo: ReportRepository): Promise<void> {
  await reportRepo.upsertPlannerSnapshot({
    project_id: event.projectId,
    proje_adi: event.projeAdi ?? 'Bilinmeyen Proje',
    planlanan_baslangic: event.startDate,
    planlanan_sure_hafta: event.sureHafta ?? null,
  });
}
