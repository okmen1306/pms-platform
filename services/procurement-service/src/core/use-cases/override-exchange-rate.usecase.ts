import type { AuditPublisherFn } from '@pms/shared';
import type { MaterialRepository } from '../../infrastructure/database/material.repository';

/** Madde 5: farklı bir kurdan alım yapıldıysa, satın alma personeli kuru elle güncelleyebilir. */
export async function overrideExchangeRate(
  materialId: string,
  newRate: number,
  actorUserId: string,
  repo: MaterialRepository,
  publishAudit: AuditPublisherFn,
) {
  const updated = await repo.updateRate(materialId, newRate);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'procurement_materials',
    entityId: materialId,
    ozet: `"${updated.malzeme_adi}" malzemesinin kuru manuel olarak ${newRate} TL'ye güncellendi.`,
    severity: 'info',
  });

  return updated;
}
