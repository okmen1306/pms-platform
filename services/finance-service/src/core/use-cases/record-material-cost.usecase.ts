import type { MaterialPurchasedEvent } from '@pms/shared';
import type { CostRepository, ProjectCostRow } from '../../infrastructure/database/cost.repository';
import type { FastifyBaseLogger } from 'fastify';

/**
 * B2 (Day 8): "finance: malzeme maliyeti (`material.purchased` consumer)". procurement-service
 * bir malzeme satın alması KAYDETTİĞİNDE (register-material-purchase.usecase.ts, önceki günden)
 * `material.purchased { materialId, projectId, totalTl, totalUsd, purchaseDate }` yayınlıyor —
 * finance-service Kırılmaz Kural gereği procurement'ın `procurement_materials` /
 * `procurement_stock_movements` tablolarına ASLA doğrudan erişemez, bu yüzden proje başına
 * biriken malzeme maliyetini SADECE bu event akışından öğrenir.
 *
 * NOT (finance-cost.repository.ts'teki addMaterialCost yorumuna bkz.): proje henüz
 * `finance_project_costs`'ta bir satıra sahip değilse (örn. event sıralaması bir şekilde
 * `project.created`'tan ÖNCE gelirse — normalde olmaz ama RabbitMQ teslimat sırası garanti
 * etmez) `addMaterialCost` bir hata fırlatır; bu, mesajın nack edilip DLX'e düşmesine neden
 * olur (RabbitMqClient.subscribe'ın kendi davranışı) — veri sessizce kaybolmaz.
 */
export async function recordMaterialCost(
  event: MaterialPurchasedEvent,
  costRepo: CostRepository,
  logger: FastifyBaseLogger,
): Promise<ProjectCostRow> {
  const updated = await costRepo.addMaterialCost(event.projectId, event.totalTl, event.totalUsd);
  logger.info(
    { projectId: event.projectId, materialId: event.materialId, deltaTl: event.totalTl, deltaUsd: event.totalUsd },
    'Malzeme maliyeti finance_project_costs\'a işlendi.',
  );
  return updated;
}
