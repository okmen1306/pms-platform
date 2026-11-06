import { NotFoundError, WorkPackageDateOutOfRangeError, type AuditPublisherFn } from '@pms/shared';
import type { WorkPackageRepository, WorkPackageRow } from '../../infrastructure/database/work-package.repository';
import type { ProjectRepository } from '../../infrastructure/database/project.repository';

export interface PlanWorkPackageInput {
  masterWorkPackageId: number;
  baslangicTarihi?: string;
  bitisTarihi?: string;
}

/**
 * Madde 7 ve "Girilen Verilerle İlgili Özet Bilgi" bölümü: ekip lideri iş planı yaparken TÜM
 * iş paketlerini seçmek zorunda değil. Başlangıç/bitiş tarihi girilmezse o iş paketi proje için
 * "yok" sayılır (Excel'deki E14 mantığı) — bu yüzden tarihler burada OPSİYONEL.
 */
export async function planWorkPackage(
  projectId: string,
  input: PlanWorkPackageInput,
  actorUserId: string,
  workPackageRepo: WorkPackageRepository,
  projectRepo: ProjectRepository,
  publishAudit: AuditPublisherFn,
  publishWorkPackagePlanned: (event: { projectId: string; workPackageId: string; masterWorkPackageId: number }) => Promise<void>,
): Promise<WorkPackageRow> {
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError('Proje', projectId);

  if (input.baslangicTarihi && input.bitisTarihi) {
    if (new Date(input.bitisTarihi) < new Date(input.baslangicTarihi)) {
      throw new WorkPackageDateOutOfRangeError(projectId);
    }
  }

  const created = await workPackageRepo.createWorkPackage({
    project_id: projectId,
    master_work_package_id: input.masterWorkPackageId,
    baslangic_tarihi: input.baslangicTarihi ?? null,
    bitis_tarihi: input.bitisTarihi ?? null,
  });

  await publishWorkPackagePlanned({
    projectId,
    workPackageId: created.id,
    masterWorkPackageId: created.master_work_package_id,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_work_packages',
    entityId: created.id,
    ozet: `Proje (${project.proje_adi}) için iş paketi planlandı (master: ${input.masterWorkPackageId}).`,
    severity: 'info',
  });

  return created;
}
