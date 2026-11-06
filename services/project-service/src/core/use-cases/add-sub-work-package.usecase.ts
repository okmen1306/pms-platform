import { NotFoundError, WorkPackageDateOutOfRangeError, type AuditPublisherFn } from '@pms/shared';
import type { WorkPackageRepository, SubWorkPackageRow } from '../../infrastructure/database/work-package.repository';

export interface AddSubWorkPackageInput {
  ad: string;
  baslangicHafta: number;
  bitisHafta: number;
}

/**
 * Kural (madde 7 + "İş Taslağı Sayfası" bölümü): alt iş paketleri, proje süresi başladıktan
 * sonra da eklenip/düzenlenip/çıkarılabilir. Ekip lideri üst iş paketinin belirlediği hafta
 * aralığından FARKLI bir tarih belirlerse sistem uyarı verip veri girişine izin vermemeli —
 * bu kontrol burada üst iş paketinin (varsa) tarih aralığına göre yapılır.
 */
export async function addSubWorkPackage(
  workPackageId: string,
  input: AddSubWorkPackageInput,
  actorUserId: string,
  repo: WorkPackageRepository,
  publishAudit: AuditPublisherFn,
): Promise<SubWorkPackageRow> {
  const workPackage = await repo.findWorkPackageById(workPackageId);
  if (!workPackage) throw new NotFoundError('İş paketi', workPackageId);

  // Üst iş paketinin tarih aralığı biliniyorsa (yani "yok" değilse), alt kırılımın hafta
  // aralığı bu sınırların dışına taşmamalı. Hafta numarası bazlı basit bir üst sınır kontrolü:
  if (workPackage.baslangic_tarihi && workPackage.bitis_tarihi) {
    const maxWeeks = Math.ceil(
      (new Date(workPackage.bitis_tarihi).getTime() - new Date(workPackage.baslangic_tarihi).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    ) + 1;
    if (input.bitisHafta > maxWeeks) {
      throw new WorkPackageDateOutOfRangeError(workPackageId);
    }
  }

  const created = await repo.createSubWorkPackage({
    work_package_id: workPackageId,
    ad: input.ad,
    baslangic_hafta: input.baslangicHafta,
    bitis_hafta: input.bitisHafta,
    created_by: actorUserId,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'project_sub_work_packages',
    entityId: created.id,
    ozet: `"${created.ad}" alt iş paketi eklendi (hafta ${created.baslangic_hafta}-${created.bitis_hafta}).`,
    severity: 'info',
  });

  return created;
}
