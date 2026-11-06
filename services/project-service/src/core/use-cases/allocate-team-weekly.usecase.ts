import { NotFoundError, WeeklyCapacityExceededError, type AuditPublisherFn } from '@pms/shared';
import type { WeeklyAllocationRepository } from '../../infrastructure/database/weekly-allocation.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';

/**
 * Kural #7 (docs/roadmap.md): "Ekiplere planlanan haftalık süre toplamı, projenin bitiş hafta
 * sayısını aşamaz." Bu kontrol, mevcut kayıtlı haftaların toplamı + bu isteğin getirdiği YENİ
 * değerin ESKİ değerin yerine geçtiği varsayımıyla (upsert) yapılır — aynı haftaya ikinci kez
 * yazıldığında eski değer çift sayılmaz.
 */
export async function allocateTeamWeekly(
  projectId: string,
  teamId: string,
  haftaNo: number,
  planlananSureHafta: number,
  actorUserId: string,
  allocationRepo: WeeklyAllocationRepository,
  projectRepo: ProjectRepository,
  publishAudit: AuditPublisherFn,
) {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError('Proje', projectId);

  const existing = await allocationRepo.listByProject(projectId);
  const existingForTeamOtherWeeks = existing
    .filter((a) => a.team_id === teamId && a.hafta_no !== haftaNo)
    .reduce((sum, a) => sum + Number(a.planlanan_sure_hafta), 0);

  const newTotal = existingForTeamOtherWeeks + planlananSureHafta;
  if (newTotal > project.sure_hafta) {
    throw new WeeklyCapacityExceededError(teamId, projectId);
  }

  const created = await allocationRepo.upsert(projectId, teamId, haftaNo, planlananSureHafta);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_team_weekly_allocation',
    entityId: created.id,
    ozet: `Ekip (${teamId}) için ${haftaNo}. hafta planlaması: ${planlananSureHafta} hafta.`,
    severity: 'info',
  });

  return created;
}
