import { NotFoundError, type AuditPublisherFn, type WorkDraftCellDto } from '@pms/shared';
import type { WorkDraftRepository, WorkDraftCellRow } from '../../infrastructure/database/work-draft.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';

/**
 * B1 (Day 10): "iş taslağı" (work draft) — bkz. shared/dto/project.dto.ts'teki
 * WorkDraftCellDtoSchema notu. `check-assignment-conflict.usecase.ts` (Day 8) İLE AYNI felsefe:
 * bu, KESİN bir planlama aracı değil, hafif bir görsel taslak — DB seviyesinde bir kısıtlama
 * (örn. çakışma engeli) YOK, sadece "bu hücre boyalı mı" sorusuna cevap verir.
 */
export async function setWorkDraftCell(
  projectId: string,
  input: WorkDraftCellDto,
  actorUserId: string,
  workDraftRepo: WorkDraftRepository,
  projectRepo: ProjectRepository,
  publishAudit: AuditPublisherFn,
): Promise<WorkDraftCellRow> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError('Proje', projectId);

  const cell = await workDraftRepo.upsertCell({
    project_id: projectId,
    work_package_id: input.workPackageId,
    hafta_no: input.haftaNo,
    boyali: input.boyali,
    created_by: actorUserId,
  });

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_work_drafts',
    entityId: cell.id,
    ozet: `"${project.proje_adi}" projesinde ${cell.hafta_no}. hafta hücresi ${cell.boyali ? 'boyandı' : 'boyası kaldırıldı'}.`,
    severity: 'info',
  });

  return cell;
}
