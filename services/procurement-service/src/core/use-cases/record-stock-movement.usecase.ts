import { ValidationError, type AuditPublisherFn } from '@pms/shared';
import type { StockMovementRepository } from '../../infrastructure/database/stock-movement.repository';

/**
 * Madde: "Satın alma alınan Malzemenin ... stok durumlarını sisteme girmekten sorumlu"
 * (satın alma/depo personeli). Çıkış hareketi, mevcut stoktan fazla olamaz.
 */
export async function recordStockMovement(
  materialId: string,
  hareketTipi: 'giris' | 'cikis',
  miktar: number,
  aciklama: string | undefined,
  actorUserId: string,
  repo: StockMovementRepository,
  publishAudit: AuditPublisherFn,
) {
  if (hareketTipi === 'cikis') {
    const currentStock = await repo.currentStock(materialId);
    if (miktar > currentStock) {
      throw new ValidationError(`Çıkış miktarı (${miktar}) mevcut stoktan (${currentStock}) fazla olamaz`);
    }
  }

  const created = await repo.create(materialId, hareketTipi, miktar, aciklama);

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'procurement_stock_movements',
    entityId: created.id,
    ozet: `Malzeme (${materialId}) için ${hareketTipi === 'giris' ? 'giriş' : 'çıkış'} hareketi: ${miktar}.`,
    severity: 'info',
  });

  return created;
}
