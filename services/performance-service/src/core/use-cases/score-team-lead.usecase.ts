import { NotFoundError, ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { PerformanceScoreRepository, TeamLeadScoreRow } from '../../infrastructure/database/score.repository';
import { recalculateTeamIndex } from './calculate-performance-index.usecase';

export interface ScoreTeamLeadInput {
  projectId: string;
  ekipLideriId: string;
  criterionId: string;
  puan: number;
}

/**
 * TL (Day 12): "performance endeks hesaplama finalize (B3 ile)". roadmap.md Bölüm 8:
 * `POST /projects/:id/team-leads/:leadId/scores` (sirket_yoneticisi). `submitTeamLeadScore`
 * Day 1'den beri şemada YER ALIYORDU ama Day 9'un notunun da doğruladığı gibi hiçbir güne
 * atanmamıştı — bugün o gün.
 */
export async function scoreTeamLead(
  input: ScoreTeamLeadInput,
  actorUserId: string,
  repo: PerformanceScoreRepository,
  publishAudit: AuditPublisherFn,
): Promise<TeamLeadScoreRow> {
  if (input.puan < 0 || input.puan > 100) {
    throw new ValidationError('puan 0-100 arasında olmalı');
  }

  const result = await repo.submitTeamLeadScore({
    project_id: input.projectId,
    ekip_lideri_id: input.ekipLideriId,
    criterion_id: input.criterionId,
    puan: input.puan,
    veren_yonetici_id: actorUserId,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'performance_team_lead_scores',
    entityId: input.ekipLideriId,
    ozet: `Ekip lideri (${input.ekipLideriId}) için puan girişi yapıldı: ${input.puan}.`,
    severity: 'info',
  });

  await recalculateTeamIndex(input.projectId, input.ekipLideriId, repo);

  return result;
}

/** roadmap.md Bölüm 8: `PATCH /team-leads/:leadId/scores/:scoreId` (sirket_yoneticisi — override). */
export async function overrideTeamLeadScore(
  scoreId: string,
  puan: number,
  actorUserId: string,
  repo: PerformanceScoreRepository,
  publishAudit: AuditPublisherFn,
): Promise<TeamLeadScoreRow> {
  if (puan < 0 || puan > 100) {
    throw new ValidationError('puan 0-100 arasında olmalı');
  }

  const existing = await repo.findTeamLeadScoreById(scoreId);
  if (!existing) throw new NotFoundError('Ekip lideri puanı', scoreId);

  const updated = await repo.overrideTeamLeadScore(scoreId, puan, actorUserId);
  if (!updated) throw new NotFoundError('Ekip lideri puanı', scoreId);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'performance_team_lead_scores',
    entityId: existing.ekip_lideri_id,
    ozet: `Ekip lideri (${existing.ekip_lideri_id}) puanı yönetici tarafından ${existing.puan} → ${puan} olarak değiştirildi.`,
    severity: 'warning',
  });

  await recalculateTeamIndex(existing.project_id, existing.ekip_lideri_id, repo);

  return updated;
}
