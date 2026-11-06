import { NotFoundError, type AuditPublisherFn } from '@pms/shared';
import type { RiskRepository, UpdateRiskInput, RiskRow } from '../../infrastructure/database/risk.repository';

export async function updateRisk(
  id: string,
  input: UpdateRiskInput,
  actorUserId: string,
  repo: RiskRepository,
  publishAudit: AuditPublisherFn,
): Promise<RiskRow> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError('Risk', id);

  const updated = await repo.update(id, input);

  await publishAudit({
    eventType: 'UPDATE',
    actorUserId,
    actorEmail: null,
    entityType: 'risk_items',
    entityId: id,
    ozet: `"${updated.risk_adi}" riski güncellendi.`,
    severity: 'info',
  });

  return updated;
}
