import { ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { PerformanceScoreRepository } from '../../infrastructure/database/score.repository';
import { recalculateEmployeeIndex } from './calculate-performance-index.usecase';

export interface ScoreEmployeeInput {
  projectId: string;
  employeeId: string;
  criterionId: string;
  puan: number;
}

/**
 * Kural: bu use-case'i sadece "ekip_lideri" rolü çağırabilir (yetki kontrolü Day 6-8'de
 * api-gateway RBAC middleware'i devreye girince eklenecek — bkz. TODO).
 */
export async function scoreEmployee(
  input: ScoreEmployeeInput,
  actorUserId: string,
  repo: PerformanceScoreRepository,
  publishAudit: AuditPublisherFn,
): Promise<unknown> {
  if (input.puan < 0 || input.puan > 100) {
    throw new ValidationError('puan 0-100 arasında olmalı');
  }

  const result = await repo.submitEmployeeScore({
    project_id: input.projectId,
    employee_id: input.employeeId,
    criterion_id: input.criterionId,
    puan: input.puan,
    veren_id: actorUserId,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'performance_employee_scores',
    entityId: input.employeeId,
    ozet: `Personel (${input.employeeId}) için puan girişi yapıldı: ${input.puan}.`,
    severity: 'info',
  });

  // TL (Day 12): "endeks hesaplama finalize" — artık her puan girişinden SONRA endeks
  // yeniden hesaplanıyor (TODO (Day 33+) SADECE `performance.score_submitted` event'inin
  // reporting-service'e YAYINLANMASI için geçerli kalıyor — endeksin KENDİSİ artık gecikmeli
  // değil, gerçek zamanlı).
  await recalculateEmployeeIndex(input.projectId, input.employeeId, repo);

  return result;
}
