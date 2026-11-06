import { NotFoundError, ValidationError, ConflictAssignmentError, type AuditPublisherFn } from '@pms/shared';
import type {
  AssignmentRepository,
  AssignmentRow,
} from '../../infrastructure/database/assignment.repository';
import { POSTGRES_EXCLUSION_VIOLATION } from '../../infrastructure/database/assignment.repository';
import type { WorkPackageRepository } from '../../infrastructure/database/work-package.repository';
import type { PersonnelServiceClient } from '../../infrastructure/external/personnel-service.client';

export interface AssignPersonnelInput {
  workPackageId: string;
  subWorkPackageId?: string;
  employeeId: string;
  baslangicTarihi: string;
  bitisTarihi: string;
}

/**
 * Kural (docs/roadmap.md "Proje Planlama" — personel ataması): bir personel aynı tarih
 * aralığında iki işe atanamaz. Bu kural DB'de EXCLUDE USING gist ile garanti edilir
 * (bkz. 003_project_tables.sql); bu use-case sadece (a) iş paketinin bu projeye ait olduğunu
 * doğrular, (b) INSERT'i dener, (c) Postgres 23P01 (exclusion_violation) dönerse bunu 409
 * ASSIGNMENT_CONFLICT'e çevirip hangi mevcut atama(lar)la çakıştığını API tüketicisine bildirir.
 *
 * Kırılmaz Kural gereği employeeId'nin GERÇEKTEN var olan bir personel olup olmadığı DB
 * seviyesinde DOĞRULANMAZ (project-service, personnel-service'in tablosuna FK veremez) — bunun
 * yerine B1 (Day 11) ile `PersonnelServiceClient` REST çağrısı eklendi (employeeId var mı VE
 * `durum='active'` mi). Diğer mevcut kalıplar (weekly-allocation, work-package) hâlâ team_id'yi
 * doğrulamıyor — o servislerin kendi REST istemcisi henüz yok, bu Day 11'in kapsamı DIŞINDA.
 */
export async function assignPersonnel(
  projectId: string,
  input: AssignPersonnelInput,
  actorUserId: string,
  assignmentRepo: AssignmentRepository,
  workPackageRepo: WorkPackageRepository,
  personnelClient: PersonnelServiceClient,
  publishAudit: AuditPublisherFn,
  publishAssignmentCreated: (event: {
    assignmentId: string;
    projectId: string;
    employeeId: string;
    workPackageId: string;
    start: string;
    end: string;
  }) => Promise<void>,
  publishConflictDetected: (event: { employeeId: string; conflictingAssignmentIds: string[] }) => Promise<void>,
): Promise<AssignmentRow> {
  await personnelClient.assertEmployeeActive(input.employeeId);

  const workPackage = await workPackageRepo.findWorkPackageById(input.workPackageId);
  if (!workPackage || workPackage.project_id !== projectId) {
    throw new NotFoundError('İş paketi (bu projede)', input.workPackageId);
  }

  if (input.subWorkPackageId) {
    const subPackages = await workPackageRepo.listSubWorkPackages(input.workPackageId);
    const sub = subPackages.find((s) => s.id === input.subWorkPackageId);
    if (!sub) {
      throw new NotFoundError('Alt iş paketi (bu iş paketinde)', input.subWorkPackageId);
    }
  }

  if (new Date(input.bitisTarihi) < new Date(input.baslangicTarihi)) {
    throw new ValidationError('bitisTarihi, baslangicTarihi\'nden önce olamaz');
  }

  let created: AssignmentRow;
  try {
    created = await assignmentRepo.create({
      project_id: projectId,
      work_package_id: input.workPackageId,
      sub_work_package_id: input.subWorkPackageId ?? null,
      employee_id: input.employeeId,
      baslangic_tarihi: input.baslangicTarihi,
      bitis_tarihi: input.bitisTarihi,
    });
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError.code === POSTGRES_EXCLUSION_VIOLATION) {
      const overlapping = await assignmentRepo.findOverlapping(
        input.employeeId,
        input.baslangicTarihi,
        input.bitisTarihi,
      );
      const conflictingAssignmentIds = overlapping.map((a) => a.id);

      await publishConflictDetected({ employeeId: input.employeeId, conflictingAssignmentIds });
      await publishAudit({
        eventType: 'CREATE',
        actorUserId,
        actorEmail: null,
        entityType: 'project_personnel_assignments',
        entityId: null,
        ozet: `Personel (${input.employeeId}) ataması reddedildi: tarih çakışması.`,
        severity: 'warning',
      });

      throw new ConflictAssignmentError(input.employeeId, conflictingAssignmentIds);
    }
    throw err;
  }

  await publishAssignmentCreated({
    assignmentId: created.id,
    projectId: created.project_id,
    employeeId: created.employee_id,
    workPackageId: created.work_package_id,
    start: created.baslangic_tarihi,
    end: created.bitis_tarihi,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_personnel_assignments',
    entityId: created.id,
    ozet: `Personel (${created.employee_id}) ${created.baslangic_tarihi} - ${created.bitis_tarihi} arası bir işe atandı.`,
    severity: 'info',
  });

  return created;
}
