import type { AuditPublisherFn } from '@pms/shared';
import type { RiskRepository, CreateRiskInput, RiskRow } from '../../infrastructure/database/risk.repository';

/**
 * Kural (docs/roadmap.md "Risk Analizi Sayfası" bölümü): risk analizi hem üst hem alt iş
 * paketi kırılımlarını gösterebilmeli — bu yüzden work_package_id/sub_work_package_id
 * opsiyonel (proje geneline ait bir risk de olabilir).
 */
export async function createRisk(
  input: CreateRiskInput,
  repo: RiskRepository,
  publishAudit: AuditPublisherFn,
): Promise<RiskRow> {
  const created = await repo.create(input);

  await publishAudit({
    eventType: 'CREATE',
    actorUserId: input.olusturan_id,
    actorEmail: null,
    entityType: 'risk_items',
    entityId: created.id,
    ozet: `"${created.risk_adi}" riski eklendi (öncelik puanı: ${created.oncelik_puani}).`,
    severity: created.oncelik_puani >= 15 ? 'warning' : 'info',
  });

  return created;
}
