import { NotFoundError, type AuditPublisherFn } from '@pms/shared';
import type { CreateMilestoneDto } from '@pms/shared';
import type { MilestoneRepository, MilestoneRow } from '../../infrastructure/database/milestone.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';

/**
 * B1 (Day 9): "milestone / zaman çizelgesi". Diğer tüm proje alt-kaynakları (iş paketi, atama,
 * haftalık planlama) gibi, önce projenin GERÇEKTEN var olduğu doğrulanır (yabancı proje ID'sine
 * sessizce bir kilometre taşı eklenmesin diye).
 */
export async function createMilestone(
  projectId: string,
  input: CreateMilestoneDto,
  actorUserId: string,
  milestoneRepo: MilestoneRepository,
  projectRepo: ProjectRepository,
  publishAudit: AuditPublisherFn,
): Promise<MilestoneRow> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError('Proje', projectId);

  const created = await milestoneRepo.create({
    project_id: projectId,
    tarih: input.tarih,
    baslik: input.baslik,
    aciklama: input.aciklama ?? null,
    email_gonderilsin: input.emailGonderilsin,
    hedef_gruplar: input.hedefGruplar,
    created_by: actorUserId,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_milestones',
    entityId: created.id,
    ozet: `"${project.proje_adi}" projesine "${created.baslik}" kilometre taşı eklendi (${created.tarih}).`,
    severity: 'info',
  });

  return created;
}
