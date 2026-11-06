import type { AuditPublisherFn } from '@pms/shared';
import type { MaterialRepository, CreateMaterialRow, MaterialRow } from '../../infrastructure/database/material.repository';
import type { IntegrationServiceClient } from '../../infrastructure/external/integration-service.client';

export interface RegisterMaterialInput {
  projectId: string;
  malzemeTuru: string;
  malzemeAdi: string;
  teknikOzellik?: string;
  adet: number;
  birimFiyat: number;
  alimTarihi: string;
  manuelKur?: number; // verilmezse integration-service'ten otomatik çekilir (kural: madde 5)
}

/**
 * Madde 5 (docs/roadmap.md): "malzemenin alındığı tarihteki dolar kuru otomatik olarak
 * getirilmeli, eğer farklı bir dolar kurundan malzeme alımı yapıldıysa buna göre dolar
 * kurunun güncellenebilmesine izin verilmeli."
 */
export async function registerMaterialPurchase(
  input: RegisterMaterialInput,
  actorUserId: string,
  materialRepo: MaterialRepository,
  integrationClient: IntegrationServiceClient,
  publishAudit: AuditPublisherFn,
  publishMaterialPurchased: (event: { materialId: string; projectId: string; totalTl: number; totalUsd: number; purchaseDate: string }) => Promise<void>,
): Promise<MaterialRow> {
  const rate = input.manuelKur ?? (await integrationClient.getRateForDate(input.alimTarihi));

  const data: CreateMaterialRow = {
    project_id: input.projectId,
    malzeme_turu: input.malzemeTuru,
    malzeme_adi: input.malzemeAdi,
    teknik_ozellik: input.teknikOzellik ?? null,
    adet: input.adet,
    birim_fiyat: input.birimFiyat,
    alim_tarihi: input.alimTarihi,
    alim_dolar_kuru: rate,
    kur_manuel_override: input.manuelKur !== undefined,
    olusturan_id: actorUserId,
  };

  const created = await materialRepo.create(data);

  await publishMaterialPurchased({
    materialId: created.id,
    projectId: created.project_id,
    totalTl: created.toplam_tl,
    totalUsd: created.toplam_usd,
    purchaseDate: created.alim_tarihi,
  });

  await publishAudit({
    eventType: 'CREATE',
    actorUserId,
    actorEmail: null,
    entityType: 'procurement_materials',
    entityId: created.id,
    ozet: `"${created.malzeme_adi}" malzemesi satın alındı (${created.toplam_tl} TL).`,
    severity: 'info',
  });

  return created;
}
